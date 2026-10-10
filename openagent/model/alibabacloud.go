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
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/casibase/dashscopego"
	"github.com/casibase/dashscopego/qwen"
	dashscopesdk "github.com/the-open-agent/dashscope-go-sdk"
	"github.com/the-open-agent/dashscope-go-sdk/wanx"
	"github.com/the-open-agent/openagent/i18n"
)

type AlibabacloudModelProvider struct {
	subType     string
	apiKey      string
	temperature float32
	topP        float32
}

func NewAlibabacloudModelProvider(subType string, apiKey string, temperature float32, topP float32) (*AlibabacloudModelProvider, error) {
	return &AlibabacloudModelProvider{
		subType:     subType,
		apiKey:      apiKey,
		temperature: temperature,
		topP:        topP,
	}, nil
}

// Wan (formerly Wanxiang) and Qwen-Image are the image / video generation model families.
func isWanxModel(subType string) bool {
	return strings.HasPrefix(subType, "wan2.") ||
		strings.HasPrefix(subType, "wan3.") ||
		strings.HasPrefix(subType, "wanx") ||
		strings.HasPrefix(subType, "qwen-image") ||
		strings.HasPrefix(subType, "z-image")
}

// The newer image models are only served by the multimodal generation API, the
// text2image image synthesis API rejects them with "url error".
func isMultimodalImageModel(subType string) bool {
	return strings.HasPrefix(subType, "qwen-image-") ||
		strings.HasPrefix(subType, "wan2.6-image") ||
		strings.HasPrefix(subType, "wan2.7-image") ||
		strings.HasPrefix(subType, "z-image")
}

// Models with native image and video input are only served by the OpenAI-compatible
// endpoint, the DashScope text generation API cannot call them.
func isQwenMultimodalModel(subType string) bool {
	return strings.HasPrefix(subType, "qwen3.8-max") ||
		strings.HasPrefix(subType, "qwen3.8-flash") ||
		strings.HasPrefix(subType, "qwen3.8-27b") ||
		strings.HasPrefix(subType, "qwen3.7-plus") ||
		strings.HasPrefix(subType, "qwen3.7-flash") ||
		strings.HasPrefix(subType, "qwen3.6-") ||
		strings.HasPrefix(subType, "qwen3.5-omni") ||
		strings.HasPrefix(subType, "qwen3-vl-")
}

