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
	"net/http"
	"strings"

	"github.com/casibase/go-openrouter"
	"github.com/the-open-agent/openagent/i18n"
	"github.com/the-open-agent/openagent/proxy"
)

type OpenRouterModelProvider struct {
	subType     string
	secretKey   string
	siteName    string
	siteUrl     string
	temperature *float32
	topP        *float32
}

func NewOpenRouterModelProvider(subType string, secretKey string, temperature float32, topP float32) (*OpenRouterModelProvider, error) {
	p := &OpenRouterModelProvider{
		subType:     subType,
		secretKey:   secretKey,
		siteName:    "OpenAgent",
		siteUrl:     "https://openagentai.org",
		temperature: &temperature,
		topP:        &topP,
	}
	return p, nil
}

func (p *OpenRouterModelProvider) GetPricing() string {
	return `URL:
https://openrouter.ai/models

| Model Name                        | Prompt cost ($ per 1k tokens) | Completion cost ($ per 1k tokens) | Context (tokens) |
|-----------------------------------|-------------------------------|-----------------------------------|------------------|
| anthropic/claude-fable-5.1        | $0.01                         | $0.05                             | 1,000,000        |
| anthropic/claude-opus-5           | $0.005                        | $0.025                            | 1,000,000        |
| anthropic/claude-sonnet-5         | $0.002                        | $0.01                             | 1,000,000        |
| anthropic/claude-opus-4.8         | $0.005                        | $0.025                            | 1,000,000        |
| anthropic/claude-haiku-4.5        | $0.001                        | $0.005                            | 200,000          |
| openai/gpt-6-astra                | $0.01                         | $0.05                             | 1,050,000        |
| openai/gpt-5.6-sol                | $0.002                        | $0.01                             | 1,050,000        |
| openai/gpt-5.6-terra              | $0.002                        | $0.012                            | 1,050,000        |
| openai/gpt-5.6-luna               | $0.0002                       | $0.0012                           | 1,050,000        |
| openai/gpt-5.3-codex              | $0.00175                      | $0.014                            | 400,000          |
| google/gemini-3.8-flash           | $0.00075                      | $0.00375                          | 1,048,576        |
| google/gemini-3.1-pro-preview     | $0.002                        | $0.012                            | 1,048,576        |
| google/gemini-3.5-flash           | $0.0015                       | $0.009                            | 1,048,576        |
| deepseek/deepseek-v4-pro          | $0.0016                       | $0.0032                           | 1,048,576        |
| deepseek/deepseek-v4-flash        | $0.000089                     | $0.000177                         | 1,048,576        |
| deepseek/deepseek-v4.1-flash      | $0.00015                      | $0.0006                           | 1,048,576        |
| x-ai/grok-4.6                     | $0.002                        | $0.006                            | 500,000          |
| x-ai/grok-4.5                     | $0.002                        | $0.006                            | 500,000          |
| x-ai/grok-4.3                     | $0.00125                      | $0.0025                           | 1,000,000        |
| qwen/qwen3.8-max-0902             | $0.002                        | $0.006                            | 1,000,000        |
| qwen/qwen3.8-flash                | $0.00015                      | $0.00047                          | 1,000,000        |
| moonshotai/kimi-k3                | $0.003                        | $0.015                            | 1,048,576        |
| moonshotai/kimi-k2.7-code         | $0.00071                      | $0.00321                          | 262,144          |
| z-ai/glm-5.3                      | $0.0014                       | $0.0044                           | 1,310,720        |
| z-ai/glm-5.2                      | $0.0014                       | $0.0044                           | 1,048,576        |
| minimax/minimax-m3                | $0.0003                       | $0.0012                           | 1,048,576        |
| mistralai/mistral-medium-3-5      | $0.0015                       | $0.0075                           | 262,144          |
| mistralai/mistral-large-2512      | $0.0005                       | $0.0015                           | 262,144          |
| meta-llama/llama-4-maverick       | $0.00019                      | $0.00065                          | 1,048,576        |
| meta-llama/llama-3.3-70b-instruct | $0.0001                       | $0.00032                          | 131,072          |
`
}

