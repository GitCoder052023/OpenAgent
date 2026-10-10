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

import "strings"

// deepseek https://api-docs.deepseek.com/quick_start/pricing
// qwen     https://help.aliyun.com/zh/model-studio/models
// kimi     https://platform.kimi.com/docs/models
// ernie    https://ai.baidu.com/ai-doc/WENXINWORKSHOP/Wm9cvy6rl
// cohere   https://docs.cohere.com/docs/models
// doubao   https://www.volcengine.com/docs/82379/1330310
// step     https://platform.stepfun.com/docs/zh/guides/models/overview
// gemini   https://ai.google.dev/gemini-api/docs/models
// hunyuan  https://cloud.tencent.com/document/product/1729/104753
// chatGLM  https://docs.bigmodel.cn/cn/guide/start/model-overview
// claude   https://docs.anthropic.com/en/docs/about-claude/models/overview
// openai   https://developers.openai.com/api/docs/models
// grok     https://docs.x.ai/docs/models
// mistral  https://docs.mistral.ai/getting-started/models/models_overview/
// writer   https://dev.writer.com/home/models
// bedrock  https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html

// getMaxOutputTokens returns the maximum number of output tokens a Claude model accepts.
// This is separate from the context window: the current Claude models all take a 1M token
// context but cap output at 128K (64K on Claude Haiku 4.5).
func getMaxOutputTokens(typ string) int {
	typ = strings.ToLower(typ)
	if strings.Contains(typ, "haiku-4-5") || strings.Contains(typ, "haiku-4.5") {
		return 64000
	}
	return 128000
}

