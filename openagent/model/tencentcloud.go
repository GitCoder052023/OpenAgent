// Copyright 2025 The OpenAgent Authors. All Rights Reserved.
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

package model

import (
	"io"
	"strings"
)

type TencentCloudClient struct {
	endpoint    string
	subType     string
	apiKey      string
	temperature float32
	topP        float32
}

func NewTencentCloudProvider(secretKey, endpoint, subType string, temperature, topP float32) (*TencentCloudClient, error) {
	if endpoint == "" {
		endpoint = "https://api.hunyuan.cloud.tencent.com/v1"
	}
	return &TencentCloudClient{
		apiKey:      secretKey,
		endpoint:    endpoint,
		subType:     subType,
		temperature: temperature,
		topP:        topP,
	}, nil
}

func (c *TencentCloudClient) GetPricing() string {
	return `URL:
https://cloud.tencent.com/document/product/1729/104753

| Model                       | Input context | Output context | Pricing                       |
|-----------------------------|---------------|----------------|-------------------------------|
| hunyuan-a13b                | 224K          | 32K            | see Tencent Cloud price page  |
| hunyuan-vision-1.5-instruct | 24K           | 16K            | see Tencent Cloud price page  |
| hunyuan-t1-vision-20250916  | 28K           | 20K            | see Tencent Cloud price page  |
| hunyuan-turbos-vision-video | 24K           | 8K             | see Tencent Cloud price page  |
| hunyuan-role-latest         | 28K           | 4K             | see Tencent Cloud price page  |
| hunyuan-translation         | 4K            | 4K             | see Tencent Cloud price page  |
| hunyuan-translation-lite    | 4K            | 4K             | see Tencent Cloud price page  |
`
}

func (c *TencentCloudClient) QueryText(question string, writer io.Writer, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	baseUrl := c.endpoint
	// Get model name
	model := ""
	if strings.Contains(strings.ToLower(c.subType), "hunyuan") {
		model = c.subType
	} else {
		modelSplit := strings.Split(c.endpoint, "/")
		model = modelSplit[len(modelSplit)-1]
	}
	// Create a new LocalModelProvider to handle the request
	localProvider, err := NewLocalModelProvider("Custom", "custom-model", c.apiKey, c.temperature, c.topP, 0, 0, baseUrl, model, 0, 0, "CNY")
	if err != nil {
		return nil, err
	}

	modelResult, err := localProvider.QueryText(question, writer, history, prompt, knowledgeMessages, toolSession, lang)
	if err != nil {
		return nil, err
	}
	return modelResult, nil
}

func (c *TencentCloudClient) ListModels() ([]string, error) {
	return unsupportedListModels("Tencent Cloud")
}