func (p *AlibabacloudModelProvider) GetPricing() string {
	return `URL:
https://help.aliyun.com/zh/model-studio/billing-for-model-studio

| Model               | sub-type                        | Input Price per 1K tokens        | Output Price per 1K tokens     |
|---------------------|---------------------------------|----------------------------------|--------------------------------|
| Qwen3.8 Max         | qwen3.8-max                     | 0.012yuan/1,000 tokens           | 0.036yuan/1,000 tokens         |
| Qwen3.8 Flash       | qwen3.8-flash                   | 0.0008yuan/1,000 tokens          | 0.0027yuan/1,000 tokens        |
| Qwen3.7 Max         | qwen3.7-max                     | 0.012yuan/1,000 tokens           | 0.036yuan/1,000 tokens         |
| Qwen3.7 Plus        | qwen3.7-plus                    | tiered, from 0.002yuan/1,000 tokens | tiered, from 0.008yuan/1,000 tokens |
| Qwen3.7 Flash       | qwen3.7-flash                   | tiered, from 0.0002yuan/1,000 tokens | tiered, from 0.0008yuan/1,000 tokens |
| Qwen3.6 Plus        | qwen3.6-plus                    | tiered, from 0.002yuan/1,000 tokens | tiered, from 0.012yuan/1,000 tokens |
| Qwen3.6 Flash       | qwen3.6-flash                   | tiered, from 0.0012yuan/1,000 tokens | tiered, from 0.0072yuan/1,000 tokens |
| Qwen-Max            | qwen-max                        | 0.0024yuan/1,000 tokens          | 0.0096yuan/1,000 tokens        |
| Qwen-Plus           | qwen-plus                       | tiered, from 0.0008yuan/1,000 tokens | tiered, from 0.002yuan/1,000 tokens |
| Qwen-Flash          | qwen-flash                      | tiered, from 0.00015yuan/1,000 tokens | tiered, from 0.0015yuan/1,000 tokens |
| Qwen-Long           | qwen-long                       | 0.0005yuan/1,000 tokens          | 0.002yuan/1,000 tokens         |
| Qwen3-VL Plus       | qwen3-vl-plus                   | tiered, from 0.001yuan/1,000 tokens | tiered, from 0.010yuan/1,000 tokens |
| Qwen3-VL Flash      | qwen3-vl-flash                  | tiered, from 0.00015yuan/1,000 tokens | tiered, from 0.0015yuan/1,000 tokens |
| Qwen3.5 Omni Plus   | qwen3.5-omni-plus               | see Model Studio pricing page    | see Model Studio pricing page  |
| Qwen3.8-2.4T-A95B   | qwen3.8-2.4t-a95b               | 0.012yuan/1,000 tokens           | 0.036yuan/1,000 tokens         |
| Qwen3.8-27B         | qwen3.8-27b                     | 0.003yuan/1,000 tokens           | 0.012yuan/1,000 tokens         |
| Qwen3.6-27B         | qwen3.6-27b                     | 0.003yuan/1,000 tokens           | 0.018yuan/1,000 tokens         |
| Qwen3.6-35B-A3B     | qwen3.6-35b-a3b                 | 0.0018yuan/1,000 tokens          | 0.0108yuan/1,000 tokens        |
| Qwen3-235B-A22B     | qwen3-235b-a22b                 | 0.002yuan/1,000 tokens           | 0.008yuan/1,000 tokens         |
| Qwen3-32B           | qwen3-32b                       | 0.002yuan/1,000 tokens           | 0.008yuan/1,000 tokens         |
| DeepSeek-R1         | deepseek-r1                     | 0.004yuan/1,000 tokens           | 0.016yuan/1,000 tokens         |
| DeepSeek-V3         | deepseek-v3                     | 0.002yuan/1,000 tokens           | 0.008yuan/1,000 tokens         |
| DeepSeek-V3.1       | deepseek-v3.1                   | 0.004yuan/1,000 tokens           | 0.012yuan/1,000 tokens         |
| DeepSeek-V3.2       | deepseek-v3.2                   | 0.002yuan/1,000 tokens           | 0.003yuan/1,000 tokens         |
| DeepSeek-R1-Distill | deepseek-r1-distill-qwen-1.5b   | 0.000yuan/1,000 tokens           | 0.000yuan/1,000 tokens         |
| DeepSeek-R1-Distill | deepseek-r1-distill-qwen-7b     | 0.0005yuan/1,000 tokens          | 0.001yuan/1,000 tokens         |
| DeepSeek-R1-Distill | deepseek-r1-distill-qwen-14b    | 0.001yuan/1,000 tokens           | 0.003yuan/1,000 tokens         |
| DeepSeek-R1-Distill | deepseek-r1-distill-qwen-32b    | 0.002yuan/1,000 tokens           | 0.006yuan/1,000 tokens         |
| DeepSeek-R1-Distill | deepseek-r1-distill-llama-8b    | 0.000yuan/1,000 tokens           | 0.000yuan/1,000 tokens         |
| DeepSeek-R1-Distill | deepseek-r1-distill-llama-70b   | 0.000yuan/1,000 tokens           | 0.000yuan/1,000 tokens         |

Image and video generation models:
| Model                 | sub-type                  | Price per image |
|-----------------------|---------------------------|-----------------|
| Qwen-Image 3.0 Pro    | qwen-image-3.0-pro        | see Model Studio pricing page |
| Wan2.7 Image Pro      | wan2.7-image-pro          | see Model Studio pricing page |
| Wan3.0 Video          | wan3.0-video              | see Model Studio pricing page |
`
}