func getContextLength(typ string) int {
	typ = strings.ToLower(typ)
	if strings.Contains(typ, "deepseek") {
		if strings.Contains(typ, "distill") {
			if strings.Contains(typ, "qwen") {
				if strings.Contains(typ, "7b") {
					return 8192
				} else if strings.Contains(typ, "14b") || strings.Contains(typ, "32b") {
					return 32768
				}
				return 4096
			} else if strings.Contains(typ, "llama") {
				if strings.Contains(typ, "8b") || strings.Contains(typ, "70b") {
					return 131072
				}
				return 4096
			}
			return 4096
		} else if strings.Contains(typ, "r1") {
			if strings.Contains(typ, "671b") {
				return 65536
			} else if strings.Contains(typ, "8b") || strings.Contains(typ, "70b") {
				return 131072
			} else if strings.Contains(typ, "7b") {
				return 8192
			} else if strings.Contains(typ, "14b") || strings.Contains(typ, "32b") {
				return 32768
			}
			return 65536
		} else if strings.Contains(typ, "v3.2") || strings.Contains(typ, "v3-2") {
			return 163840
		} else if strings.Contains(typ, "v4") || strings.Contains(typ, "flash") || strings.Contains(typ, "pro") {
			// deepseek-v4-pro and deepseek-flash both take 1M tokens
			return 1000000
		} else if strings.Contains(typ, "v2.5") {
			return 8192
		} else if strings.Contains(typ, "v3") || strings.Contains(typ, "chat") || strings.Contains(typ, "reasoner") {
			return 131072
		}
	} else if strings.Contains(typ, "qwen") {
		if strings.Contains(typ, "qwen-long") {
			return 10000000
		} else if strings.Contains(typ, "qwen3.8") || strings.Contains(typ, "qwen3.7") {
			return 1000000
		} else if strings.Contains(typ, "qwen3.6") || strings.Contains(typ, "qwen3.5") {
			// The commercial models of these series take 1M tokens, the open-source ones take 256K
			if strings.Contains(typ, "plus") || strings.Contains(typ, "flash") || strings.Contains(typ, "omni") {
				return 1000000
			}
			return 262144
		} else if strings.Contains(typ, "qwen3-vl") {
			return 262144
		} else if strings.Contains(typ, "plus") || strings.Contains(typ, "flash") {
			return 1000000
		} else if strings.Contains(typ, "max") {
			return 32768
		} else if strings.Contains(typ, "qwen2.5") {
			if strings.Contains(typ, "instruct") {
				if strings.Contains(typ, "72b") || strings.Contains(typ, "32b") || strings.Contains(typ, "14b") || strings.Contains(typ, "7b") {
					return 131072
				}
				return 4096
			}
			return 4096
		} else if strings.Contains(typ, "qwen3") {
			return 131072
		}
	} else if strings.Contains(typ, "doubao") {
		if strings.Contains(typ, "seed-evolving") || strings.Contains(typ, "seed-2-1-pro-260915") {
			return 1048576
		} else if strings.Contains(typ, "seed-translation") {
			return 4096
		} else if strings.Contains(typ, "seed-character") || strings.Contains(typ, "embedding-vision") {
			return 131072
		} else if strings.Contains(typ, "doubao-seed") {
			// the doubao-seed-2-1 / 2-0 / 1-8 / 1-6 and code-preview series all take 256K
			return 262144
		} else if strings.Contains(typ, "1-5-pro-32k-character") || strings.Contains(typ, "1.5-pro-32k-character") {
			return 32768
		} else if strings.Contains(typ, "1-5-pro-32k") || strings.Contains(typ, "1.5-pro-32k") {
			return 131072
		} else if strings.Contains(typ, "1-5") || strings.Contains(typ, "1.5") {
			return 32768
		} else if strings.Contains(typ, "256k") {
			return 262144
		} else if strings.Contains(typ, "128k") {
			return 131072
		} else if strings.Contains(typ, "32k") {
			return 32768
		}
	} else if strings.Contains(typ, "gemini") {
		if strings.Contains(typ, "embedding") {
			return 2048
		}
		// the Gemini 3.x and 2.5 families all take a 1M token context
		return 1048576
	} else if strings.Contains(typ, "claude") {
		if strings.Contains(typ, "haiku-4-5") || strings.Contains(typ, "haiku-4.5") {
			return 200000
		}
		// Claude Fable 5/5.1, Opus 5/4.8/4.7/4.6 and Sonnet 5/4.6 all take a 1M token context
		return 1000000
	} else if strings.Contains(typ, "grok") {
		if strings.Contains(typ, "grok-4.6") || strings.Contains(typ, "grok-4.5") {
			return 500000
		} else if strings.Contains(typ, "grok-build") {
			return 262144
		}
		// grok-4.3 and the grok-4.20 series take 1M tokens
		return 1000000
	} else if strings.Contains(typ, "hunyuan") {
		if strings.Contains(typ, "a13b") {
			return 229376
		} else if strings.Contains(typ, "t1-vision") || strings.Contains(typ, "role") {
			return 28672
		} else if strings.Contains(typ, "vision") {
			return 24576
		} else if strings.Contains(typ, "translation") {
			return 4096
		}
		return 4096
	} else if strings.Contains(typ, "step") {
		if strings.Contains(typ, "step-3") {
			return 262144
		} else if strings.Contains(typ, "vision") {
			return 32768
		}
		return 4096
	} else if strings.Contains(typ, "gpt") || strings.HasPrefix(typ, "o") || strings.Contains(typ, "rosalind") || strings.Contains(typ, "daybreak") || typ == "chat-latest" {
		if strings.Contains(typ, "gpt-oss") {
			return 131072
		} else if strings.Contains(typ, "curie") {
			return 2048
		} else if strings.Contains(typ, "3.5") {
			if strings.Contains(typ, "turbo") {
				return 16385
			}
			return 2048
		} else if strings.Contains(typ, "o4") {
			return 100000
		} else if strings.Contains(typ, "o3") {
			return 100000
		} else if strings.Contains(typ, "o1") {
			return 128000
		} else if strings.Contains(typ, "gpt-6") || strings.Contains(typ, "5.6") || strings.Contains(typ, "5.5") {
			return 1050000
		} else if strings.Contains(typ, "5.4") || strings.Contains(typ, "5.3") || strings.Contains(typ, "5.2") || strings.Contains(typ, "5.1") || strings.Contains(typ, "gpt-5") {
			return 400000
		} else if strings.Contains(typ, "rosalind") || strings.Contains(typ, "daybreak") || typ == "chat-latest" {
			return 400000
		} else if strings.Contains(typ, "4o") {
			return 128000
		} else if strings.Contains(typ, "4.1") {
			return 100000
		} else if strings.Contains(typ, "turbo") {
			return 128000
		} else if strings.Contains(typ, "4") {
			return 8192
		}
		return 2048
	} else if strings.Contains(typ, "dummy") {
		return 4096
	} else if strings.Contains(typ, "nova") {
		if strings.Contains(typ, "nova-2") || strings.Contains(typ, "premier") {
			return 1000000
		} else if strings.Contains(typ, "micro") {
			return 128000
		}
		return 300000
	} else if strings.Contains(typ, "mistral") || strings.Contains(typ, "ministral") || strings.Contains(typ, "codestral") {
		if strings.Contains(typ, "ministral") {
			return 131072
		} else if strings.Contains(typ, "2512") || strings.Contains(typ, "2603") || strings.Contains(typ, "2604") || strings.Contains(typ, "2508") || strings.Contains(typ, "large-3") {
			return 262144
		}
		return 131072
	} else if strings.Contains(typ, "palmyra") {
		if strings.Contains(typ, "x4") {
			return 131072
		}
		return 1000000
	} else if strings.Contains(typ, "baichuan") {
		if strings.Contains(typ, "128k") {
			return 131072
		} else if strings.Contains(typ, "baichuan4") || strings.Contains(typ, "baichuan-m") {
			return 32768
		}
		return 8192
	} else if strings.Contains(typ, "minimax") {
		if strings.Contains(typ, "m3") {
			return 1048576
		}
		return 204800
	} else if strings.Contains(typ, "llama") {
		if strings.Contains(typ, "llama4") || strings.Contains(typ, "llama-4") {
			return 1048576
		} else if strings.Contains(typ, "3.3") || strings.Contains(typ, "llama3-3") ||
			strings.Contains(typ, "3.2") || strings.Contains(typ, "llama3-2") ||
			strings.Contains(typ, "3.1") || strings.Contains(typ, "llama3-1") {
			return 131072
		} else if strings.Contains(typ, "2") {
			return 4096
		}
		return 8192
	} else if strings.Contains(typ, "ernie") {
		if strings.Contains(typ, "8k") {
			return 8192
		} else if strings.Contains(typ, "128k") {
			return 131072
		}
	} else if strings.Contains(typ, "spark") {
		if strings.Contains(typ, "pro-128k") || strings.Contains(typ, "128k") {
			return 131072
		} else if strings.Contains(typ, "x2") {
			return 65536
		} else if strings.Contains(typ, "x1.5") {
			return 65536
		} else if strings.Contains(typ, "4.0-ultra") || strings.Contains(typ, "max-32k") {
			return 32768
		} else if strings.Contains(typ, "pro") || strings.Contains(typ, "lite") {
			return 8192
		}
		return 8192
	} else if strings.Contains(typ, "command") {
		if strings.Contains(typ, "translate") {
			return 8192
		} else if strings.Contains(typ, "command-a-plus") {
			return 131072
		} else if strings.Contains(typ, "command-a") {
			// command-a-03-2025 and command-a-reasoning take 256K, command-a-vision takes 128K
			if strings.Contains(typ, "vision") {
				return 131072
			}
			return 262144
		}
		return 131072
	} else if strings.Contains(typ, "yi") {
		if strings.Contains(typ, "200k") {
			return 200000
		} else if strings.Contains(typ, "large") {
			return 32768
		}
		return 16384
	} else if strings.Contains(typ, "kimi") || typ == "k3" || typ == "k3-256k" {
		// "k3" is the Kimi Coding Plan ID of "kimi-k3", "k3-256k" is its 256K variant
		if strings.Contains(typ, "kimi-k3") || typ == "k3" {
			return 1048576
		}
		return 262144
	} else if strings.Contains(typ, "glm") {
		if strings.Contains(typ, "glm-5.3") || strings.Contains(typ, "glm-5-3") || strings.Contains(typ, "glm-5.2") || strings.Contains(typ, "glm-5-2") || strings.Contains(typ, "glm-4-long") {
			return 1048576
		} else if strings.Contains(typ, "glm-5") || strings.Contains(typ, "glm-4.7") || strings.Contains(typ, "glm-4-7") || strings.Contains(typ, "glm-4.6") {
			return 204800
		} else if strings.Contains(typ, "glm-4.5v") || strings.Contains(typ, "glm-4.1v") {
			return 65536
		} else if strings.Contains(typ, "glm-4v-flash") {
			return 16384
		}
		return 131072
	}
	return 4096
}
