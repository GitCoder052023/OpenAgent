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

type StepFunModelProvider struct {
	subType     string
	apiKey      string
	temperature float32
	topP        float32
}

func NewStepFunModelProvider(subType string, apiKey string, temperature float32, topP float32) (*StepFunModelProvider, error) {
	return &StepFunModelProvider{
		subType:     subType,
		apiKey:      apiKey,
		temperature: temperature,
		topP:        topP,
	}, nil
}

func (p *StepFunModelProvider) GetPricing() string {
	return `URL:
https://platform.stepfun.com/docs/zh/pricing/details

Prices below are the cache-miss input rate; cache hits are billed at roughly 20% of it.

| Model                 | Context | Input Price per 1K tokens | Output Price per 1K tokens |
|-----------------------|---------|---------------------------|----------------------------|
| step-3.7-flash        | 256K    | 0.00135 yuan/1,000 tokens | 0.0081 yuan/1,000 tokens   |
| step-3.5-flash        | 256K    | 0.0007 yuan/1,000 tokens  | 0.0021 yuan/1,000 tokens   |
| step-3.5-flash-2603   | 256K    | 0.0007 yuan/1,000 tokens  | 0.0021 yuan/1,000 tokens   |
| step-1o-turbo-vision  | 32K     | 0.0025 yuan/1,000 tokens  | 0.008 yuan/1,000 tokens    |
`
}

func (p *StepFunModelProvider) calculatePrice(modelResult *ModelResult, lang string) error {
	price := 0.0
	priceTable := map[string][2]float64{
		"step-3.7-flash":       {0.00135, 0.0081},
		"step-3.5-flash":       {0.0007, 0.0021},
		"step-3.5-flash-2603":  {0.0007, 0.0021},
		"step-1o-turbo-vision": {0.0025, 0.008},
	}

	if priceItem, ok := priceTable[p.subType]; ok {
		inputPrice := getPrice(modelResult.PromptTokenCount, priceItem[0])
		outputPrice := getPrice(modelResult.ResponseTokenCount, priceItem[1])
		price = inputPrice + outputPrice
	} else {
		return fmt.Errorf(i18n.Translate(lang, "embedding:calculatePrice() error: unknown model type: %s"), p.subType)
	}

	modelResult.TotalPrice = price
	modelResult.Currency = "CNY"
	return nil
}

func (p *StepFunModelProvider) QueryText(question string, writer io.Writer, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	const BaseUrl = "https://api.stepfun.com/v1"
	// Create a new LocalModelProvider to handle the request
	localProvider, err := NewLocalModelProvider("Custom", "custom-model", p.apiKey, p.temperature, p.topP, 0, 0, BaseUrl, p.subType, 0, 0, "CNY")
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

func (p *StepFunModelProvider) ListModels() ([]string, error) {
	return openaiCompatibleListModels("stepfun", p.apiKey, "https://api.stepfun.com/v1")
}