func (p *AlibabacloudModelProvider) calculatePrice(modelResult *ModelResult, lang string) error {
	price := 0.0

	if isWanxModel(p.subType) {
		// Alibaba Cloud prices the Wan / Qwen-Image models per image and per resolution tier;
		// 0.04 yuan/image is used as the baseline when a model has no entry here.
		imagePriceTable := map[string]float64{
			"qwen-image-3.0-pro": 0.25,
			"qwen-image-3.0":     0.18,
			"wan2.7-image-pro":   0.50,
			"wan2.7-image":       0.20,
			"wan2.6-image":       0.20,
			"wan2.2-t2i-plus":    0.20,
			"wan2.2-t2i-flash":   0.14,
			"wanx2.1-t2i-plus":   0.20,
			"wanx2.1-t2i-turbo":  0.14,
		}
		unitPrice, ok := imagePriceTable[p.subType]
		if !ok {
			unitPrice = 0.04
		}
		price = float64(modelResult.ImageCount) * unitPrice
		modelResult.TotalPrice = price
		modelResult.Currency = "CNY"
		return nil
	}

	if priceItem, ok := getAlibabacloudTieredPrice(p.subType, modelResult.PromptTokenCount); ok {
		inputPrice := getPrice(modelResult.PromptTokenCount, priceItem[0])
		outputPrice := getPrice(modelResult.ResponseTokenCount, priceItem[1])
		modelResult.TotalPrice = inputPrice + outputPrice
		modelResult.Currency = "CNY"
		return nil
	}

	// Prices are CNY per 1K tokens, converted from Alibaba Model Studio
	// per-1M-token pricing: https://help.aliyun.com/zh/model-studio/model-pricing (checked 2026-09-07).
	priceTable := map[string][2]float64{
		"qwen3.8-max":                   {0.012, 0.036},
		"qwen3.8-flash":                 {0.0008, 0.0027},
		"qwen3.7-max":                   {0.012, 0.036},
		"qwen-max":                      {0.0024, 0.0096},
		"qwen-long":                     {0.0005, 0.002},
		"qwen3.8-2.4t-a95b":             {0.012, 0.036},
		"qwen3.8-27b":                   {0.003, 0.012},
		"qwen3.6-27b":                   {0.003, 0.018},
		"qwen3.6-35b-a3b":               {0.0018, 0.0108},
		"qwen3-235b-a22b":               {0.002, 0.008},
		"qwen3-32b":                     {0.002, 0.008},
		"deepseek-r1":                   {0.004, 0.016},
		"deepseek-v3":                   {0.002, 0.008},
		"deepseek-v3.1":                 {0.004, 0.012},
		"deepseek-v3.2":                 {0.002, 0.003},
		"deepseek-r1-distill-qwen-1.5b": {0.000, 0.000},
		"deepseek-r1-distill-qwen-7b":   {0.001, 0.003},
		"deepseek-r1-distill-qwen-14b ": {0.002, 0.006},
		"deepseek-r1-distill-qwen-32b":  {0.000, 0.000},
		"deepseek-r1-distill-llama-8b":  {0.000, 0.000},
	}

	// Model Studio adds models faster than this table can track (and prices some, such as the
	// omni models, per modality), so a model without an entry reports price = 0 instead of
	// failing the request.
	if priceItem, ok := priceTable[p.subType]; ok {
		inputPrice := getPrice(modelResult.PromptTokenCount, priceItem[0])
		outputPrice := getPrice(modelResult.ResponseTokenCount, priceItem[1])
		price = inputPrice + outputPrice
	}

	modelResult.TotalPrice = price
	modelResult.Currency = "CNY"
	return nil
}

// Tiered prices are CNY per 1K tokens, converted from Alibaba Model Studio
// per-1M-token pricing: https://help.aliyun.com/zh/model-studio/model-pricing (checked 2026-09-07).
func getAlibabacloudTieredPrice(subType string, promptTokenCount int) ([2]float64, bool) {
	switch {
	case strings.HasPrefix(subType, "qwen3.7-plus"):
		if promptTokenCount > 256000 {
			return [2]float64{0.006, 0.024}, true
		}
		return [2]float64{0.002, 0.008}, true
	case strings.HasPrefix(subType, "qwen3.7-flash"):
		if promptTokenCount > 256000 {
			return [2]float64{0.0012, 0.0048}, true
		} else if promptTokenCount > 32000 {
			return [2]float64{0.0006, 0.0024}, true
		}
		return [2]float64{0.0002, 0.0008}, true
	case strings.HasPrefix(subType, "qwen3.6-plus"):
		if promptTokenCount > 256000 {
			return [2]float64{0.008, 0.048}, true
		}
		return [2]float64{0.002, 0.012}, true
	case strings.HasPrefix(subType, "qwen3.6-flash"):
		if promptTokenCount > 256000 {
			return [2]float64{0.0048, 0.0288}, true
		}
		return [2]float64{0.0012, 0.0072}, true
	case strings.HasPrefix(subType, "qwen-plus"):
		if promptTokenCount > 256000 {
			return [2]float64{0.0048, 0.048}, true
		} else if promptTokenCount > 128000 {
			return [2]float64{0.0024, 0.020}, true
		}
		return [2]float64{0.0008, 0.002}, true
	case strings.HasPrefix(subType, "qwen-flash"):
		if promptTokenCount > 256000 {
			return [2]float64{0.0012, 0.012}, true
		} else if promptTokenCount > 128000 {
			return [2]float64{0.0006, 0.006}, true
		}
		return [2]float64{0.00015, 0.0015}, true
	case strings.HasPrefix(subType, "qwen3-vl-plus"):
		if promptTokenCount > 128000 {
			return [2]float64{0.003, 0.030}, true
		} else if promptTokenCount > 32000 {
			return [2]float64{0.0015, 0.015}, true
		}
		return [2]float64{0.001, 0.010}, true
	case strings.HasPrefix(subType, "qwen3-vl-flash"):
		if promptTokenCount > 128000 {
			return [2]float64{0.0006, 0.006}, true
		} else if promptTokenCount > 32000 {
			return [2]float64{0.0003, 0.003}, true
		}
		return [2]float64{0.00015, 0.0015}, true
	}
	return [2]float64{}, false
}

