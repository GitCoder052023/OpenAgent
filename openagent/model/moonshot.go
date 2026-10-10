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
	"bufio"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/sashabaranov/go-openai"
	"github.com/the-open-agent/openagent/i18n"
	"github.com/the-open-agent/openagent/proxy"
)

const (
	kimiCodingBaseURL   = "https://api.kimi.com/coding/v1"
	kimiCodingUserAgent = "KimiCLI/1.44.0"
)

// kimiCodingSubTypes are the model IDs served by the Kimi Coding Plan endpoint
// (https://api.kimi.com/coding/v1) instead of the Kimi open platform endpoint.
var kimiCodingSubTypes = []string{
	"k3",
	"k3-256k",
	"kimi-for-coding",
	"kimi-for-coding-highspeed",
}

func isKimiCodingSubType(subType string) bool {
	for _, codingSubType := range kimiCodingSubTypes {
		if subType == codingSubType {
			return true
		}
	}
	return false
}

// sseFixReadCloser fixes the SSE format from kimi-for-coding API which sends
// "data:{...}" (no space after colon) instead of standard "data: {...}".
// go-openai's stream reader strictly expects "data: " prefix.
type sseFixReadCloser struct {
	pr io.ReadCloser
}

func newSSEFixReadCloser(rc io.ReadCloser) io.ReadCloser {
	pr, pw := io.Pipe()
	go func() {
		defer rc.Close()
		scanner := bufio.NewScanner(rc)
		scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "data:") && !strings.HasPrefix(line, "data: ") {
				line = "data: " + line[5:]
			}
			if _, err := fmt.Fprintln(pw, line); err != nil {
				pw.CloseWithError(err)
				return
			}
		}
		if err := scanner.Err(); err != nil {
			pw.CloseWithError(err)
		} else {
			pw.Close()
		}
	}()
	return &sseFixReadCloser{pr: pr}
}

func (r *sseFixReadCloser) Read(p []byte) (int, error) {
	return r.pr.Read(p)
}

func (r *sseFixReadCloser) Close() error {
	return r.pr.Close()
}

// kimiCodingTransport wraps an underlying RoundTripper and overrides the
// User-Agent header to "KimiCLI/1.44.0". The Kimi coding API requires this
// UA string; without it the endpoint rejects non-code-related requests.
type kimiCodingTransport struct {
	base http.RoundTripper
}

func (t *kimiCodingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req = req.Clone(req.Context())
	req.Header.Set("User-Agent", kimiCodingUserAgent)
	resp, err := t.base.RoundTrip(req)
	if err != nil {
		return nil, err
	}
	resp.Body = newSSEFixReadCloser(resp.Body)
	return resp, nil
}

type MoonshotModelProvider struct {
	temperature float32
	subType     string
	secretKey   string
	topP        float32
}

func NewMoonshotModelProvider(subType string, secretKey string, temperature float32, topP float32) (*MoonshotModelProvider, error) {
	client := &MoonshotModelProvider{
		subType:     subType,
		secretKey:   secretKey,
		temperature: temperature,
		topP:        topP,
	}
	return client, nil
}

func getKimiCodingClientFromToken(authToken string) *openai.Client {
	config := openai.DefaultConfig(authToken)
	config.BaseURL = kimiCodingBaseURL

	baseTransport := proxy.ProxyHttpClient.Transport
	if baseTransport == nil {
		baseTransport = http.DefaultTransport
	}

	transport := &kimiCodingTransport{base: baseTransport}
	httpClient := &http.Client{Transport: transport}
	config.HTTPClient = httpClient

	c := openai.NewClientWithConfig(config)
	return c
}

func (p *MoonshotModelProvider) GetPricing() string {
	return `URL:
https://platform.kimi.com/docs/pricing/chat

Model

| Model                    | Context Length | Unit Of Charge | Input Price (Cache Miss) | Output Price |
|--------------------------|----------------|----------------|--------------------------|--------------|
| kimi-k3                  | 1M             | 1M tokens      | 20 yuan                  | 100 yuan     |
| kimi-k2.7-code           | 256K           | 1M tokens      | 6.5 yuan                 | 27 yuan      |
| kimi-k2.7-code-highspeed | 256K           | 1M tokens      | 13 yuan                  | 54 yuan      |
| kimi-k2.6                | 256K           | 1M tokens      | 6.5 yuan                 | 27 yuan      |

Kimi Coding Plan models (https://api.kimi.com/coding/v1) are covered by the subscription
instead of being billed per token:

| Model                     | Context Length | Unit Of Charge | Input Price  | Output Price |
|---------------------------|----------------|----------------|--------------|--------------|
| k3                        | 1M             | 1M tokens      | Subscription | Subscription |
| k3-256k                   | 256K           | 1M tokens      | Subscription | Subscription |
| kimi-for-coding           | 256K           | 1M tokens      | Subscription | Subscription |
| kimi-for-coding-highspeed | 256K           | 1M tokens      | Subscription | Subscription |
`
}

func (p *MoonshotModelProvider) calculatePrice(modelResult *ModelResult, lang string) error {
	// The prices are per 1,000 tokens, converted from the per-1M-token prices at
	// https://platform.kimi.com/docs/pricing/chat, using the cache-miss input price.
	priceTable := map[string][2]float64{
		"kimi-k3":                  {0.020, 0.100},
		"kimi-k2.7-code":           {0.0065, 0.027},
		"kimi-k2.7-code-highspeed": {0.013, 0.054},
		"kimi-k2.6":                {0.0065, 0.027},
	}

	price := 0.0
	if isKimiCodingSubType(p.subType) {
		// The Kimi Coding Plan is a flat subscription, its calls are not billed per token
		price = 0.0
	} else if priceItem, ok := priceTable[p.subType]; ok {
		inputPrice := getPrice(modelResult.PromptTokenCount, priceItem[0])
		outputPrice := getPrice(modelResult.ResponseTokenCount, priceItem[1])
		price = AddPrices(inputPrice, outputPrice)
	} else {
		return fmt.Errorf(i18n.Translate(lang, "embedding:calculatePrice() error: unknown model type: %s"), p.subType)
	}

	modelResult.TotalPrice = price
	modelResult.Currency = "CNY"
	return nil
}

func (p *MoonshotModelProvider) QueryText(question string, writer io.Writer, history []*RawMessage, prompt string, knowledgeMessages []*RawMessage, toolSession *ToolSession, lang string) (*ModelResult, error) {
	var localProvider *LocalModelProvider
	var err error

	if isKimiCodingSubType(p.subType) {
		localProvider, err = NewLocalModelProvider("Custom-think", "custom-model", p.secretKey, p.temperature, p.topP, 0, 0, kimiCodingBaseURL, p.subType, 0, 0, "CNY")
		if err != nil {
			return nil, err
		}
		localProvider.customClient = getKimiCodingClientFromToken(p.secretKey)
		localProvider.mergeToolCalls = true
	} else {
		const BaseUrl = "https://api.moonshot.cn/v1"
		localProvider, err = NewLocalModelProvider("Custom-think", "custom-model", p.secretKey, p.temperature, p.topP, 0, 0, BaseUrl, p.subType, 0, 0, "CNY")
		if err != nil {
			return nil, err
		}
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

func (p *MoonshotModelProvider) ListModels() ([]string, error) {
	return openaiCompatibleListModels("moonshot", p.secretKey, "https://api.moonshot.cn/v1")
}
