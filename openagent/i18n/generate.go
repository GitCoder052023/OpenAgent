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

package i18n

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/the-open-agent/openagent/util"
)

type I18nData map[string]map[string]string

var (
	reI18nLiteral           *regexp.Regexp
	reI18nFrontendNamespace *regexp.Regexp
	reI18nBackendNamespace  *regexp.Regexp
	reI18nDynamicConcat     *regexp.Regexp
	reI18nDynamicTemplate   *regexp.Regexp
)

func init() {
	// keys are mostly passed around as plain strings (labelKey="general:Name", c.ResponseError("auth:...")),
	// so every "namespace:key" literal counts, not only the argument of i18next.t() or c.T()
	reI18nLiteral = regexp.MustCompile("\"(\\w+:(?:[^\"\\\\\\n]|\\\\.)+)\"")
	reI18nFrontendNamespace = regexp.MustCompile("i18next\\.t\\([\"`](\\w+):")
	reI18nBackendNamespace = regexp.MustCompile("(?:i18n\\.Translate\\([^,\"]*,\\s*|c\\.T\\()\"(\\w+):")
	// keys built at runtime: c.T("comment:" + message), i18next.t(`experience:State - ${item}`)
	reI18nDynamicConcat = regexp.MustCompile("\"(\\w+):\"\\s*\\+")
	reI18nDynamicTemplate = regexp.MustCompile("`(\\w+):([^`$\\n]*)\\$\\{")
}

func getAllI18nStrings(fileContent string, namespaces map[string]bool) []string {
	res := []string{}

	matches := reI18nLiteral.FindAllStringSubmatchIndex(fileContent, -1)
	if matches == nil {
		return res
	}

	for _, match := range matches {
		// an OAuth scope like "user:email" is not an i18n key
		if strings.HasSuffix(strings.TrimRight(fileContent[:match[0]], " "), "scope:") {
			continue
		}

		raw := fileContent[match[2]:match[3]]
		target, err := strconv.Unquote("\"" + raw + "\"")
		if err != nil {
			target = raw
		}

		tokens := strings.SplitN(target, ":", 2)
		if !namespaces[tokens[0]] || strings.HasPrefix(tokens[1], " ") {
			continue
		}
		res = append(res, target)
	}
	return res
}

func getI18nNamespaces(fileContent string, category string) []string {
	re := reI18nFrontendNamespace
	if category == "backend" {
		re = reI18nBackendNamespace
	}

	res := []string{}
	for _, match := range re.FindAllStringSubmatch(fileContent, -1) {
		res = append(res, match[1])
	}
	return res
}

func addDynamicI18nPrefixes(fileContent string, dynamicPrefixes map[string][]string) {
	for _, match := range reI18nDynamicConcat.FindAllStringSubmatch(fileContent, -1) {
		dynamicPrefixes[match[1]] = append(dynamicPrefixes[match[1]], "")
	}
	for _, match := range reI18nDynamicTemplate.FindAllStringSubmatch(fileContent, -1) {
		dynamicPrefixes[match[1]] = append(dynamicPrefixes[match[1]], match[2])
	}
}

// keepDerivedWords keeps the existing keys that the code never spells out in full:
// "X - Tooltip" (FormRow derives it from labelKey), "New X" / "View X" (getModeTitleKey
// derives them from "Edit X") and the keys built at runtime from a known prefix.
func keepDerivedWords(data *I18nData, oldData *I18nData, dynamicPrefixes map[string][]string) {
	for namespace, oldPairs := range *oldData {
		pairs, ok := (*data)[namespace]
		if !ok {
			if len(dynamicPrefixes[namespace]) == 0 {
				continue
			}
			pairs = map[string]string{}
		}

		for key := range oldPairs {
			keep := false
			for _, prefix := range dynamicPrefixes[namespace] {
				if strings.HasPrefix(key, prefix) {
					keep = true
				}
			}
			if base, found := strings.CutSuffix(key, " - Tooltip"); found {
				if _, ok := pairs[base]; ok {
					keep = true
				}
			}
			for _, prefix := range []string{"New ", "View "} {
				if base, found := strings.CutPrefix(key, prefix); found {
					if _, ok := pairs["Edit "+base]; ok {
						keep = true
					}
				}
			}

			if _, ok := pairs[key]; !ok && keep {
				pairs[key] = key
			}
		}

		if len(pairs) > 0 {
			(*data)[namespace] = pairs
		}
	}
}

func getAllFilePathsInFolder(folder string, fileSuffix string) []string {
	res := []string{}
	err := filepath.Walk(folder,
		func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			// hidden folders hold other checkouts of this repo (.claude/worktrees, .git)
			if info.IsDir() && path != folder && (info.Name() == "node_modules" || strings.HasPrefix(info.Name(), ".")) {
				return filepath.SkipDir
			}

			if !strings.HasSuffix(info.Name(), fileSuffix) {
				return nil
			}

			res = append(res, path)
			fmt.Println(path, info.Name())
			return nil
		})
	if err != nil {
		panic(err)
	}

	return res
}

func parseAllWords(category string) *I18nData {
	var paths []string
	if category == "backend" {
		paths = getAllFilePathsInFolder("../", ".go")
	} else {
		// the frontend is TypeScript, so ".js" alone would walk right past it
		paths = getAllFilePathsInFolder("../web/src", ".tsx")
		paths = append(paths, getAllFilePathsInFolder("../web/src", ".ts")...)
	}

	fileContents := []string{}
	for _, path := range paths {
		if category == "backend" && filepath.Base(filepath.Dir(path)) == "i18n" {
			continue
		}
		fileContents = append(fileContents, util.ReadStringFromPath(path))
	}

	oldData := readI18nFile(category, "en")
	namespaces := map[string]bool{}
	dynamicPrefixes := map[string][]string{}
	for namespace := range *oldData {
		namespaces[namespace] = true
	}
	for _, fileContent := range fileContents {
		for _, namespace := range getI18nNamespaces(fileContent, category) {
			namespaces[namespace] = true
		}
		addDynamicI18nPrefixes(fileContent, dynamicPrefixes)
	}

	allWords := []string{}
	for _, fileContent := range fileContents {
		allWords = append(allWords, getAllI18nStrings(fileContent, namespaces)...)
	}
	fmt.Printf("%v\n", allWords)

	data := I18nData{}
	for _, word := range allWords {
		tokens := strings.SplitN(word, ":", 2)
		namespace := tokens[0]
		key := tokens[1]

		if _, ok := data[namespace]; !ok {
			data[namespace] = map[string]string{}
		}
		data[namespace][key] = key
	}

	keepDerivedWords(&data, oldData, dynamicPrefixes)

	return &data
}

// copyI18nData creates a deep copy of an I18nData structure to prevent shared reference issues
// between language translations. This ensures each language starts with fresh English defaults
// rather than inheriting values from previously processed languages.
func copyI18nData(src *I18nData) *I18nData {
	dst := I18nData{}
	for namespace, pairs := range *src {
		dst[namespace] = make(map[string]string)
		for key, value := range pairs {
			dst[namespace][key] = value
		}
	}
	return &dst
}

func applyToOtherLanguage(category string, language string, newData *I18nData) {
	oldData := readI18nFile(category, language)
	println(oldData)

	// Create a copy of newData to avoid modifying the shared data across languages
	dataCopy := copyI18nData(newData)
	applyData(dataCopy, oldData)
	writeI18nFile(category, language, dataCopy)
}
