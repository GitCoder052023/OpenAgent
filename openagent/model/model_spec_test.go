// Copyright 2026 The OpenAgent Authors. All Rights Reserved.
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

import "testing"

// Context windows of the models currently offered by each provider, as published on the
// provider's own model list. See the URLs at the top of context_length_util.go.
func TestGetContextLength(t *testing.T) {
	cases := []struct {
		subType string
		want    int
	}{
		// OpenAI
		{"gpt-6-astra", 1050000},
		{"gpt-5.6-sol", 1050000},
		{"gpt-5.6-luna", 1050000},
		{"gpt-5.5", 1050000},
		{"gpt-5.4", 400000},
		{"gpt-5.3-codex", 400000},
		{"gpt-5", 400000},
		{"gpt-4.1", 100000},
		{"gpt-4o", 128000},
		{"gpt-oss-120b", 131072},
		{"o3", 100000},
		// Claude
		{"claude-fable-5-1", 1000000},
		{"claude-opus-5", 1000000},
		{"claude-sonnet-5", 1000000},
		{"claude-haiku-4-5", 200000},
		// Gemini
		{"gemini-3.8-flash", 1048576},
		{"gemini-3.1-pro-preview", 1048576},
		{"gemini-2.5-flash", 1048576},
		{"gemini-embedding-001", 2048},
		// Grok
		{"grok-4.6", 500000},
		{"grok-4.3", 1000000},
		{"grok-build-0.1", 262144},
		// DeepSeek
		{"deepseek-v4-pro", 1000000},
		{"deepseek-flash", 1000000},
		// Mistral
		{"mistral-medium-2604", 262144},
		{"mistral-large-2512", 262144},
		{"ministral-3-8b-2512", 131072},
		// Cohere
		{"command-a-03-2025", 262144},
		{"command-a-plus-05-2026", 131072},
		{"command-r-08-2024", 131072},
		// Writer
		{"palmyra-x6", 1000000},
		{"palmyra-x4", 131072},
		// StepFun
		{"step-3.7-flash", 262144},
		{"step-1o-turbo-vision", 32768},
		// Tencent Cloud
		{"hunyuan-a13b", 229376},
		{"hunyuan-translation", 4096},
		// Others that were already current
		{"qwen3.8-max", 1000000},
		{"kimi-k3", 1048576},
		{"glm-5.3", 1048576},
		{"MiniMax-M3", 1048576},
		{"doubao-seed-2-1-pro-260915", 1048576},
		// Amazon Bedrock model IDs are passed through as sub-types
		{"global.anthropic.claude-opus-5", 1000000},
		{"amazon.nova-2-lite-v1:0", 1000000},
		{"meta.llama3-3-70b-instruct-v1:0", 131072},
		{"mistral.mistral-large-3-675b-instruct", 262144},
	}

	for _, c := range cases {
		if got := getContextLength(c.subType); got != c.want {
			t.Errorf("getContextLength(%q) = %d, want %d", c.subType, got, c.want)
		}
	}
}

// The current Claude models take a 1M token context but cap output well below that, so
// max_tokens must come from getMaxOutputTokens rather than the context window.
func TestGetMaxOutputTokens(t *testing.T) {
	cases := []struct {
		subType string
		want    int
	}{
		{"claude-fable-5-1", 128000},
		{"claude-opus-5", 128000},
		{"claude-sonnet-5", 128000},
		{"claude-haiku-4-5", 64000},
	}

	for _, c := range cases {
		if got := getMaxOutputTokens(c.subType); got != c.want {
			t.Errorf("getMaxOutputTokens(%q) = %d, want %d", c.subType, got, c.want)
		}
		if getMaxOutputTokens(c.subType) > getContextLength(c.subType) {
			t.Errorf("getMaxOutputTokens(%q) exceeds its context window", c.subType)
		}
	}
}

// Claude Fable 5/5.1, Opus 5/4.8/4.7/4.6 and Sonnet 5/4.6 reject thinking.budget_tokens
// with a 400, so a fixed budget must only be sent for models that still accept one.
func TestSupportsThinkingBudget(t *testing.T) {
	cases := map[string]bool{
		"claude-fable-5-1": false,
		"claude-opus-5":    false,
		"claude-opus-4-8":  false,
		"claude-sonnet-5":  false,
		"claude-haiku-4-5": true,
	}

	for subType, want := range cases {
		if got := supportsThinkingBudget(subType); got != want {
			t.Errorf("supportsThinkingBudget(%q) = %v, want %v", subType, got, want)
		}
	}
}

