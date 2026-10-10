// Copyright 2024 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
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

	"github.com/the-open-agent/openagent/i18n"
)

type DeepSeekProvider struct {
	subType     string
	apiKey      string
	temperature float32
	topP        float32
}

func NewDeepSeekProvider(subType string, apiKey string, temperature float32, topP float32) (*DeepSeekProvider, error) {
	return &DeepSeekProvider{
		subType:     subType,
		apiKey:      apiKey,
		temperature: temperature,
		topP:        topP,
	}, nil
}

func (p *DeepSeekProvider) GetPricing() string {
	return `URL:
https://api-docs.deepseek.com/quick_start/pricing

Both models have a 1M token context window and a 384K max output. Prices below are the
off-peak cache-miss rates; peak hours (01:00-04:00 and 06:00-10:00 UTC, Mon-Fri) are
billed at twice these rates, and cache hits are billed far lower.

| Model           | sub-type        | Input Price per 1K tokens | Output Price per 1K tokens |
|-----------------|-----------------|---------------------------|----------------------------|
| DeepSeek-V4-Pro | deepseek-v4-pro | $0.00066                  | $0.00198                   |
| DeepSeek-Flash  | deepseek-flash  | $0.00015                  | $0.0006                    |

The legacy names deepseek-v4-flash and deepseek-v4-flash-vision-exp are still accepted;
their requests are served by DeepSeek-V4.1-Flash and billed at the Flash price.
`
}

func (p *DeepSeekProvider) calculatePrice(modelResult *ModelResult, lang string) error {
	price := 0.0
	priceTable := map[string][2]float64{
		"deepseek-v4-pro": {0.00066, 0.00198},
		"deepseek-flash":  {0.00015, 0.0006},
		// Legacy names still accepted by the API, served and billed as deepseek-flash
		"deepseek-v4-flash":            {0.00015, 0.0006},
		"deepseek-v4-flash-vision-exp": {0.00015, 0.0006},
	}

	if priceItem, ok := priceTable[p.subType]; ok {
		inputPrice := getPrice(modelResult.PromptTokenCount, priceItem[0])
		outputPrice := getPrice(modelResult.ResponseTokenCount, priceItem[1])
		price = inputPrice + outputPrice
	} else {
		return fmt.Errorf(i18n.Translate(lang, "embedding:calculatePrice() error: unknown model type: %s"), p.subType)
	}

	modelResult.TotalPrice = price
	modelResult.Currency = "USD"
	return nil
}

func (p *DeepSeekProvider) QueryText(question string, writer io.Writer, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	const BaseUrl = "https://api.deepseek.com/v1"

	// Both current DeepSeek models are reasoning models
	localType := "Custom-think"
	localProvider, err := NewLocalModelProvider(localType, "custom-model", p.apiKey, p.temperature, p.topP, 0, 0, BaseUrl, p.subType, 0, 0, "USD")
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

func (p *DeepSeekProvider) ListModels() ([]string, error) {
	return openaiCompatibleListModels("deepseek", p.apiKey, "https://api.deepseek.com/v1")
}
