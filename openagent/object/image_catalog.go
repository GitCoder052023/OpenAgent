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

package object

import (
	"fmt"
	"strings"
)

const (
	imageCatalogMaxCount       = 50
	imageCatalogMaxDescription = 80
)

func getImageVectors(storeNames []string) ([]*Vector, error) {
	vectors := []*Vector{}
	err := adapter.engine.Cols("file", "text", "image_url").In("store", storeNames).And("image_url <> ''").Asc("file").Find(&vectors)
	if err != nil {
		return nil, err
	}

	res := []*Vector{}
	seen := map[string]bool{}
	for _, vector := range vectors {
		if seen[vector.ImageUrl] {
			continue
		}
		seen[vector.ImageUrl] = true
		res = append(res, vector)
		if len(res) == imageCatalogMaxCount {
			break
		}
	}
	return res, nil
}

func GetImageKnowledgeCatalog(store *Store) (string, error) {
	storeNames := append([]string{}, store.VectorStores...)
	storeNames = append(storeNames, store.Name)

	vectors, err := getImageVectors(storeNames)
	if err != nil {
		return "", err
	}
	if len(vectors) == 0 {
		return "", nil
	}

	var sb strings.Builder
	if containsChinese(store.Prompt) {
		sb.WriteString("## 知识库中的图片\n")
		sb.WriteString("当用户想看图、要示意图或让你画图时，如果下面有对应的图片，就在回答里用 Markdown 原样输出这张图（链接一字不改）。不要编造图片链接。\n")
	} else {
		sb.WriteString("## Images in the knowledge base\n")
		sb.WriteString("When the user wants to see a picture, asks for a diagram or asks you to draw one, and one of the images below fits, show it in your answer with its markdown exactly as given (do not change the link). Never make up image links.\n")
	}

	for _, vector := range vectors {
		title, description, _ := strings.Cut(vector.Text, "\n")
		title = strings.TrimSpace(title)
		description = strings.Join(strings.Fields(description), " ")
		if runes := []rune(description); len(runes) > imageCatalogMaxDescription {
			description = string(runes[:imageCatalogMaxDescription]) + "..."
		}

		if description == "" {
			sb.WriteString(fmt.Sprintf("- %s: ![%s](%s)\n", title, title, vector.ImageUrl))
		} else {
			sb.WriteString(fmt.Sprintf("- %s (%s): ![%s](%s)\n", title, description, title, vector.ImageUrl))
		}
	}

	return sb.String(), nil
}
