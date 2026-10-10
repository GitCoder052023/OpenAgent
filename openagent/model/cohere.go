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
	"fmt"
	"io"
	"strings"

	cohere "github.com/cohere-ai/cohere-go/v2"
	cohereclient "github.com/cohere-ai/cohere-go/v2/client"
	"github.com/the-open-agent/openagent/i18n"
)

// https://docs.cohere.com/docs/command-beta#whats-the-context-window-on-the-command-models
var CohereDefaultTemperature float64 = 0.75

type CohereModelProvider struct {
	secretKey   string
	subType     string
	temperature float64
	maxTokens   int
	verbose     bool
	stop        []string
}

func NewCohereModelProvider(subType string, secretKey string) (*CohereModelProvider, error) {
	return &CohereModelProvider{
		secretKey: secretKey,
		subType:   subType,
	}, nil
}

// GetPricing returns the pricing of the model
// https://cohere.com/pricing
func (c *CohereModelProvider) GetPricing() string {
	return `URL:
https://cohere.com/pricing

Command models:

| Model                       | Input Price (Per 1,000,000 tokens) | Output Price (Per 1,000,000 tokens) |
|-----------------------------|------------------------------------|-------------------------------------|
| command-a-plus-05-2026      | contact Cohere sales               | contact Cohere sales                |
| command-a-03-2025           | contact Cohere sales               | contact Cohere sales                |
| command-a-reasoning-08-2025 | contact Cohere sales               | contact Cohere sales                |
| command-a-vision-07-2025    | contact Cohere sales               | contact Cohere sales                |
| command-a-translate-08-2025 | contact Cohere sales               | contact Cohere sales                |
| command-r7b-12-2024         | $0.0375                            | $0.15                               |
| command-r-08-2024           | $0.15                              | $0.60                               |
| command-r-plus-08-2024      | $2.50                              | $10.00                              |

Embed Model:

| Model      | Cost (Per 1,000,000 tokens) |
|------------|-----------------------------|
| embed-v4.0 | $0.12                       |
`
}

func (p *CohereModelProvider) calculatePrice(modelResult *ModelResult, lang string) error {
	// Cohere no longer publishes per-token rates for the Command A family (they are quoted
	// per contract), so those models report price = 0 instead of failing the request.
	priceTable := map[string][2]float64{
		"command-r7b-12-2024":    {0.0000375, 0.00015},
		"command-r-08-2024":      {0.00015, 0.0006},
		"command-r-plus-08-2024": {0.0025, 0.01},
	}

	price := 0.0
	if priceItem, ok := priceTable[p.subType]; ok {
		inputPrice := getPrice(modelResult.PromptTokenCount, priceItem[0])
		outputPrice := getPrice(modelResult.ResponseTokenCount, priceItem[1])
		price = AddPrices(inputPrice, outputPrice)
	}

	modelResult.TotalPrice = price
	modelResult.Currency = "USD"
	return nil
}

func (p *CohereModelProvider) QueryText(message string, writer io.Writer, chat_history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	client := cohereclient.NewClient(
		cohereclient.WithToken(p.secretKey),
	)
	ctx := context.Background()

	// if p.maxTokens > 0, use p.maxTokens, otherwise use model's default Maxtokens
	maxTokens := getContextLength(p.subType)
	if strings.HasPrefix(message, "$OpenAgentDryRun$") {
		modelResult, err := getDefaultModelResult(p.subType, message, "")
		if err != nil {
			return nil, fmt.Errorf(i18n.Translate(lang, "model:cannot calculate tokens"))
		}
		if maxTokens > modelResult.TotalTokenCount {
			return modelResult, nil
		} else {
			return nil, fmt.Errorf(i18n.Translate(lang, "model:exceed max tokens"))
		}
	}
	// The legacy Generate endpoint was retired together with the "command" / "command-light"
	// models, so the current Command models are called through the Chat endpoint.
	var chatHistory []*cohere.ChatMessage
	for i := len(chat_history) - 1; i >= 0; i-- {
		historyMessage := chat_history[i]
		role := cohere.ChatMessageRoleChatbot
		if historyMessage.Author == "AI" {
			role = cohere.ChatMessageRoleChatbot
		} else {
			role = cohere.ChatMessageRoleUser
		}
		chatHistory = append(chatHistory, &cohere.ChatMessage{
			Role:    role,
			Message: historyMessage.Text,
		})
	}

	var preamble *string
	if prompt != "" {
		preamble = &prompt
	}

	response, err := client.Chat(
		ctx,
		&cohere.ChatRequest{
			Message:          message,
			Model:            &p.subType,
			Temperature:      &CohereDefaultTemperature,
			MaxTokens:        &maxTokens,
			ChatHistory:      chatHistory,
			PreambleOverride: preamble,
		},
	)
	if err != nil {
		return nil, err
	}

	output := response.Text
	_, err = fmt.Fprint(writer, output)
	if err != nil {
		return nil, err
	}

	modelResult, err := getDefaultModelResult(p.subType, message, output)
	if err != nil {
		return nil, err
	}

	err = p.calculatePrice(modelResult, lang)
	if err != nil {
		return nil, err
	}

	return modelResult, nil
}

func (c *CohereModelProvider) ListModels() ([]string, error) {
	return unsupportedListModels("Cohere")
}
