// Copyright 2024 The OpenAgent Authors. All Rights Reserved.
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
	"net/http"
	"regexp"
	"strings"

	"github.com/beego/beego/logs"
	"github.com/the-open-agent/openagent/i18n"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
	"github.com/volcengine/volcengine-go-sdk/volcengine"
)

type VolcengineModelProvider struct {
	subType        string
	endpointID     string
	apiKey         string
	temperature    float32
	topP           float32
	enableThinking bool
}

func NewVolcengineModelProvider(subType string, endpointID string, apiKey string, temperature float32, topP float32, enableThinking bool) (*VolcengineModelProvider, error) {
	return &VolcengineModelProvider{
		subType:        subType,
		endpointID:     endpointID,
		apiKey:         apiKey,
		temperature:    temperature,
		topP:           topP,
		enableThinking: enableThinking,
	}, nil
}

func trimModelDate(subType string) string {
	// change "doubao-seed-2-0-pro-260215" to "doubao-seed-2-0-pro"
	re := regexp.MustCompile(`-\d{6}$`)
	return re.ReplaceAllString(subType, "")
}

func (p *VolcengineModelProvider) GetPricing() string {
	return `URL:
https://www.volcengine.com/docs/82379/1544106

| Model ID                              | Input Price per 1M tokens (yuan) | Output Price per 1M tokens (yuan) |
|---------------------------------------|----------------------------------|-----------------------------------|
| doubao-seed-evolving                  | 6.0                              | 30.0                              |
| doubao-seed-2-1-pro-260915            | 6.0                              | 30.0                              |
| doubao-seed-2-1-pro-260628            | 6.0                              | 30.0                              |
| doubao-seed-2-1-turbo-260628          | 3.0                              | 15.0                              |
| doubao-seed-2-0-pro-260215            | 3.2                              | 16.0                              |
| doubao-seed-2-0-lite-260428           | 0.6                              | 3.6                               |
| doubao-seed-2-0-lite-260215           | 0.6                              | 3.6                               |
| doubao-seed-2-0-mini-260428           | 0.2                              | 2.0                               |
| doubao-seed-2-0-mini-260215           | 0.2                              | 2.0                               |
| doubao-seed-2-0-code-preview-260215   | 3.2                              | 16.0                              |
| doubao-seed-1-8-251228                | 0.8                              | 2.0                               |
| doubao-seed-character-260628          | 0.8                              | 2.0                               |
| doubao-seed-character-251128          | 0.8                              | 2.0                               |
| doubao-seed-code-preview-251028       | 1.2                              | 8.0                               |
| doubao-seed-1-6-251015                | 0.8                              | 2.0                               |
| doubao-seed-1-6-flash-250828          | 0.15                             | 1.5                               |
| doubao-seed-1-6-vision-250815         | 0.8                              | 8.0                               |
| doubao-seed-translation-250915        | 1.2                              | 3.6                               |
| doubao-1-5-pro-32k-250115             | 0.8                              | 2.0                               |
| doubao-1-5-pro-32k-character-250715   | 0.8                              | 2.0                               |
| doubao-1-5-lite-32k-250115            | 0.3                              | 0.6                               |
| doubao-1-5-vision-pro-32k-250115      | 3.0                              | 9.0                               |
| glm-5-3-flash-260828                  | 0.8                              | 2.8                               |
| glm-5-2-260617                        | 8.0                              | 28.0                              |
| glm-4-7-251222                        | 2.0                              | 8.0                               |
| deepseek-v4-1-flash-260910            | 2.0 (peak) / 1.0 (off-peak)      | 8.0 (peak) / 4.0 (off-peak)       |
| deepseek-v4-pro-ga-260813             | 9.0                              | 27.0                              |
| deepseek-v4-flash-ga-260731           | 3.0                              | 9.0                               |
| deepseek-v4-pro-260425                | 9.0                              | 27.0                              |
| deepseek-v4-flash-260425              | 3.0                              | 9.0                               |
| doubao-seedance-2-5-260628            | 70.0                             | 0.0                               |
| doubao-seedance-2-0-260128            | 46.0                             | 0.0                               |
| doubao-seedance-2-0-fast-260128       | 37.0                             | 0.0                               |
| doubao-seedance-2-0-mini-260615       | 23.0                             | 0.0                               |
| doubao-seedance-1-5-pro-251215        | 16.0                             | 0.0                               |
| doubao-seedance-1-0-pro-250528        | 15.0                             | 0.0                               |
| doubao-seedance-1-0-pro-fast-251015   | 4.2                              | 0.0                               |
| doubao-seedream-5-0-pro-260628        | 0.30 yuan/image                  | 0.0                               |
| doubao-seedream-5-0-260128            | 0.22 yuan/image                  | 0.0                               |
| doubao-seedream-5-0-lite-260128       | 0.22 yuan/image                  | 0.0                               |
| doubao-seedream-4-5-251128            | 0.25 yuan/image                  | 0.0                               |
| doubao-seedream-4-0-250828            | 0.20 yuan/image                  | 0.0                               |
| doubao-embedding-vision-251215        | 0.7 (text) / 1.8 (image)         | 0.0                               |
| doubao-embedding-vision-250615        | 0.7 (text) / 1.8 (image)         | 0.0                               |
`
}

