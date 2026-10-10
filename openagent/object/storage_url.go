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
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"

	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/util"
)

const storageObjectUrlPrefix = "/storage/objects/"

func init() {
	util.StorageUrlRewriter = signLegacyStorageUrl
}

func getStorageUrlKey() []byte {
	secret := conf.GetConfigString("storageUrlSecret")
	if secret == "" {
		secret = conf.GetConfigString("dataSourceName") + conf.GetConfigString("dbName") + conf.GetConfigString("clientSecret")
	}
	sum := sha256.Sum256([]byte("openagent-storage-url:" + secret))
	return sum[:]
}

func getStorageObjectSignature(providerName string, key string) string {
	mac := hmac.New(sha256.New, getStorageUrlKey())
	mac.Write([]byte(providerName + "/" + key))
	return hex.EncodeToString(mac.Sum(nil))[:32]
}

func IsValidStorageObjectSignature(providerName string, key string, signature string) bool {
	return hmac.Equal([]byte(getStorageObjectSignature(providerName, key)), []byte(signature))
}

func getStorageObjectUrlPath(providerName string, key string) string {
	segments := strings.Split(key, "/")
	for i, segment := range segments {
		segments[i] = url.PathEscape(segment)
	}
	return fmt.Sprintf("%s%s/%s?sig=%s", storageObjectUrlPrefix, url.PathEscape(providerName), strings.Join(segments, "/"), getStorageObjectSignature(providerName, key))
}

func getStorageObjectMarkdownUrl(providerName string, key string) string {
	replacer := strings.NewReplacer("%", "%25", " ", "%20", "(", "%28", ")", "%29", "<", "%3C", ">", "%3E", "?", "%3F", "#", "%23", "\\", "%5C")
	return fmt.Sprintf("%s%s/%s?sig=%s", storageObjectUrlPrefix, replacer.Replace(providerName), replacer.Replace(key), getStorageObjectSignature(providerName, key))
}

// ParseStorageObjectUrlPath splits a decoded "/storage/objects/<provider>/<key>" path.
func ParseStorageObjectUrlPath(urlPath string) (string, string, bool) {
	if !strings.HasPrefix(urlPath, storageObjectUrlPrefix) {
		return "", "", false
	}
	tokens := strings.SplitN(strings.TrimPrefix(urlPath, storageObjectUrlPrefix), "/", 2)
	if len(tokens) != 2 || tokens[0] == "" || tokens[1] == "" {
		return "", "", false
	}
	return tokens[0], tokens[1], true
}

// signLegacyStorageUrl rewrites an old "/storage/<file path>" URL of this server into a signed object
// URL, so the server can still fetch attachments that were stored before object URLs were introduced.
func signLegacyStorageUrl(u *url.URL) {
	if !strings.HasPrefix(u.Path, "/storage/") || strings.HasPrefix(u.Path, storageObjectUrlPrefix) {
		return
	}

	path := strings.Replace(strings.TrimPrefix(u.Path, "/storage/"), "|", ":", 1)
	if !strings.Contains(path, ":") {
		path = "/" + path
	}
	providerName, key, err := getLocalStorageObjectKey(path)
	if err != nil || providerName == "" {
		return
	}

	res, err := url.Parse(getStorageObjectUrlPath(providerName, key))
	if err != nil {
		return
	}
	u.Path = res.Path
	u.RawPath = res.RawPath
	u.RawQuery = res.RawQuery
}