// Every model offered in the UI must produce a price without erroring.
func TestCalculatePriceForCurrentModels(t *testing.T) {
	newResult := func() *ModelResult {
		return &ModelResult{PromptTokenCount: 1000, ResponseTokenCount: 1000, TotalTokenCount: 2000}
	}

	t.Run("OpenAI", func(t *testing.T) {
		for _, m := range []string{
			"gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.5",
			"gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.2", "gpt-5.1", "gpt-5-nano",
			"gpt-4.1", "gpt-4o", "gpt-3.5-turbo", "o3", "o4-mini",
			"gpt-image-2.5-sunburst", "gpt-image-1.5", "chat-latest", "gpt-rosalind-research",
		} {
			r := newResult()
			if err := CalculateOpenAIModelPrice(m, r, "en"); err != nil {
				t.Errorf("CalculateOpenAIModelPrice(%q) error: %v", m, err)
			} else if r.TotalPrice <= 0 {
				t.Errorf("CalculateOpenAIModelPrice(%q) priced at %v, want > 0", m, r.TotalPrice)
			}
		}
	})

	t.Run("Claude", func(t *testing.T) {
		for _, m := range []string{
			"claude-fable-5-1", "claude-fable-5", "claude-opus-5", "claude-opus-4-8",
			"claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-5", "claude-sonnet-4-6",
			"claude-haiku-4-5",
		} {
			p, err := NewClaudeModelProvider(m, "", false, 0)
			if err != nil {
				t.Fatalf("NewClaudeModelProvider(%q) error: %v", m, err)
			}
			r := newResult()
			if err := p.calculatePrice(r, "en"); err != nil {
				t.Errorf("claude calculatePrice(%q) error: %v", m, err)
			} else if r.TotalPrice <= 0 {
				t.Errorf("claude calculatePrice(%q) priced at %v, want > 0", m, r.TotalPrice)
			}
		}
	})

	t.Run("Grok", func(t *testing.T) {
		for _, m := range []string{
			"grok-4.6", "grok-4.5", "grok-4.3", "grok-4.20-0309-reasoning",
			"grok-4.20-0309-non-reasoning", "grok-4.20-multi-agent-0309", "grok-build-0.1",
		} {
			p, err := NewGrokModelProvider(m, "", 0, 0)
			if err != nil {
				t.Fatalf("NewGrokModelProvider(%q) error: %v", m, err)
			}
			r := newResult()
			if err := p.calculatePrice(r, "en"); err != nil {
				t.Errorf("grok calculatePrice(%q) error: %v", m, err)
			} else if r.TotalPrice <= 0 {
				t.Errorf("grok calculatePrice(%q) priced at %v, want > 0", m, r.TotalPrice)
			}
		}
		// Image models are billed per image, not per token
		for _, m := range []string{"grok-imagine-image", "grok-imagine-image-2.0", "grok-imagine-image-quality"} {
			p, err := NewGrokModelProvider(m, "", 0, 0)
			if err != nil {
				t.Fatalf("NewGrokModelProvider(%q) error: %v", m, err)
			}
			r := &ModelResult{ImageCount: 2}
			if err := p.calculatePrice(r, "en"); err != nil {
				t.Errorf("grok calculatePrice(%q) error: %v", m, err)
			} else if r.TotalPrice <= 0 {
				t.Errorf("grok calculatePrice(%q) priced at %v, want > 0", m, r.TotalPrice)
			}
		}
	})

	t.Run("DeepSeek", func(t *testing.T) {
		for _, m := range []string{"deepseek-v4-pro", "deepseek-flash"} {
			p, err := NewDeepSeekProvider(m, "", 0, 0)
			if err != nil {
				t.Fatalf("NewDeepSeekProvider(%q) error: %v", m, err)
			}
			r := newResult()
			if err := p.calculatePrice(r, "en"); err != nil {
				t.Errorf("deepseek calculatePrice(%q) error: %v", m, err)
			} else if r.TotalPrice <= 0 {
				t.Errorf("deepseek calculatePrice(%q) priced at %v, want > 0", m, r.TotalPrice)
			}
		}
	})

	t.Run("Writer", func(t *testing.T) {
		for _, m := range []string{"palmyra-x6", "palmyra-x5", "palmyra-x4"} {
			p, err := NewWriterModelProvider(m, "", 0, 0)
			if err != nil {
				t.Fatalf("NewWriterModelProvider(%q) error: %v", m, err)
			}
			r := newResult()
			if err := p.calculatePrice(r, "en"); err != nil {
				t.Errorf("writer calculatePrice(%q) error: %v", m, err)
			} else if r.TotalPrice <= 0 {
				t.Errorf("writer calculatePrice(%q) priced at %v, want > 0", m, r.TotalPrice)
			}
		}
	})

	t.Run("StepFun", func(t *testing.T) {
		for _, m := range []string{"step-3.7-flash", "step-3.5-flash", "step-3.5-flash-2603", "step-1o-turbo-vision"} {
			p, err := NewStepFunModelProvider(m, "", 0, 0)
			if err != nil {
				t.Fatalf("NewStepFunModelProvider(%q) error: %v", m, err)
			}
			r := newResult()
			if err := p.calculatePrice(r, "en"); err != nil {
				t.Errorf("stepfun calculatePrice(%q) error: %v", m, err)
			} else if r.TotalPrice <= 0 {
				t.Errorf("stepfun calculatePrice(%q) priced at %v, want > 0", m, r.TotalPrice)
			}
		}
	})

	t.Run("Mistral", func(t *testing.T) {
		for _, m := range []string{
			"mistral-medium-2604", "mistral-small-2603", "mistral-large-2512",
			"ministral-3-14b-2512", "ministral-3-8b-2512", "ministral-3-3b-2512",
			"codestral-2508", "z-ai-glm-5-3", "z-ai-glm-5-2",
		} {
			p, err := NewMistralProvider("", m)
			if err != nil {
				t.Fatalf("NewMistralProvider(%q) error: %v", m, err)
			}
			r := newResult()
			if err := p.calculatePrice(r, "en"); err != nil {
				t.Errorf("mistral calculatePrice(%q) error: %v", m, err)
			} else if r.TotalPrice <= 0 {
				t.Errorf("mistral calculatePrice(%q) priced at %v, want > 0", m, r.TotalPrice)
			}
		}
	})

	// Providers whose vendor does not publish a per-token rate for every current model must
	// report price = 0 rather than failing the chat request.
	t.Run("GracefulFallback", func(t *testing.T) {
		cohereP, err := NewCohereModelProvider("command-a-plus-05-2026", "")
		if err != nil {
			t.Fatalf("NewCohereModelProvider error: %v", err)
		}
		r := newResult()
		if err := cohereP.calculatePrice(r, "en"); err != nil {
			t.Errorf("cohere calculatePrice(command-a-plus-05-2026) error: %v", err)
		}

		bedrockP, err := NewAmazonBedrockModelProvider("amazon.nova-2-lite-v1:0", "", 0)
		if err != nil {
			t.Fatalf("NewAmazonBedrockModelProvider error: %v", err)
		}
		r = newResult()
		if err := bedrockP.calculatePrice(r, "en"); err != nil {
			t.Errorf("bedrock calculatePrice(amazon.nova-2-lite-v1:0) error: %v", err)
		}
	})

	// The geo / global cross-Region prefixes must resolve to the same rate as the bare ID.
	t.Run("BedrockGeoPrefix", func(t *testing.T) {
		bare, err := NewAmazonBedrockModelProvider("anthropic.claude-opus-5", "", 0)
		if err != nil {
			t.Fatalf("NewAmazonBedrockModelProvider error: %v", err)
		}
		bareResult := newResult()
		if err := bare.calculatePrice(bareResult, "en"); err != nil {
			t.Fatalf("bedrock calculatePrice error: %v", err)
		}

		for _, m := range []string{
			"global.anthropic.claude-opus-5", "us.anthropic.claude-opus-5", "eu.anthropic.claude-opus-5",
		} {
			p, err := NewAmazonBedrockModelProvider(m, "", 0)
			if err != nil {
				t.Fatalf("NewAmazonBedrockModelProvider(%q) error: %v", m, err)
			}
			r := newResult()
			if err := p.calculatePrice(r, "en"); err != nil {
				t.Fatalf("bedrock calculatePrice(%q) error: %v", m, err)
			}
			if r.TotalPrice != bareResult.TotalPrice {
				t.Errorf("bedrock calculatePrice(%q) = %v, want %v (same as the bare model ID)",
					m, r.TotalPrice, bareResult.TotalPrice)
			}
			if r.TotalPrice <= 0 {
				t.Errorf("bedrock calculatePrice(%q) priced at %v, want > 0", m, r.TotalPrice)
			}
		}
	})
}
