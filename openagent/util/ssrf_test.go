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
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestIsPublicIp(t *testing.T) {
	cases := map[string]bool{
		"8.8.8.8":          true,
		"1.1.1.1":          true,
		"2606:4700::1111":  true,
		"127.0.0.1":        false,
		"10.1.2.3":         false,
		"172.16.0.1":       false,
		"192.168.1.1":      false,
		"169.254.169.254":  false,
		"100.100.100.200":  false,
		"0.0.0.0":          false,
		"::1":              false,
		"fe80::1":          false,
		"fd00::1":          false,
		"::ffff:127.0.0.1": false,
		"64:ff9b::a00:1":   false,
	}
	for ip, want := range cases {
		if got := IsPublicIp(net.ParseIP(ip)); got != want {
			t.Errorf("IsPublicIp(%s) = %v, want %v", ip, got, want)
		}
	}
	if IsPublicIp(nil) {
		t.Errorf("IsPublicIp(nil) = true, want false")
	}
}

func TestDownloadUntrustedFileRefusesInternalAddresses(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("secret"))
	}))
	defer server.Close()

	oldChecker := TrustedInternalUrlChecker
	defer func() { TrustedInternalUrlChecker = oldChecker }()

	TrustedInternalUrlChecker = nil
	if _, err := DownloadUntrustedFile(server.URL + "/a.txt"); err == nil {
		t.Fatalf("DownloadUntrustedFile() fetched a loopback URL, want an error")
	}

	TrustedInternalUrlChecker = func(u *url.URL) bool { return true }
	buffer, err := DownloadUntrustedFile(server.URL + "/a.txt")
	if err != nil {
		t.Fatalf("DownloadUntrustedFile() on a trusted URL error: %v", err)
	}
	if buffer.String() != "secret" {
		t.Errorf("DownloadUntrustedFile() = %q, want %q", buffer.String(), "secret")
	}
}

func TestGetUntrustedHttpClientRejectsOtherSchemes(t *testing.T) {
	for _, rawUrl := range []string{"file:///etc/passwd", "gopher://127.0.0.1/", "/local/path.txt"} {
		if _, err := GetUntrustedHttpClient(rawUrl); err == nil {
			t.Errorf("GetUntrustedHttpClient(%q) succeeded, want an error", rawUrl)
		}
	}
}
