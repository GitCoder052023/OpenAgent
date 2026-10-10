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

package conf

import "strings"

var defaultStaticBaseUrls = []string{
	"https://cdn.openagentai.org",
	"https://cdn.casibase.com",
}

func NormalizeEmbeddedWebConfig(config *WebConfig) {
	if config == nil || !embeddedWebAssets {
		return
	}

	config.StaticBaseUrl = NormalizeEmbeddedStaticBaseUrl(config.StaticBaseUrl)
	config.FaviconUrl = NormalizeEmbeddedAssetUrl(config.FaviconUrl)
	config.LogoUrl = NormalizeEmbeddedAssetUrl(config.LogoUrl)
	config.NavbarHtml = NormalizeEmbeddedAssetHtml(config.NavbarHtml)
	config.FooterHtml = NormalizeEmbeddedAssetHtml(config.FooterHtml)
}

func NormalizeEmbeddedStaticBaseUrl(value string) string {
	if !embeddedWebAssets {
		return value
	}

	trimmedValue := strings.TrimRight(value, "/")
	for _, baseUrl := range defaultStaticBaseUrls {
		if trimmedValue == baseUrl {
			return ""
		}
	}
	return value
}

func NormalizeEmbeddedAssetHtml(value string) string {
	if !embeddedWebAssets || value == "" {
		return value
	}

	result := value
	result = strings.ReplaceAll(result, "https://cdn.casibase.com/static/favicon.png", "/img/openagent.png")
	for _, baseUrl := range defaultStaticBaseUrls {
		result = strings.ReplaceAll(result, baseUrl+"/", "/")
	}
	return result
}

func NormalizeEmbeddedAssetUrl(value string) string {
	if !embeddedWebAssets || value == "" {
		return value
	}

	if value == "https://cdn.casibase.com/static/favicon.png" {
		return "/img/openagent.png"
	}

	for _, baseUrl := range defaultStaticBaseUrls {
		prefix := baseUrl + "/"
		if strings.HasPrefix(value, prefix) {
			return "/" + strings.TrimPrefix(value, prefix)
		}
	}
	return value
}
