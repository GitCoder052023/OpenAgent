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
	"net/http/httptest"
	"testing"
)

func TestIsLoopbackRequest(t *testing.T) {
	cases := []struct {
		name       string
		remoteAddr string
		host       string
		headers    map[string]string
		want       bool
	}{
		{"ipv4 loopback", "127.0.0.1:50000", "localhost:14000", nil, true},
		{"ipv6 loopback", "[::1]:50000", "[::1]:14000", nil, true},
		{"loopback ip host", "127.0.0.1:50000", "127.0.0.1:14000", nil, true},
		{"remote client", "203.0.113.5:50000", "localhost:14000", nil, false},
		{"lan client", "192.168.1.20:50000", "192.168.1.10:14000", nil, false},
		{"reverse proxy", "127.0.0.1:50000", "localhost:14000", map[string]string{"X-Forwarded-For": "203.0.113.5"}, false},
		{"reverse proxy real ip", "127.0.0.1:50000", "localhost:14000", map[string]string{"X-Real-IP": "203.0.113.5"}, false},
		{"dns rebinding", "127.0.0.1:50000", "evil.example.com:14000", nil, false},
	}

	for _, c := range cases {
		r := httptest.NewRequest("GET", "/api/get-account", nil)
		r.RemoteAddr = c.remoteAddr
		r.Host = c.host
		for k, v := range c.headers {
			r.Header.Set(k, v)
		}
		if got := IsLoopbackRequest(r); got != c.want {
			t.Errorf("%s: IsLoopbackRequest() = %v, want %v", c.name, got, c.want)
		}
	}
}

func TestSanitizePathSegment(t *testing.T) {
	cases := map[string]string{
		"photo.png":        "photo.png",
		"":                 "",
		".":                "_",
		"../../etc/passwd": "____etc_passwd",
		"..\\..\\win.ini":  "____win.ini",
		"C:/Windows":       "C__Windows",
	}

	for input, want := range cases {
		if got := SanitizePathSegment(input); got != want {
			t.Errorf("SanitizePathSegment(%q) = %q, want %q", input, got, want)
		}
	}
}