func (p *AlibabacloudModelProvider) queryWanx(ctx context.Context, question string, writer io.Writer, lang string) (*ModelResult, error) {
	flusher, ok := writer.(http.Flusher)
	if !ok {
		return nil, fmt.Errorf(i18n.Translate(lang, "model:writer does not implement http.Flusher"))
	}

	var imgUrl string
	var err error
	if isMultimodalImageModel(p.subType) {
		imgUrl, err = p.generateMultimodalImage(ctx, question)
		if err != nil {
			return nil, err
		}
	} else {
		cli := dashscopesdk.NewTongyiClient(p.subType, p.apiKey)
		req := &wanx.ImageSynthesisRequest{
			Model: p.subType,
			Input: wanx.ImageSynthesisInput{
				Prompt: question,
			},
			Params: wanx.ImageSynthesisParams{
				N:    1,
				Size: "1024*1024",
			},
			// Do not ask the SDK to download the image bytes: GetImage uses the same
			// HTTP options as DashScope API calls, including Content-Type: application/json,
			// which breaks OSS presigned URL signature verification (SignatureDoesNotMatch).
			Download: false,
		}

		imgBlobs, err := cli.CreateImageGeneration(ctx, req)
		if err != nil {
			return nil, err
		}
		if len(imgBlobs) == 0 {
			return nil, fmt.Errorf("empty image generation response")
		}
		imgUrl = imgBlobs[0].ImgURL
	}

	// The result URL is a presigned OSS link that expires in about a day, so the image
	// is embedded as a data URL to keep it visible in the chat history.
	imgSrc, err := getImageRefinedText(imgUrl)
	if err != nil {
		imgSrc = imgUrl
	}

	html := fmt.Sprintf("<img src=\"%s\" width=\"100%%\" height=\"auto\">", imgSrc)
	if _, err = fmt.Fprint(writer, html); err != nil {
		return nil, err
	}
	flusher.Flush()

	modelResult := &ModelResult{
		ImageCount:      1,
		TotalTokenCount: 1,
	}
	if err = p.calculatePrice(modelResult, lang); err != nil {
		return nil, err
	}
	return modelResult, nil
}

