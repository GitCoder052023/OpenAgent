// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
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
	"fmt"
	"os"
	"path/filepath"

	"github.com/the-open-agent/openagent/conf"
	"github.com/ua-parser/uap-go/uaparser"
)

var Parser *uaparser.Parser

func InitParser() {
	candidates := []string{
		"../data/regexes.yaml",
		conf.GetSharedPath("data/regexes.yaml"),
		"../../data/regexes.yaml",
	}
	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), "data", "regexes.yaml"))
	}
	if cache, err := os.UserCacheDir(); err == nil {
		candidates = append(candidates, filepath.Join(cache, "openagent", "data", "regexes.yaml"))
	}

	var err error
	for _, p := range candidates {
		Parser, err = uaparser.New(p)
		if err == nil {
			return
		}
		if _, ok := err.(*os.PathError); !ok {
			break
		}
	}
	Parser = nil
}

func GetDescFromUserAgent(userAgent string) string {
	if Parser == nil {
		if userAgent == "" {
			return ""
		}
		return userAgent
	}
	client := Parser.Parse(userAgent)
	return fmt.Sprintf("%s | %s | %s", client.UserAgent.ToString(), client.Os.ToString(), client.Device.ToString())
}
