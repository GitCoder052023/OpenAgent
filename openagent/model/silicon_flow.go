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

type SiliconFlowProvider struct {
	subType     string
	apiKey      string
	temperature float32
	topP        float32
}

func NewSiliconFlowProvider(subType string, apiKey string, temperature float32, topP float32) (*SiliconFlowProvider, error) {
	return &SiliconFlowProvider{
		subType:     subType,
		apiKey:      apiKey,
		temperature: temperature,
		topP:        topP,
	}, nil
}

func (p *SiliconFlowProvider) GetPricing() string {
	return `URL:
https://cloud.siliconflow.cn/models

| Model      | sub-type                                  | Input Price per 1K characters     | Output Price per 1K characters   |
|------------|-------------------------------------------|-----------------------------------|----------------------------------|
| DeepSeek   | deepseek-ai/DeepSeek-V4-Pro               | 0.01200yuan/1,000 tokens          | 0.02400yuan/1,000 tokens         |
| DeepSeek   | deepseek-ai/DeepSeek-V4-Flash             | 0.00100yuan/1,000 tokens          | 0.00200yuan/1,000 tokens         |
| DeepSeek   | deepseek-ai/DeepSeek-V3.2                 | 0.00200yuan/1,000 tokens          | 0.00300yuan/1,000 tokens         |
| DeepSeek   | Pro/deepseek-ai/DeepSeek-V3.2             | 0.00200yuan/1,000 tokens          | 0.00300yuan/1,000 tokens         |
| DeepSeek   | deepseek-ai/DeepSeek-V3.1-Terminus        | 0.00400yuan/1,000 tokens          | 0.01200yuan/1,000 tokens         |
| DeepSeek   | Pro/deepseek-ai/DeepSeek-V3.1-Terminus    | 0.00400yuan/1,000 tokens          | 0.01200yuan/1,000 tokens         |
| Qwen       | Qwen/Qwen3.6-35B-A3B                      | 0.00160yuan/1,000 tokens          | 0.01280yuan/1,000 tokens         |
| Qwen       | Qwen/Qwen3.6-27B                          | 0.00180yuan/1,000 tokens          | 0.01440yuan/1,000 tokens         |
| Qwen       | Qwen/Qwen3.5-397B-A17B                    | 0.00200yuan/1,000 tokens          | 0.00120yuan/1,000 tokens         |
| GLM        | zai-org/GLM-5.2                           | 0.00600yuan/1,000 tokens          | 0.02800yuan/1,000 tokens         |
| GLM        | Pro/zai-org/GLM-5.1                       | 0.00600yuan/1,000 tokens          | 0.02800yuan/1,000 tokens         |
| Kimi       | moonshotai/Kimi-K2.7-Code                 | 0.00650yuan/1,000 tokens          | 0.02700yuan/1,000 tokens         |
| Kimi       | Pro/moonshotai/Kimi-K2.6                  | 0.00650yuan/1,000 tokens          | 0.02700yuan/1,000 tokens         |
| MiniMax    | MiniMaxAI/MiniMax-M2.5                    | 0.00210yuan/1,000 tokens          | 0.00840yuan/1,000 tokens         |
| MiniMax    | Pro/MiniMaxAI/MiniMax-M2.5                | 0.00210yuan/1,000 tokens          | 0.00840yuan/1,000 tokens         |
| LongCat    | meituan-longcat/LongCat-2.0               | 0.00500yuan/1,000 tokens          | 0.02000yuan/1,000 tokens         |
| Nex        | nex-agi/Nex-N2-Pro                        | 0.00175yuan/1,000 tokens          | 0.00700yuan/1,000 tokens         |
`
}

func (p *SiliconFlowProvider) calculatePrice(modelResult *ModelResult, lang string) error {
	priceTable := map[string][2]float64{
		"deepseek-ai/DeepSeek-V4-Pro":            {0.01200, 0.02400},
		"deepseek-ai/DeepSeek-V4-Flash":          {0.00100, 0.00200},
		"deepseek-ai/DeepSeek-V3.2":              {0.00200, 0.00300},
		"Pro/deepseek-ai/DeepSeek-V3.2":          {0.00200, 0.00300},
		"deepseek-ai/DeepSeek-V3.1-Terminus":     {0.00400, 0.01200},
		"Pro/deepseek-ai/DeepSeek-V3.1-Terminus": {0.00400, 0.01200},
		"Qwen/Qwen3.6-35B-A3B":                   {0.00160, 0.01280},
		"Qwen/Qwen3.6-27B":                       {0.00180, 0.01440},
		"Qwen/Qwen3.5-397B-A17B":                 {0.00200, 0.00120},
		"zai-org/GLM-5.2":                        {0.00600, 0.02800},
		"Pro/zai-org/GLM-5.1":                    {0.00600, 0.02800},
		"moonshotai/Kimi-K2.7-Code":              {0.00650, 0.02700},
		"Pro/moonshotai/Kimi-K2.6":               {0.00650, 0.02700},
		"MiniMaxAI/MiniMax-M2.5":                 {0.00210, 0.00840},
		"Pro/MiniMaxAI/MiniMax-M2.5":             {0.00210, 0.00840},
		"meituan-longcat/LongCat-2.0":            {0.00500, 0.02000},
		"nex-agi/Nex-N2-Pro":                     {0.00175, 0.00700},
	}

	// Silicon Flow hosts hundreds of models and adds new ones constantly, so a model
	// fetched from its API may be missing from priceTable: graceful fallback to price=0
	// instead of failing the whole chat request
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

func (p *SiliconFlowProvider) QueryText(question string, writer io.Writer, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	const BaseUrl = "https://api.siliconflow.cn/v1"
	// Create a new LocalModelProvider to handle the request
	localProvider, err := NewLocalModelProvider("Custom-think", "custom-model", p.apiKey, p.temperature, p.topP, 0, 0, BaseUrl, p.subType, 0, 0, "USD")
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

func (p *SiliconFlowProvider) ListModels() ([]string, error) {
	return openaiCompatibleListModels("silicon flow", p.apiKey, "https://api.siliconflow.cn/v1")
}