func (p *AlibabacloudModelProvider) generateMultimodalImage(ctx context.Context, prompt string) (string, error) {
	body := map[string]interface{}{
		"model": p.subType,
		"input": map[string]interface{}{
			"messages": []map[string]interface{}{
				{"role": "user", "content": []map[string]string{{"text": prompt}}},
			},
		},
		"parameters": map[string]interface{}{
			"n":    1,
			"size": "1024*1024",
		},
	}
	data, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Output  struct {
			Choices []struct {
				Message struct {
					Content []struct {
						Image string `json:"image"`
					} `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		} `json:"output"`
	}
	if err = json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("image generation failed: HTTP %d: %s", resp.StatusCode, string(respBody))
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("image generation failed: %s: %s", result.Code, result.Message)
	}

	for _, choice := range result.Output.Choices {
		for _, content := range choice.Message.Content {
			if content.Image != "" {
				return content.Image, nil
			}
		}
	}
	return "", fmt.Errorf("empty image generation response")
}

func (p *AlibabacloudModelProvider) QueryText(question string, writer io.Writer, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	ctx := context.Background()
	flusher, ok := writer.(http.Flusher)
	if !ok {
		return nil, fmt.Errorf(i18n.Translate(lang, "model:writer does not implement http.Flusher"))
	}

	if isWanxModel(p.subType) {
		return p.queryWanx(ctx, question, writer, lang)
	}

	if isQwenMultimodalModel(p.subType) {
		const baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1"
		localProvider, err := NewLocalModelProvider("Custom-think", "custom-model", p.apiKey, p.temperature, p.topP, 0, 0, baseUrl, p.subType, 0, 0, "CNY")
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

	cli := dashscopego.NewTongyiClient(p.subType, p.apiKey)

	if strings.HasPrefix(question, "$OpenAgentDryRun$") {
		modelResult, err := getDefaultModelResult(p.subType, question, "")
		if err != nil {
			return nil, fmt.Errorf(i18n.Translate(lang, "model:cannot calculate tokens"))
		}
		if getContextLength(p.subType) > modelResult.TotalTokenCount {
			return modelResult, nil
		} else {
			return nil, fmt.Errorf(i18n.Translate(lang, "model:exceed max tokens"))
		}
	}

	params := qwen.DefaultParameters().
		SetTemperature(float64(p.temperature)).
		SetTopP(float64(p.topP)).
		SetIncrementalOutput(true)

	if toolSession != nil && toolSession.McpToolSet != nil && toolSession.McpToolSet.WebSearchEnabled {
		params.SetEnableSearch(true)
		params.SetSearchOptions(&qwen.SearchOptions{
			ForcedSearch:        true,
			EnableSource:        true,
			EnableCitation:      true,
			PrependSearchResult: true,
		})
	}

	streamCallbackFn := func(ctx context.Context, typ string, chunk []byte) error {
		data := string(chunk)
		if data == "" {
			return nil
		}
		return flushDataThink(data, typ, writer, lang)
	}

	req := &qwen.Request[*qwen.TextContent]{
		Model: p.subType,
		Input: qwen.Input[*qwen.TextContent]{
			Messages: buildMessages(question, history, prompt, knowledgeMessages),
		},
		Parameters:  params,
		StreamingFn: streamCallbackFn,
	}

	resp, err := cli.CreateCompletion(ctx, req)
	if err != nil {
		return nil, err
	}

	if resp.Output.SearchInfo != nil && resp.Output.SearchInfo.SearchResults != nil && len(resp.Output.SearchInfo.SearchResults) > 0 {
		searchResultsJSON, _ := json.Marshal(resp.Output.SearchInfo.SearchResults)
		flushDataThink(string(searchResultsJSON), "search", writer, lang)
	}

	modelResult := &ModelResult{
		PromptTokenCount:   resp.Usage.InputTokens,
		ResponseTokenCount: resp.Usage.OutputTokens,
		TotalTokenCount:    resp.Usage.TotalTokens,
	}

	err = p.calculatePrice(modelResult, lang)
	if err != nil {
		return nil, err
	}

	flusher.Flush()
	return modelResult, nil
}

func buildMessages(question string, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage) []qwen.Message[*qwen.TextContent] {
	systemMessages := getSystemMessages(prompt, knowledgeMessages)
	var messages []qwen.Message[*qwen.TextContent]
	for _, systemMsg := range systemMessages {
		content := &qwen.TextContent{Text: systemMsg.Text}
		messages = append(messages, qwen.Message[*qwen.TextContent]{
			Role:    "system",
			Content: content,
		})
	}

	for i := len(history) - 1; i >= 0; i-- {
		historyMessage := history[i]
		content := &qwen.TextContent{Text: historyMessage.Text}
		role := "user"
		if historyMessage.Author == "AI" {
			role = "assistant"
		}
		messages = append(messages, qwen.Message[*qwen.TextContent]{
			Role:    role,
			Content: content,
		})
	}

	questionContent := &qwen.TextContent{Text: question}
	messages = append(messages, qwen.Message[*qwen.TextContent]{
		Role:    "user",
		Content: questionContent,
	})

	return messages
}

func (p *AlibabacloudModelProvider) ListModels() ([]string, error) {
	return unsupportedListModels("Alibaba Cloud")
}