func (p *OpenRouterModelProvider) calculatePrice(modelResult *ModelResult, lang string) error {
	// OpenRouter routes to hundreds of upstream models and reprices them independently, so a
	// model that is not in the table below reports price = 0 rather than failing the request.
	priceTable := map[string][]float64{
		"anthropic/claude-fable-5.1":        {0.01, 0.05},
		"anthropic/claude-opus-5":           {0.005, 0.025},
		"anthropic/claude-sonnet-5":         {0.002, 0.01},
		"anthropic/claude-opus-4.8":         {0.005, 0.025},
		"anthropic/claude-haiku-4.5":        {0.001, 0.005},
		"openai/gpt-6-astra":                {0.01, 0.05},
		"openai/gpt-5.6-sol":                {0.002, 0.01},
		"openai/gpt-5.6-terra":              {0.002, 0.012},
		"openai/gpt-5.6-luna":               {0.0002, 0.0012},
		"openai/gpt-5.3-codex":              {0.00175, 0.014},
		"google/gemini-3.8-flash":           {0.00075, 0.00375},
		"google/gemini-3.1-pro-preview":     {0.002, 0.012},
		"google/gemini-3.5-flash":           {0.0015, 0.009},
		"deepseek/deepseek-v4-pro":          {0.0016, 0.0032},
		"deepseek/deepseek-v4-flash":        {0.000089, 0.000177},
		"deepseek/deepseek-v4.1-flash":      {0.00015, 0.0006},
		"x-ai/grok-4.6":                     {0.002, 0.006},
		"x-ai/grok-4.5":                     {0.002, 0.006},
		"x-ai/grok-4.3":                     {0.00125, 0.0025},
		"qwen/qwen3.8-max-0902":             {0.002, 0.006},
		"qwen/qwen3.8-flash":                {0.00015, 0.00047},
		"moonshotai/kimi-k3":                {0.003, 0.015},
		"moonshotai/kimi-k2.7-code":         {0.00071, 0.00321},
		"z-ai/glm-5.3":                      {0.0014, 0.0044},
		"z-ai/glm-5.2":                      {0.0014, 0.0044},
		"minimax/minimax-m3":                {0.0003, 0.0012},
		"mistralai/mistral-medium-3-5":      {0.0015, 0.0075},
		"mistralai/mistral-large-2512":      {0.0005, 0.0015},
		"meta-llama/llama-4-maverick":       {0.00019, 0.00065},
		"meta-llama/llama-3.3-70b-instruct": {0.0001, 0.00032},
	}

	var inputPricePerThousandTokens, outputPricePerThousandTokens float64
	if priceItem, ok := priceTable[p.subType]; ok {
		inputPricePerThousandTokens = priceItem[0]
		outputPricePerThousandTokens = priceItem[1]
	}

	inputPrice := getPrice(modelResult.PromptTokenCount, inputPricePerThousandTokens)
	outputPrice := getPrice(modelResult.ResponseTokenCount, outputPricePerThousandTokens)
	modelResult.TotalPrice = AddPrices(inputPrice, outputPrice)
	modelResult.Currency = "USD"
	return nil
}

func (p *OpenRouterModelProvider) getProxyClientFromToken() *openrouter.Client {
	config, err := openrouter.DefaultConfig(p.secretKey, p.siteName, p.siteUrl)
	if err != nil {
		panic(err)
	}

	config.HTTPClient = proxy.ProxyHttpClient

	c := openrouter.NewClientWithConfig(config)
	return c
}

func (p *OpenRouterModelProvider) QueryText(question string, writer io.Writer, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	client := p.getProxyClientFromToken()

	ctx := context.Background()
	flusher, ok := writer.(http.Flusher)
	if !ok {
		return nil, fmt.Errorf(i18n.Translate(lang, "model:writer does not implement http.Flusher"))
	}

	model := p.subType
	if model == "" {
		model = openrouter.Gpt35Turbo
	}

	tokenCount, err := GetTokenSize(model, question)
	if err != nil {
		return nil, err
	}

	contextLength := getContextLength(p.subType)

	if strings.HasPrefix(question, "$OpenAgentDryRun$") {
		modelResult, err := getDefaultModelResult(model, question, "")
		if err != nil {
			return nil, fmt.Errorf(i18n.Translate(lang, "model:cannot calculate tokens"))
		}
		if contextLength > modelResult.TotalTokenCount {
			return modelResult, nil
		} else {
			return nil, fmt.Errorf(i18n.Translate(lang, "model:exceed max tokens"))
		}
	}

	maxTokens := contextLength - tokenCount
	if maxTokens < 0 {
		return nil, fmt.Errorf(i18n.Translate(lang, "model:The token count: [%d] exceeds the model: [%s]'s maximum token count: [%d]"), tokenCount, model, contextLength)
	}

	temperature := p.temperature
	topP := p.topP

	respStream, err := client.CreateChatCompletionStream(
		ctx,
		&openrouter.ChatCompletionRequest{
			Model: p.subType,
			Messages: []openrouter.ChatCompletionMessage{
				{
					Role:    openrouter.ChatMessageRoleSystem,
					Content: "You are a helpful assistant.",
				},
				{
					Role:    openrouter.ChatMessageRoleUser,
					Content: question,
				},
			},
			Stream:      false,
			Temperature: temperature,
			TopP:        topP,
			MaxTokens:   maxTokens,
		},
	)
	if err != nil {
		return nil, err
	}
	defer respStream.Close()

	responseStringBuilder := strings.Builder{}

	isLeadingReturn := true
	for {
		completion, streamErr := respStream.Recv()
		if streamErr != nil {
			if streamErr == io.EOF {
				break
			}
			return nil, streamErr
		}

		data := completion.Choices[0].Message.Content
		if isLeadingReturn && len(data) != 0 {
			if strings.Count(data, "\n") == len(data) {
				continue
			} else {
				isLeadingReturn = false
			}
		}

		if _, err = fmt.Fprintf(writer, "event: message\ndata: %s\n\n", data); err != nil {
			return nil, err
		}

		// save the response for token count
		_, _ = responseStringBuilder.WriteString(data)

		flusher.Flush()
	}

	modelResult, err := getDefaultModelResult(p.subType, question, responseStringBuilder.String())
	if err != nil {
		return nil, err
	}

	err = p.calculatePrice(modelResult, lang)
	if err != nil {
		return nil, err
	}

	return modelResult, nil
}

func (p *OpenRouterModelProvider) ListModels() ([]string, error) {
	url := "https://openrouter.ai/api/v1/models"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return []string{}, err
	}

	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(p.secretKey))
	req.Header.Set("HTTP-Referer", p.siteUrl)
	req.Header.Set("X-Title", p.siteName)

	resp, err := newListModelsHTTPClient().Do(req)
	if err != nil {
		return []string{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return []string{}, fmt.Errorf("openrouter: ListModels() error: status code %d", resp.StatusCode)
	}

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return []string{}, err
	}

	models := []string{}
	for _, m := range result.Data {
		models = append(models, m.ID)
	}
	return models, nil
}
