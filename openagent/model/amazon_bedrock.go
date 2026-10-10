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
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/the-open-agent/openagent/i18n"
)

type AmazonBedrockModelProvider struct {
	temperature float64
	subType     string
	secretKey   string
}

func NewAmazonBedrockModelProvider(subType string, secretKey string, temperature float64) (*AmazonBedrockModelProvider, error) {
	client := &AmazonBedrockModelProvider{
		subType:     subType,
		secretKey:   secretKey,
		temperature: temperature,
	}
	return client, nil
}

func (a AmazonBedrockModelProvider) GetPricing() string {
	return `URL: https://aws.amazon.com/bedrock/pricing/

The sub-type of an Amazon Bedrock provider is the Bedrock model ID passed straight to
InvokeModel / Converse. Third-party models are billed through AWS Marketplace, so the
rates below track the model provider's published prices.

| Model                    | Model ID                                 | Input (per 1K tokens) | Output (per 1K tokens) |
|--------------------------|------------------------------------------|-----------------------|------------------------|
| Claude Fable 5.1         | global.anthropic.claude-fable-5-1        | $0.010                | $0.050                 |
| Claude Opus 5            | global.anthropic.claude-opus-5           | $0.005                | $0.025                 |
| Claude Sonnet 5          | global.anthropic.claude-sonnet-5         | $0.002                | $0.010                 |
| Claude Fable 5           | global.anthropic.claude-fable-5          | $0.010                | $0.050                 |
| Claude Opus 4.8          | global.anthropic.claude-opus-4-8         | $0.005                | $0.025                 |
| Claude Opus 4.7          | global.anthropic.claude-opus-4-7         | $0.005                | $0.025                 |
| Claude Sonnet 4.6        | global.anthropic.claude-sonnet-4-6       | $0.003                | $0.015                 |
| Claude Haiku 4.5         | global.anthropic.claude-haiku-4-5        | $0.001                | $0.005                 |
| GPT-6 Astra              | global.openai.gpt-6-astra                | $0.010                | $0.050                 |
| GPT-5.6 Sol              | global.openai.gpt-5.6-sol                | $0.004                | $0.020                 |
| GPT-5.6 Terra            | global.openai.gpt-5.6-terra              | $0.002                | $0.012                 |
| GPT-5.6 Luna             | global.openai.gpt-5.6-luna               | $0.0002               | $0.0012                |
| Nova 2 Lite              | amazon.nova-2-lite-v1:0                  | see AWS pricing page  | see AWS pricing page   |
| Nova Premier             | amazon.nova-premier-v1:0                 | see AWS pricing page  | see AWS pricing page   |
| Nova Pro                 | amazon.nova-pro-v1:0                     | see AWS pricing page  | see AWS pricing page   |
| Nova Lite                | amazon.nova-lite-v1:0                    | see AWS pricing page  | see AWS pricing page   |
| Nova Micro               | amazon.nova-micro-v1:0                   | see AWS pricing page  | see AWS pricing page   |
| DeepSeek V3.2            | deepseek.v3.2                            | see AWS pricing page  | see AWS pricing page   |
| Mistral Large 3          | mistral.mistral-large-3-675b-instruct    | $0.0005               | $0.0015                |
| Llama 3.3 70B Instruct   | meta.llama3-3-70b-instruct-v1:0          | see AWS pricing page  | see AWS pricing page   |
| Command R+               | cohere.command-r-plus-v1:0               | $0.0025               | $0.010                 |
| Command R                | cohere.command-r-v1:0                    | $0.00015              | $0.0006                |
`
}

func (p *AmazonBedrockModelProvider) calculatePrice(modelResult *ModelResult, lang string) error {
	// Bedrock re-bills third-party models through AWS Marketplace and the per-token rates
	// change per Region and service tier, so models without a rate here report price = 0
	// instead of failing the request.
	prices := map[string]struct {
		InputTokenPrice  float64
		OutputTokenPrice float64
	}{
		"anthropic.claude-fable-5-1":            {0.010, 0.050},
		"anthropic.claude-fable-5":              {0.010, 0.050},
		"anthropic.claude-opus-5":               {0.005, 0.025},
		"anthropic.claude-opus-4-8":             {0.005, 0.025},
		"anthropic.claude-opus-4-7":             {0.005, 0.025},
		"anthropic.claude-sonnet-5":             {0.002, 0.010},
		"anthropic.claude-sonnet-4-6":           {0.003, 0.015},
		"anthropic.claude-haiku-4-5":            {0.001, 0.005},
		"openai.gpt-6-astra":                    {0.010, 0.050},
		"openai.gpt-5.6-sol":                    {0.004, 0.020},
		"openai.gpt-5.6-terra":                  {0.002, 0.012},
		"openai.gpt-5.6-luna":                   {0.0002, 0.0012},
		"mistral.mistral-large-3-675b-instruct": {0.0005, 0.0015},
		"cohere.command-r-plus-v1:0":            {0.0025, 0.010},
		"cohere.command-r-v1:0":                 {0.00015, 0.0006},
	}

	// Strip the geo / global cross-Region inference prefix before looking up the rate
	modelId := p.subType
	for _, prefix := range []string{"global.", "us.", "eu.", "au.", "jp.", "apac."} {
		modelId = strings.TrimPrefix(modelId, prefix)
	}

	price, ok := prices[modelId]
	if !ok {
		modelResult.TotalPrice = 0
		modelResult.Currency = "USD"
		return nil
	}
	inputTokenPrice := float64(modelResult.PromptTokenCount) / 1000.0 * price.InputTokenPrice
	outputTokenPrice := float64(modelResult.ResponseTokenCount) / 1000.0 * price.OutputTokenPrice
	modelResult.TotalPrice = inputTokenPrice + outputTokenPrice
	modelResult.Currency = "USD"
	return nil
}

func (p *AmazonBedrockModelProvider) QueryText(question string, writer io.Writer, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion("us-west-2"))
	if err != nil {
		return nil, err
	}
	client := bedrockruntime.NewFromConfig(cfg)

	maxTokens := getContextLength(p.subType)

	requestBody, err := json.Marshal(map[string]interface{}{
		"prompt":      prompt + question,
		"temperature": p.temperature,
		"max_tokens":  maxTokens,
	})
	if err != nil {
		return nil, err
	}

	if strings.HasPrefix(question, "$OpenAgentDryRun$") {
		modelResult, err := getDefaultModelResult(p.subType, question, "")
		if err != nil {
			return nil, fmt.Errorf(i18n.Translate(lang, "model:cannot calculate tokens"))
		}
		if maxTokens > modelResult.TotalTokenCount {
			return modelResult, nil
		} else {
			return nil, fmt.Errorf(i18n.Translate(lang, "model:exceed max tokens"))
		}
	}

	resp, err := client.InvokeModel(context.TODO(), &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(p.subType),
		Body:        requestBody,
		ContentType: aws.String("application/json"),
	})
	if err != nil {
		return nil, err
	}

	var result struct {
		Generation string `json:"generation"`
	}
	if err := json.Unmarshal(resp.Body, &result); err != nil {
		return nil, err
	}

	_, err = writer.Write([]byte(result.Generation))
	if err != nil {
		return nil, err
	}

	modelResult, err := getDefaultModelResult(p.subType, question, result.Generation)
	if err != nil {
		return nil, err
	}

	if err := p.calculatePrice(modelResult, lang); err != nil {
		return nil, err
	}

	return modelResult, nil
}

func (a AmazonBedrockModelProvider) ListModels() ([]string, error) {
	return unsupportedListModels("Amazon Bedrock")
}
