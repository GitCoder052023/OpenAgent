// Copyright 2026 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package util

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"syscall"
	"time"

	"github.com/the-open-agent/openagent/proxy"
	xproxy "golang.org/x/net/proxy"
)

const (
	untrustedFetchTimeout      = 60 * time.Second
	untrustedFetchMaxRedirects = 5
	// UntrustedFetchMaxBytes caps how much is downloaded from a user-supplied URL.
	UntrustedFetchMaxBytes = 50 * 1024 * 1024
)

// nonPublicIpNets lists ranges that the net.IP helpers do not already classify as non-public.
var nonPublicIpNets = mustParseCidrs(
	"0.0.0.0/8",     // "this" network
	"100.64.0.0/10", // carrier-grade NAT, also hosts cloud metadata such as Alibaba Cloud's 100.100.100.200
	"192.0.0.0/24",  // IETF protocol assignments
	"198.18.0.0/15", // benchmarking
	"240.0.0.0/4",   // reserved
	"64:ff9b::/96",  // NAT64, which can map onto internal IPv4 addresses
	"64:ff9b:1::/48",
)

// TrustedInternalUrlChecker reports whether a URL that points at a non-public address still
// belongs to this deployment (its own /storage route or a configured storage provider), so it
// may be fetched even though arbitrary internal addresses may not. It is set by the object package.
var TrustedInternalUrlChecker func(u *url.URL) bool

// StorageUrlRewriter signs this server's own /storage URLs before they are fetched.
var StorageUrlRewriter func(u *url.URL)

type storageUrlTransport struct{}

func (t *storageUrlTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if StorageUrlRewriter != nil {
		req = req.Clone(req.Context())
		StorageUrlRewriter(req.URL)
	}
	return http.DefaultTransport.RoundTrip(req)
}

var untrustedHttpClient = newUntrustedHttpClient()

func mustParseCidrs(cidrs ...string) []*net.IPNet {
	res := []*net.IPNet{}
	for _, cidr := range cidrs {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			panic(err)
		}
		res = append(res, ipNet)
	}
	return res
}

// IsPublicIp reports whether ip is a routable public internet address.
func IsPublicIp(ip net.IP) bool {
	if ip == nil {
		return false
	}
	if ip4 := ip.To4(); ip4 != nil {
		ip = ip4
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsInterfaceLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() {
		return false
	}
	for _, ipNet := range nonPublicIpNets {
		if ipNet.Contains(ip) {
			return false
		}
	}
	return true
}

// publicOnlyDialControl runs after DNS resolution, so it also covers redirects and DNS rebinding.
func publicOnlyDialControl(network string, address string, _ syscall.RawConn) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return err
	}
	if !IsPublicIp(net.ParseIP(host)) {
		return fmt.Errorf("access to the non-public address %s is not allowed", host)
	}
	return nil
}

func newUntrustedHttpClient() *http.Client {
	dialer := &net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
		Control:   publicOnlyDialControl,
	}
	transport := &http.Transport{
		// No proxy: a proxy would dial the target itself and bypass the address check.
		Proxy:                 nil,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
	return &http.Client{
		Transport:     transport,
		Timeout:       untrustedFetchTimeout,
		CheckRedirect: limitRedirects,
	}
}

func limitRedirects(req *http.Request, via []*http.Request) error {
	if len(via) >= untrustedFetchMaxRedirects {
		return fmt.Errorf("stopped after %d redirects", untrustedFetchMaxRedirects)
	}
	return nil
}

// NewUntrustedHttpClient returns a client for URLs chosen by users or model output. It refuses
// to connect to loopback, private, link-local and other non-public addresses.
func NewUntrustedHttpClient(timeout time.Duration) *http.Client {
	client := *untrustedHttpClient
	client.Timeout = timeout
	return &client
}

func isTrustedInternalUrl(u *url.URL) bool {
	return TrustedInternalUrlChecker != nil && TrustedInternalUrlChecker(u)
}

