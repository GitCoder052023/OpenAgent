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
)

type MiniMaxModelProvider struct {
	subType     string
	apiKey      string
	temperature float32
}

func NewMiniMaxModelProvider(subType string, groupID string, apiKey string, temperature float32) (*MiniMaxModelProvider, error) {
	return &MiniMaxModelProvider{
		subType:     subType,
		apiKey:      apiKey,
		temperature: temperature,
	}, nil
}

func (p *MiniMaxModelProvider) GetPricing() string {
	return `URL:
https://platform.minimaxi.com/docs/guides/pricing-paygo

| Model                    | Input Price         | Output Price         |
|--------------------------|---------------------|----------------------|
| MiniMax-M3               | 4 CNY/1M tokens     | 16 CNY/1M tokens     |
| MiniMax-M2.7             | 1 CNY/1M tokens     | 7 CNY/1M tokens      |
| MiniMax-M2.7-highspeed   | 1 CNY/1M tokens     | 7 CNY/1M tokens      |
| MiniMax-M2.5             | 1 CNY/1M tokens     | 7 CNY/1M tokens      |
| MiniMax-M2.5-highspeed   | 1 CNY/1M tokens     | 7 CNY/1M tokens      |
| MiniMax-M2.1             | 1 CNY/1M tokens     | 7 CNY/1M tokens      |
| MiniMax-M2.1-highspeed   | 1 CNY/1M tokens     | 7 CNY/1M tokens      |
| MiniMax-M2               | 1 CNY/1M tokens     | 7 CNY/1M tokens      |
| M2-her                   | 0.1 CNY/1M tokens   | 0.1 CNY/1M tokens    |
| MiniMax-M1               | see MiniMax pricing | see MiniMax pricing  |
| MiniMax-Text-01          | see MiniMax pricing | see MiniMax pricing  |
`
}

func (p *MiniMaxModelProvider) calculatePrice(modelResult *ModelResult, lang string) error {
	price := 0.0
	priceTable := map[string][2]float64{
		"MiniMax-M3":             {0.004, 0.016},
		"MiniMax-M2.7":           {0.001, 0.007},
		"MiniMax-M2.7-highspeed": {0.001, 0.007},
		"MiniMax-M2.5":           {0.001, 0.007},
		"MiniMax-M2.5-highspeed": {0.001, 0.007},
		"MiniMax-M2.1":           {0.001, 0.007},
		"MiniMax-M2.1-highspeed": {0.001, 0.007},
		"MiniMax-M2":             {0.001, 0.007},
		"M2-her":                 {0.0001, 0.0001},
	}

	// The older MiniMax-M1 / MiniMax-Text-01 models no longer have a published pay-as-you-go
	// rate, so they report price = 0 instead of failing the request.
	if priceItem, ok := priceTable[p.subType]; ok {
		inputPrice := getPrice(modelResult.PromptTokenCount, priceItem[0])
		outputPrice := getPrice(modelResult.ResponseTokenCount, priceItem[1])
		price = inputPrice + outputPrice
	}

	modelResult.TotalPrice = price
	modelResult.Currency = "CNY"
	return nil
}

func (p *MiniMaxModelProvider) QueryText(question string, writer io.Writer, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	const BaseUrl = "https://api.minimaxi.com/v1"

	localProvider, err := NewLocalModelProvider("Custom", p.subType, p.apiKey, p.temperature, 0, 0, 0, BaseUrl, "", 0, 0, "CNY")
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

func (p *MiniMaxModelProvider) ListModels() ([]string, error) {
	return unsupportedListModels("MiniMax")
}
