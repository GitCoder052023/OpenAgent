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

package object

import (
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/beego/beego/logs"
	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/util"
)

func init() {
	util.TrustedInternalUrlChecker = isTrustedInternalUrl
}

// isTrustedInternalUrl reports whether u points at a file this deployment serves itself: its own
// /storage route, or the host of a configured storage provider. Such URLs may live on internal
// addresses (localhost, a LAN MinIO, ...) and still be safe to fetch for chat attachments.
func isTrustedInternalUrl(u *url.URL) bool {
	if isOwnStorageUrl(u) {
		return true
	}

	trusted, err := isStorageProviderHost(u.Host)
	if err != nil {
		logs.Error("isStorageProviderHost() error: %s", err.Error())
		return false
	}
	return trusted
}

// isOwnStorageUrl matches the /storage route of this server, which only serves files inside the
// local storage providers' folders.
func isOwnStorageUrl(u *url.URL) bool {
	if !strings.HasPrefix(u.Path, "/storage/") || strings.Contains(u.Path, "..") {
		return false
	}

	port := u.Port()
	if port == "" {
		if u.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}
	httpPort := conf.GetConfigInt("httpport")
	if httpPort == 0 {
		httpPort = 14000
	}
	if port != strconv.Itoa(httpPort) {
		return isSiteEndpointHost(u.Host)
	}

	hostname, _ := os.Hostname()
	isThisMachine, err := util.MatchTargetWithMachine(u.Hostname(), hostname)
	return err == nil && isThisMachine
}

func isSiteEndpointHost(host string) bool {
	site, err := GetBuiltInSiteWithSecret()
	if err != nil || site == nil || site.Endpoint == "" {
		return false
	}
	endpoint, err := url.Parse(site.Endpoint)
	if err != nil {
		return false
	}
	return strings.EqualFold(endpoint.Host, host)
}

func getProviderUrlHost(rawUrl string) string {
	rawUrl = strings.TrimSpace(rawUrl)
	if rawUrl == "" {
		return ""
	}
	if !strings.Contains(rawUrl, "://") {
		rawUrl = "http://" + rawUrl
	}
	u, err := url.Parse(rawUrl)
	if err != nil {
		return ""
	}
	return u.Host
}

// isStorageProviderHost reports whether host is where a configured storage provider serves files.
func isStorageProviderHost(host string) (bool, error) {
	providers := []*Provider{}
	err := adapter.engine.Find(&providers, &Provider{Category: "Storage"})
	if err != nil {
		return false, err
	}

	if providerAdapter != nil {
		remoteProviders := []*Provider{}
		err = providerAdapter.engine.Find(&remoteProviders, &Provider{Category: "Storage"})
		if err != nil {
			return false, err
		}
		providers = append(providers, remoteProviders...)
	}

	for _, provider := range providers {
		for _, providerUrl := range []string{provider.Domain, provider.CdnDomain, provider.ProviderUrl} {
			providerHost := getProviderUrlHost(providerUrl)
			if providerHost != "" && strings.EqualFold(providerHost, host) {
				return true, nil
			}
		}
	}
	return false, nil
}
