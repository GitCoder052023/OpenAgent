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
	"strings"
	"testing"
)

func TestRedactSensitiveJson(t *testing.T) {
	body := `{"name":"p1","clientSecret":"sk-real","providerUrl":"https://x","externalApiKey":"sk-2","tokenCount":12,` +
		`"env":{"API_KEY":"v"},"nested":[{"password":"pw","display":"ok"}],"token":""}`
	res := RedactSensitiveJson(body)

	for _, leaked := range []string{"sk-real", "sk-2", `"pw"`, `"v"`} {
		if strings.Contains(res, leaked) {
			t.Fatalf("redacted body still contains %s: %s", leaked, res)
		}
	}
	for _, kept := range []string{`"providerUrl":"https://x"`, `"tokenCount":12`, `"display":"ok"`, `"token":""`} {
		if !strings.Contains(res, kept) {
			t.Fatalf("redacted body lost %s: %s", kept, res)
		}
	}
}

func TestRedactSensitiveJsonKeepsNonJson(t *testing.T) {
	for _, text := range []string{"", "plain text", "username=a&password=b", "{broken"} {
		if res := RedactSensitiveJson(text); res != text {
			t.Fatalf("RedactSensitiveJson(%q) = %q, want unchanged", text, res)
		}
	}

	body := `{"name":"a","count":1}`
	if res := RedactSensitiveJson(body); res != body {
		t.Fatalf("RedactSensitiveJson(%q) = %q, want unchanged", body, res)
	}
}

func TestRedactSensitiveUrl(t *testing.T) {
	res := RedactSensitiveUrl("/api/get-account?clientId=abc&clientSecret=s3cret&access_token=t0k")
	if strings.Contains(res, "s3cret") || strings.Contains(res, "t0k") {
		t.Fatalf("redacted URL still contains a secret: %s", res)
	}
	if !strings.Contains(res, "clientId=abc") {
		t.Fatalf("redacted URL lost a normal parameter: %s", res)
	}

	uri := "/api/get-chats?user=alice"
	if res := RedactSensitiveUrl(uri); res != uri {
		t.Fatalf("RedactSensitiveUrl(%q) = %q, want unchanged", uri, res)
	}
}