func (p *VolcengineModelProvider) calculatePrice(modelResult *ModelResult, lang string) error {
	price := 0.0
	priceTable := map[string][2]float64{
		// Seed 2.1 series and the rolling "evolving" model - actual Model IDs (date stripped), yuan per 1K tokens, base tier
		"doubao-seed-evolving":  {0.0060, 0.0300},
		"doubao-seed-2-1-pro":   {0.0060, 0.0300},
		"doubao-seed-2-1-turbo": {0.0030, 0.0150},
		// Seed 2.0 series
		"doubao-seed-2-0-pro":          {0.0032, 0.0160},
		"doubao-seed-2-0-lite":         {0.0006, 0.0036},
		"doubao-seed-2-0-mini":         {0.0002, 0.0020},
		"doubao-seed-2-0-code-preview": {0.0032, 0.0160},
		// Seed 1.8 / character / code
		"doubao-seed-1-8":          {0.0008, 0.0020},
		"doubao-seed-character":    {0.0008, 0.0020},
		"doubao-seed-code-preview": {0.0012, 0.0080},
		// Seed 1.6 series
		"doubao-seed-1-6":         {0.0008, 0.0020},
		"doubao-seed-1-6-flash":   {0.00015, 0.0015},
		"doubao-seed-1-6-vision":  {0.0008, 0.0080},
		"doubao-seed-translation": {0.0012, 0.0036},
		// Doubao 1.5 series
		"doubao-1-5-pro-32k":           {0.0008, 0.0020},
		"doubao-1-5-pro-32k-character": {0.0008, 0.0020},
		"doubao-1-5-lite-32k":          {0.0003, 0.0006},
		"doubao-1-5-vision-pro-32k":    {0.0030, 0.0090},
		// GLM models
		"glm-5-3-flash": {0.0008, 0.0028},
		"glm-5-2":       {0.0080, 0.0280},
		"glm-4-7":       {0.0020, 0.0080},
		// DeepSeek models, deepseek-v4-1-flash is charged at its peak-hour rate
		"deepseek-v4-1-flash":  {0.0020, 0.0080},
		"deepseek-v4-pro-ga":   {0.0090, 0.0270},
		"deepseek-v4-flash-ga": {0.0030, 0.0090},
		"deepseek-v4-pro":      {0.0090, 0.0270},
		"deepseek-v4-flash":    {0.0030, 0.0090},
		// Video generation models (per 1M tokens, input-only billing)
		"doubao-seedance-2-5":          {0.0700, 0.0},
		"doubao-seedance-2-0":          {0.0460, 0.0},
		"doubao-seedance-2-0-fast":     {0.0370, 0.0},
		"doubao-seedance-2-0-mini":     {0.0230, 0.0},
		"doubao-seedance-1-5-pro":      {0.0160, 0.0},
		"doubao-seedance-1-0-pro":      {0.0150, 0.0},
		"doubao-seedance-1-0-pro-fast": {0.0042, 0.0},
		// Embedding models
		"doubao-embedding-vision": {0.0007, 0.0},
		// Legacy models, delisted from the Ark model list but kept so existing providers keep working
		"doubao-pro-32k":               {0.0008, 0.0020},
		"doubao-seed-1-6-lite":         {0.0003, 0.0006},
		"deepseek-v3-2":                {0.0020, 0.0030},
		"deepseek-v3-1-terminus":       {0.0040, 0.0120},
		"deepseek-v3":                  {0.0020, 0.0080},
		"deepseek-r1":                  {0.0040, 0.0160},
		"doubao-seedance-1-0-lite-t2v": {0.0100, 0.0},
		"doubao-seedance-1-0-lite-i2v": {0.0100, 0.0},
		// Backward-compatible aliases (old dot-notation and legacy hyphen names)
		"doubao-seed-2.1-pro":          {0.0060, 0.0300},
		"doubao-seed-2.1-turbo":        {0.0030, 0.0150},
		"doubao-seed-2.0-pro":          {0.0032, 0.0160},
		"doubao-seed-2.0-lite":         {0.0006, 0.0036},
		"doubao-seed-2.0-mini":         {0.0002, 0.0020},
		"doubao-seed-2.0-code":         {0.0032, 0.0160},
		"doubao-seed-1.8":              {0.0008, 0.0020},
		"doubao-seed-code":             {0.0012, 0.0080},
		"doubao-seed-1.6":              {0.0008, 0.0020},
		"doubao-seed-1.6-lite":         {0.0003, 0.0006},
		"doubao-seed-1.6-flash":        {0.00015, 0.0015},
		"doubao-seed-1.6-vision":       {0.0008, 0.0080},
		"doubao-1.5-pro-32k":           {0.0008, 0.0020},
		"doubao-1.5-lite-32k":          {0.0003, 0.0006},
		"doubao-1.5-vision-pro":        {0.0030, 0.0090},
		"glm-5.3-flash":                {0.0008, 0.0028},
		"glm-5.2":                      {0.0080, 0.0280},
		"glm-4.7":                      {0.0020, 0.0080},
		"deepseek-v3.2":                {0.0020, 0.0030},
		"deepseek-v3.1":                {0.0040, 0.0120},
		"doubao-seedance-2.5":          {0.0700, 0.0},
		"doubao-seedance-2.0":          {0.0460, 0.0},
		"doubao-seedance-2.0-fast":     {0.0370, 0.0},
		"doubao-seedance-2.0-mini":     {0.0230, 0.0},
		"doubao-seedance-1.5-pro":      {0.0160, 0.0},
		"doubao-seedance-1.0-pro":      {0.0150, 0.0},
		"doubao-seedance-1.0-pro-fast": {0.0042, 0.0},
		"doubao-seedance-1.0-lite":     {0.0100, 0.0},
	}

	subType := trimModelDate(p.subType)

	// Special handling for image generation models (billed per image)
	switch subType {
	case "doubao-seedream-5-0-pro", "doubao-seedream-5.0-pro":
		modelResult.TotalPrice = float64(modelResult.ImageCount) * 0.3
		modelResult.Currency = "CNY"
		return nil
	case "doubao-seedream-5-0", "doubao-seedream-5-0-lite", "doubao-seedream-5.0-lite":
		modelResult.TotalPrice = float64(modelResult.ImageCount) * 0.22
		modelResult.Currency = "CNY"
		return nil
	case "doubao-seedream-4-5", "doubao-seedream-4.5":
		modelResult.TotalPrice = float64(modelResult.ImageCount) * 0.25
		modelResult.Currency = "CNY"
		return nil
	case "doubao-seedream-4-0", "doubao-seedream-4.0":
		modelResult.TotalPrice = float64(modelResult.ImageCount) * 0.2
		modelResult.Currency = "CNY"
		return nil
	// Legacy, delisted from the Ark model list but kept so existing providers keep working
	case "doubao-seedream-3-0-t2i", "doubao-seedream-3.0-t2i":
		modelResult.TotalPrice = float64(modelResult.ImageCount) * 0.259
		modelResult.Currency = "CNY"
		return nil
	}

	if priceItem, ok := priceTable[subType]; ok {
		inputPrice := getPrice(modelResult.PromptTokenCount, priceItem[0])
		outputPrice := getPrice(modelResult.ResponseTokenCount, priceItem[1])
		price = inputPrice + outputPrice
	} else {
		return fmt.Errorf(i18n.Translate(lang, "embedding:calculatePrice() error: unknown model type: %s"), subType)
	}

	modelResult.TotalPrice = price
	modelResult.Currency = "CNY"
	return nil
}