// GetUntrustedHttpClient picks the client for fetching rawUrl: URLs that belong to this
// deployment may reach internal addresses (without following redirects), anything else is
// limited to public addresses.
func GetUntrustedHttpClient(rawUrl string) (*http.Client, error) {
	u, err := url.Parse(rawUrl)
	if err != nil {
		return nil, err
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return nil, fmt.Errorf("unsupported URL scheme: %s", u.Scheme)
	}
	if u.Hostname() == "" {
		return nil, fmt.Errorf("the URL has no host: %s", rawUrl)
	}

	if isTrustedInternalUrl(u) {
		return &http.Client{
			Transport: &storageUrlTransport{},
			Timeout:   untrustedFetchTimeout,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}, nil
	}
	return untrustedHttpClient, nil
}

// newUntrustedProxyHttpClient returns a client that reaches public addresses through the SOCKS5
// proxy. The host is resolved and checked here and only the IP is handed to the proxy, so the
// proxy cannot be steered to addresses the check refuses.
func newUntrustedProxyHttpClient(socks5Proxy string) (*http.Client, error) {
	dialer, err := xproxy.SOCKS5("tcp", socks5Proxy, nil, &net.Dialer{Timeout: 30 * time.Second})
	if err != nil {
		return nil, err
	}
	contextDialer, ok := dialer.(xproxy.ContextDialer)
	if !ok {
		return nil, fmt.Errorf("the SOCKS5 dialer does not support contexts")
	}

	transport := &http.Transport{
		Proxy: nil,
		DialContext: func(ctx context.Context, network string, address string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(address)
			if err != nil {
				return nil, err
			}
			ips, err := net.DefaultResolver.LookupIP(ctx, "ip", host)
			if err != nil {
				return nil, err
			}
			for _, ip := range ips {
				if IsPublicIp(ip) {
					return contextDialer.DialContext(ctx, network, net.JoinHostPort(ip.String(), port))
				}
			}
			return nil, fmt.Errorf("access to the non-public address of %s is not allowed", host)
		},
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
	return &http.Client{
		Transport:     transport,
		Timeout:       untrustedFetchTimeout,
		CheckRedirect: limitRedirects,
	}, nil
}

// GetUntrustedUrl fetches rawUrl like GetUntrustedHttpClient, and when the direct connection
// fails (for example a site blocked in mainland China), retries through the configured SOCKS5 proxy.
func GetUntrustedUrl(rawUrl string) (*http.Response, error) {
	httpClient, err := GetUntrustedHttpClient(rawUrl)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Get(rawUrl)
	if err == nil || httpClient != untrustedHttpClient {
		return resp, err
	}

	socks5Proxy := proxy.GetActiveSocks5ProxyAddress()
	if socks5Proxy == "" {
		return nil, err
	}
	proxyHttpClient, proxyErr := newUntrustedProxyHttpClient(socks5Proxy)
	if proxyErr != nil {
		return nil, err
	}
	resp, proxyErr = proxyHttpClient.Get(rawUrl)
	if proxyErr != nil {
		return nil, fmt.Errorf("%v (via proxy: %v)", err, proxyErr)
	}
	return resp, nil
}

// DownloadUntrustedFile downloads a user-supplied URL with SSRF protection and a size limit.
func DownloadUntrustedFile(rawUrl string) (*bytes.Buffer, error) {
	resp, err := GetUntrustedUrl(rawUrl)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, rawUrl)
	}

	fileBuffer := bytes.NewBuffer(nil)
	n, err := io.Copy(fileBuffer, io.LimitReader(resp.Body, UntrustedFetchMaxBytes+1))
	if err != nil {
		return nil, err
	}
	if n > UntrustedFetchMaxBytes {
		return nil, fmt.Errorf("the file at %s exceeds %d bytes", rawUrl, UntrustedFetchMaxBytes)
	}

	return fileBuffer, nil
}
