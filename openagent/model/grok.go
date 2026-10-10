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

	"github.com/the-open-agent/openagent/i18n"
)

type GrokModelProvider struct {
	subType     string
	secretKey   string
	temperature float32
	topP        float32
}

func NewGrokModelProvider(subType string, secretKey string, temperature float32, topP float32) (*GrokModelProvider, error) {
	return &GrokModelProvider{
		subType:     subType,
		secretKey:   secretKey,
		temperature: temperature,
		topP:        topP,
	}, nil
}

func (p *GrokModelProvider) GetPricing() string {
	return `URL:
https://docs.x.ai/docs/models

Text models (the higher rate applies to prompts of 200K tokens or more):

| Models                       | Context | Input (Per 1,000 tokens) | Output (Per 1,000 tokens) |
|------------------------------|---------|--------------------------|---------------------------|
| grok-4.6                     | 500K    | $0.002 / $0.004          | $0.006 / $0.012           |
| grok-4.5                     | 500K    | $0.002 / $0.004          | $0.006 / $0.012           |
| grok-4.3                     | 1M      | $0.00125 / $0.0025       | $0.0025 / $0.005          |
| grok-4.20-0309-reasoning     | 1M      | $0.00125 / $0.0025       | $0.0025 / $0.005          |
| grok-4.20-0309-non-reasoning | 1M      | $0.00125 / $0.0025       | $0.0025 / $0.005          |
| grok-4.20-multi-agent-0309   | 1M      | $0.00125 / $0.0025       | $0.0025 / $0.005          |
| grok-build-0.1               | 256K    | $0.001 / $0.002          | $0.002 / $0.004           |

Image models:

| Models                      | Price (per image) |
|-----------------------------|-------------------|
| grok-imagine-image-quality  | $0.05             |
| grok-imagine-image-2.0      | $0.04             |
| grok-imagine-image          | $0.02             |
`
}

func (p *GrokModelProvider) calculatePrice(modelResult *ModelResult, lang string) error {
	var inputPricePerThousandTokens, outputPricePerThousandTokens float64

	// Image generation models are billed per image
	if strings.HasPrefix(p.subType, "grok-imagine-image") {
		pricePerImage := 0.02
		if strings.Contains(p.subType, "quality") {
			pricePerImage = 0.05
		} else if strings.Contains(p.subType, "2.0") {
			pricePerImage = 0.04
		}
		modelResult.TotalPrice = float64(modelResult.ImageCount) * pricePerImage
		modelResult.Currency = "USD"
		return nil
	}

	// Text models are billed at the short-context rate below 200K prompt tokens, which is
	// the rate shown here
	if strings.Contains(p.subType, "grok-4.6") || strings.Contains(p.subType, "grok-4.5") {
		inputPricePerThousandTokens = 0.002  // $2.00 per 1M tokens
		outputPricePerThousandTokens = 0.006 // $6.00 per 1M tokens
	} else if strings.Contains(p.subType, "grok-4.3") || strings.Contains(p.subType, "grok-4.20") {
		inputPricePerThousandTokens = 0.00125 // $1.25 per 1M tokens
		outputPricePerThousandTokens = 0.0025 // $2.50 per 1M tokens
	} else if strings.Contains(p.subType, "grok-build") {
		inputPricePerThousandTokens = 0.001  // $1.00 per 1M tokens
		outputPricePerThousandTokens = 0.002 // $2.00 per 1M tokens
	} else {
		return fmt.Errorf(i18n.Translate(lang, "embedding:calculatePrice() error: unknown model type: %s"), p.subType)
	}

	inputPrice := getPrice(modelResult.PromptTokenCount, inputPricePerThousandTokens)
	outputPrice := getPrice(modelResult.ResponseTokenCount, outputPricePerThousandTokens)
	modelResult.TotalPrice = AddPrices(inputPrice, outputPrice)
	modelResult.Currency = "USD"
	return nil
}

func (p *GrokModelProvider) QueryText(question string, writer io.Writer, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	// Create a LocalModelProvider to handle the request
	const BaseUrl = "https://api.x.ai/v1"
	localProvider, err := NewLocalModelProvider("Custom", "custom-model", p.secretKey, p.temperature, p.topP, 0, 0, BaseUrl, p.subType, 0, 0, "USD")
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

func (p *GrokModelProvider) ListModels() ([]string, error) {
	return openaiCompatibleListModels("grok", p.secretKey, "https://api.x.ai/v1")
}