func (p *VolcengineModelProvider) buildMessages(question string, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage) []*model.ChatCompletionMessage {
	var messages []*model.ChatCompletionMessage

	if prompt != "" {
		messages = append(messages, &model.ChatCompletionMessage{
			Role:    model.ChatMessageRoleSystem,
			Content: &model.ChatCompletionMessageContent{StringValue: volcengine.String(prompt)},
		})
	}

	for _, knowledge := range knowledgeMessages {
		messages = append(messages, &model.ChatCompletionMessage{
			Role:    model.ChatMessageRoleSystem,
			Content: &model.ChatCompletionMessageContent{StringValue: volcengine.String(knowledge.Text)},
		})
	}

	for _, msg := range history {
		role := model.ChatMessageRoleUser
		if msg.Author == "AI" {
			role = model.ChatMessageRoleAssistant
		}
		messages = append(messages, &model.ChatCompletionMessage{
			Role:    role,
			Content: &model.ChatCompletionMessageContent{StringValue: volcengine.String(msg.Text)},
		})
	}

	messages = append(messages, &model.ChatCompletionMessage{
		Role:    model.ChatMessageRoleUser,
		Content: &model.ChatCompletionMessageContent{StringValue: volcengine.String(question)},
	})

	return messages
}

func (p *VolcengineModelProvider) QueryText(question string, writer io.Writer, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	ctx := context.Background()
	flusher, ok := writer.(http.Flusher)
	if !ok {
		return nil, fmt.Errorf(i18n.Translate(lang, "model:writer does not implement http.Flusher"))
	}

	client := arkruntime.NewClientWithApiKey(p.apiKey)

	messages := p.buildMessages(question, history, prompt, knowledgeMessages)

	request := model.CreateChatCompletionRequest{
		Model:         p.subType,
		Messages:      messages,
		Temperature:   &p.temperature,
		TopP:          &p.topP,
		StreamOptions: &model.StreamOptions{IncludeUsage: true},
	}

	thinkingType := model.ThinkingTypeDisabled
	if p.enableThinking {
		thinkingType = model.ThinkingTypeEnabled
	}
	request.Thinking = &model.Thinking{Type: thinkingType}

	flushData := func(data, eventType string) error {
		if _, err := fmt.Fprintf(writer, "event: %s\ndata: %s\n\n", eventType, data); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	stream, err := client.CreateChatCompletionStream(ctx, request)
	if err != nil {
		logs.Error("stream chat error: %v", err)
		return nil, err
	}
	defer stream.Close()

	modelResult := newModelResult(0, 0, 0)
	var reasoningData strings.Builder
	isLeadingReturn := true

	for {
		response, recvErr := stream.Recv()

		if response.Usage != nil {
			modelResult.PromptTokenCount += response.Usage.PromptTokens
			modelResult.ResponseTokenCount += response.Usage.CompletionTokens
			modelResult.TotalTokenCount += response.Usage.TotalTokens
		}

		if recvErr != nil {
			if recvErr == io.EOF {
				break
			}
			return nil, recvErr
		}

		if len(response.Choices) == 0 {
			continue
		}

		delta := response.Choices[0].Delta

		// Stream reasoning/thinking content
		if delta.ReasoningContent != nil && *delta.ReasoningContent != "" {
			reasoningData.WriteString(*delta.ReasoningContent)
			if err = flushData(*delta.ReasoningContent, "reason"); err != nil {
				return nil, err
			}
		}

		// Stream regular content, skipping leading newlines
		if delta.Content != "" {
			if isLeadingReturn {
				if strings.Count(delta.Content, "\n") == len(delta.Content) {
					continue
				}
				isLeadingReturn = false
			}
			if err = flushData(delta.Content, "message"); err != nil {
				return nil, err
			}
		}
	}

	if toolSession != nil && toolSession.ToolMessages != nil {
		toolSession.ToolMessages.ReasoningContent = reasoningData.String()
	}

	err = p.calculatePrice(modelResult, lang)
	if err != nil {
		return nil, err
	}

	return modelResult, nil
}

func (p *VolcengineModelProvider) ListModels() ([]string, error) {
	return unsupportedListModels("Volcano Engine")
}
