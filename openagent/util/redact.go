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
	"encoding/json"
	"net/url"
	"strings"
)

const redactedValue = "***"

var sensitiveKeyNames = map[string]bool{
	"accesskey":  true,
	"configtext": true,
	"cookie":     true,
	"env":        true,
	"privatekey": true,
	"signkey":    true,
	"userkey":    true,
}

var sensitiveQueryKeyNames = map[string]bool{
	"code": true,
}

var sensitiveKeyNormalizer = strings.NewReplacer("_", "", "-", "")

// IsSensitiveKey reports whether a field or query parameter name usually holds a credential.
func IsSensitiveKey(key string) bool {
	k := strings.ToLower(sensitiveKeyNormalizer.Replace(key))
	return strings.Contains(k, "password") || strings.Contains(k, "secret") ||
		strings.HasSuffix(k, "token") || strings.HasSuffix(k, "apikey") || sensitiveKeyNames[k]
}

// RedactSensitiveJson replaces the values of credential-like fields in a JSON document with "***",
// so request bodies can be logged or stored without leaking secrets. Anything that is not a JSON
// object or array is returned unchanged.
func RedactSensitiveJson(text string) string {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" || (trimmed[0] != '{' && trimmed[0] != '[') {
		return text
	}

	var data interface{}
	decoder := json.NewDecoder(strings.NewReader(trimmed))
	decoder.UseNumber()
	if err := decoder.Decode(&data); err != nil {
		return text
	}
	if !redactJsonValue(data) {
		return text
	}

	res, err := json.Marshal(data)
	if err != nil {
		return text
	}
	return string(res)
}

func redactJsonValue(value interface{}) bool {
	changed := false
	switch v := value.(type) {
	case map[string]interface{}:
		for key, item := range v {
			if IsSensitiveKey(key) {
				if item != nil && item != "" && item != redactedValue {
					v[key] = redactedValue
					changed = true
				}
				continue
			}
			if redactJsonValue(item) {
				changed = true
			}
		}
	case []interface{}:
		for _, item := range v {
			if redactJsonValue(item) {
				changed = true
			}
		}
	}
	return changed
}

// RedactSensitiveUrl replaces the values of credential-like query parameters in a URL or request
// URI with "***". A URL that cannot be parsed is returned unchanged.
func RedactSensitiveUrl(rawUrl string) string {
	if !strings.Contains(rawUrl, "?") {
		return rawUrl
	}
	u, err := url.Parse(rawUrl)
	if err != nil {
		return rawUrl
	}
	query, err := url.ParseQuery(u.RawQuery)
	if err != nil {
		return rawUrl
	}

	changed := false
	for key, values := range query {
		if !IsSensitiveKey(key) && !sensitiveQueryKeyNames[strings.ToLower(key)] {
			continue
		}
		for i, value := range values {
			if value != "" && value != redactedValue {
				values[i] = redactedValue
				changed = true
			}
		}
	}
	if !changed {
		return rawUrl
	}

	u.RawQuery = query.Encode()
	return u.String()
}

func maskMiddle(value string, keepStart int, keepEnd int) string {
	runes := []rune(value)
	if len(runes) <= keepStart+keepEnd {
		if len(runes) == 0 {
			return ""
		}
		return redactedValue
	}
	return string(runes[:keepStart]) + strings.Repeat("*", len(runes)-keepStart-keepEnd) + string(runes[len(runes)-keepEnd:])
}

func MaskPhone(phone string) string {
	return maskMiddle(phone, 3, 4)
}

func MaskIdCard(idCard string) string {
	return maskMiddle(idCard, 1, 1)
}
