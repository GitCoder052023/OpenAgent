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

package model

import (
	"io"
)

const chatGLMBaseUrl = "https://open.bigmodel.cn/api/paas/v4"

type ChatGLMModelProvider struct {
	subType      string
	clientSecret string
	temperature  float32
	topP         float32
}

func NewChatGLMModelProvider(subType string, clientSecret string, temperature float32, topP float32) (*ChatGLMModelProvider, error) {
	return &ChatGLMModelProvider{
		subType:      subType,
		clientSecret: clientSecret,
		temperature:  temperature,
		topP:         topP,
	}, nil
}

func (p *ChatGLMModelProvider) GetPricing() string {
	return `URL:
https://docs.bigmodel.cn/cn/guide/start/model-overview

Generate Model:

| Model                    | sub-type                 | Context Length | Input Price per 1K tokens | Output Price per 1K tokens |
|--------------------------|--------------------------|----------------|---------------------------|----------------------------|
| GLM-5.3                  | glm-5.3                  | 1M             | 0.008 yuan/1,000 tokens   | 0.028 yuan/1,000 tokens    |
| GLM-5.2                  | glm-5.2                  | 1M             | 0.008 yuan/1,000 tokens   | 0.028 yuan/1,000 tokens    |
| GLM-5.1                  | glm-5.1                  | 200K           | 0.006 yuan/1,000 tokens   | 0.024 yuan/1,000 tokens    |
| GLM-5                    | glm-5                    | 200K           | 0.004 yuan/1,000 tokens   | 0.018 yuan/1,000 tokens    |
| GLM-5-Turbo              | glm-5-turbo              | 200K           | 0.005 yuan/1,000 tokens   | 0.022 yuan/1,000 tokens    |
| GLM-4.7                  | glm-4.7                  | 200K           | 0.002 yuan/1,000 tokens   | 0.008 yuan/1,000 tokens    |
| GLM-4.7-FlashX           | glm-4.7-flashx           | 200K           | 0.0005 yuan/1,000 tokens  | 0.003 yuan/1,000 tokens    |
| GLM-4.7-Flash            | glm-4.7-flash            | 200K           | Free                      | Free                       |
| GLM-4.6                  | glm-4.6                  | 200K           | see BigModel pricing page | see BigModel pricing page  |
| GLM-4.5-Air              | glm-4.5-air              | 128K           | 0.0008 yuan/1,000 tokens  | 0.002 yuan/1,000 tokens    |
| GLM-4.5-AirX             | glm-4.5-airx             | 128K           | see BigModel pricing page | see BigModel pricing page  |
| GLM-4.5-Flash            | glm-4.5-flash            | 128K           | Free                      | Free                       |
| GLM-4-Long               | glm-4-long               | 1M             | 0.001 yuan/1,000 tokens   | 0.001 yuan/1,000 tokens    |
| GLM-4-FlashX-250414      | glm-4-flashx-250414      | 128K           | 0.0001 yuan/1,000 tokens  | 0.0001 yuan/1,000 tokens   |
| GLM-4-Flash-250414       | glm-4-flash-250414       | 128K           | Free                      | Free                       |
| GLM-5.3-Flash            | glm-5.3-flash            | 1M             | 0.0008 yuan/1,000 tokens  | 0.0028 yuan/1,000 tokens   |
| GLM-5V-Turbo             | glm-5v-turbo             | 200K           | 0.005 yuan/1,000 tokens   | 0.022 yuan/1,000 tokens    |
| GLM-4.6V                 | glm-4.6v                 | 128K           | 0.001 yuan/1,000 tokens   | 0.003 yuan/1,000 tokens    |
| GLM-4.6V-Flash           | glm-4.6v-flash           | 128K           | Free                      | Free                       |
| GLM-4.1V-Thinking-FlashX | glm-4.1v-thinking-flashx | 64K            | 0.002 yuan/1,000 tokens   | 0.002 yuan/1,000 tokens    |
| GLM-4.1V-Thinking-Flash  | glm-4.1v-thinking-flash  | 64K            | Free                      | Free                       |
| GLM-4V-Flash             | glm-4v-flash             | 16K            | Free                      | Free                       |
| AutoGLM-Phone            | autoglm-phone            | 20K            | see BigModel pricing page | see BigModel pricing page  |
`
}

func (p *ChatGLMModelProvider) calculatePrice(modelResult *ModelResult, lang string) error {
	// Tiered models are billed at their shortest-input tier, which is the price shown first
	// on https://open.bigmodel.cn/pricing
	priceTable := map[string][2]float64{
		"glm-5.3":                  {0.008, 0.028},
		"glm-5.2":                  {0.008, 0.028},
		"glm-5.1":                  {0.006, 0.024},
		"glm-5":                    {0.004, 0.018},
		"glm-5-turbo":              {0.005, 0.022},
		"glm-4.7":                  {0.002, 0.008},
		"glm-4.7-flashx":           {0.0005, 0.003},
		"glm-4.7-flash":            {0, 0},
		"glm-4.5-air":              {0.0008, 0.002},
		"glm-4.5-flash":            {0, 0},
		"glm-4-long":               {0.001, 0.001},
		"glm-4-flashx-250414":      {0.0001, 0.0001},
		"glm-4-flash-250414":       {0, 0},
		"glm-5.3-flash":            {0.0008, 0.0028},
		"glm-5v-turbo":             {0.005, 0.022},
		"glm-4.6v":                 {0.001, 0.003},
		"glm-4.6v-flash":           {0, 0},
		"glm-4.1v-thinking-flashx": {0.002, 0.002},
		"glm-4.1v-thinking-flash":  {0, 0},
		"glm-4v-flash":             {0, 0},
	}

	// Models whose rate BigModel does not publish per-token (glm-4.6, glm-4.5-airx,
	// autoglm-phone) report price = 0 instead of failing the request.
	price := 0.0
	if priceItem, ok := priceTable[p.subType]; ok {
		inputPrice := getPrice(modelResult.PromptTokenCount, priceItem[0])
		outputPrice := getPrice(modelResult.ResponseTokenCount, priceItem[1])
		price = AddPrices(inputPrice, outputPrice)
	}

	modelResult.TotalPrice = price
	modelResult.Currency = "CNY"
	return nil
}

func (p *ChatGLMModelProvider) QueryText(question string, writer io.Writer, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	localProvider, err := NewLocalModelProvider("Custom-think", "custom-model", p.clientSecret, p.temperature, p.topP, 0, 0, chatGLMBaseUrl, p.subType, 0, 0, "CNY")
	if err != nil {
		return nil, err
	}

	modelResult, err := localProvider.QueryText(question, writer, history, prompt, knowledgeMessages, toolSession, lang)
	if err != nil {
		return nil, err
	}

	err = p.calculatePrice(modelResult, lang)
	if err != nil {
		return nil, err
	}
	return modelResult, nil
}

func (p *ChatGLMModelProvider) ListModels() ([]string, error) {
	return openaiCompatibleListModels("ChatGLM", p.clientSecret, chatGLMBaseUrl)
}
