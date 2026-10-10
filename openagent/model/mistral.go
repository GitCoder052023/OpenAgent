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
	"fmt"
	"io"
	"strings"

	"github.com/gage-technologies/mistral-go"
	"github.com/the-open-agent/openagent/i18n"
)

type MistralModelProvider struct {
	client    *mistral.MistralClient
	modelName string
	secretKey string
}

func NewMistralProvider(apiKey, modelName string) (*MistralModelProvider, error) {
	client := mistral.NewMistralClientDefault(apiKey)

	return &MistralModelProvider{
		client:    client,
		modelName: modelName,
		secretKey: apiKey,
	}, nil
}

func (c *MistralModelProvider) GetPricing() string {
	return `URL: https://mistral.ai/pricing/api

	| Model                               | Input Price($) per 1K tokens  | Output Price($) per 1K tokens  |
	|-------------------------------------|-------------------------------|--------------------------------|
	| mistral-medium-2604 (Medium 3.5)    | 0.0015                        | 0.0075                         |
	| mistral-small-2603 (Small 4)        | 0.00015                       | 0.0006                         |
	| mistral-large-2512 (Large 3)        | 0.0005                        | 0.0015                         |
	| ministral-3-14b-2512                | 0.0002                        | 0.0002                         |
	| ministral-3-8b-2512                 | 0.00015                       | 0.00015                        |
	| ministral-3-3b-2512                 | 0.0001                        | 0.0001                         |
	| codestral-2508                      | 0.0003                        | 0.0009                         |
	| z-ai-glm-5-3                        | 0.0014                        | 0.0044                         |
	| z-ai-glm-5-2                        | 0.0014                        | 0.0044                         |
	`
}

func (c *MistralModelProvider) calculatePrice(modelResult *ModelResult, lang string) error {
	price := 0.0
	priceTable := map[string][2]float64{
		"mistral-medium-2604":  {0.0015, 0.0075},
		"mistral-small-2603":   {0.00015, 0.0006},
		"mistral-large-2512":   {0.0005, 0.0015},
		"ministral-3-14b-2512": {0.0002, 0.0002},
		"ministral-3-8b-2512":  {0.00015, 0.00015},
		"ministral-3-3b-2512":  {0.0001, 0.0001},
		"codestral-2508":       {0.0003, 0.0009},
		"z-ai-glm-5-3":         {0.0014, 0.0044},
		"z-ai-glm-5-2":         {0.0014, 0.0044},
	}

	if priceItem, ok := priceTable[c.modelName]; ok {
		inputPrice := getPrice(modelResult.PromptTokenCount, priceItem[0])
		outputPrice := getPrice(modelResult.ResponseTokenCount, priceItem[1])
		price = inputPrice + outputPrice
	} else {
		return fmt.Errorf(i18n.Translate(lang, "embedding:calculatePrice() error: unknown model type: %s"), c.modelName)
	}

	modelResult.TotalPrice = price
	modelResult.Currency = "USD"
	return nil
}

func (c *MistralModelProvider) QueryText(question string, writer io.Writer, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	chatRes, err := c.client.Chat(c.modelName, []mistral.ChatMessage{{Content: question, Role: mistral.RoleUser}}, nil)
	if err != nil {
		return nil, fmt.Errorf(i18n.Translate(lang, "model:error getting chat completion: %v"), err)
	}

	respText := chatRes.Choices[0].Message.Content
	respText = strings.TrimSpace(respText)

	_, err = fmt.Fprint(writer, respText)
	if err != nil {
		return nil, fmt.Errorf(i18n.Translate(lang, "model:failed to write response: %v"), err)
	}

	modelResult, err := getDefaultModelResult(c.modelName, question, respText)
	if err != nil {
		return nil, err
	}

	err = c.calculatePrice(modelResult, lang)
	if err != nil {
		return nil, fmt.Errorf(i18n.Translate(lang, "embedding:failed to calculate price: %v"), err)
	}
	modelResult.PromptTokenCount += len(question)

	return modelResult, nil
}

func (c *MistralModelProvider) ListModels() ([]string, error) {
	return openaiCompatibleListModels("mistral", c.secretKey, "https://api.mistral.ai/v1")
}
