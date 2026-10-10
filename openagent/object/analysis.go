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

package object

import (
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/the-open-agent/openagent/util"
)

var chineseStopWords = map[string]bool{
	"的": true, "了": true, "在": true, "是": true, "我": true, "有": true, "和": true, "就": true,
	"不": true, "人": true, "都": true, "一": true, "一个": true, "上": true, "也": true, "很": true,
	"到": true, "说": true, "要": true, "去": true, "你": true, "会": true, "着": true, "没有": true,
	"看": true, "好": true, "自己": true, "这": true, "那": true, "什么": true, "可以": true, "吗": true,
	"呢": true, "吧": true, "啊": true, "哦": true, "嗯": true, "哈": true, "哈哈": true, "谢谢": true,
	"请": true, "帮": true, "给": true, "他": true, "她": true, "它": true, "们": true,
	"这个": true, "那个": true, "一些": true, "可能": true, "应该": true, "需要": true, "知道": true,
}

var englishStopWords = map[string]bool{
	"the": true, "a": true, "an": true, "and": true, "or": true, "but": true, "in": true, "on": true,
	"at": true, "to": true, "for": true, "of": true, "with": true, "by": true, "from": true, "is": true,
	"are": true, "was": true, "were": true, "be": true, "been": true, "being": true, "have": true,
	"has": true, "had": true, "do": true, "does": true, "did": true, "will": true, "would": true,
	"could": true, "should": true, "may": true, "might": true, "shall": true, "can": true, "it": true,
	"its": true, "this": true, "that": true, "these": true, "those": true, "i": true, "you": true,
	"he": true, "she": true, "we": true, "they": true, "me": true, "him": true, "her": true, "us": true,
	"them": true, "my": true, "your": true, "his": true, "our": true, "their": true, "what": true,
	"which": true, "who": true, "when": true, "where": true, "why": true, "how": true, "all": true,
	"not": true, "no": true, "so": true, "if": true, "as": true, "up": true, "out": true, "about": true,
	"into": true, "than": true, "then": true, "also": true, "just": true, "like": true, "get": true,
	"use": true, "one": true, "two": true, "more": true, "some": true, "any": true, "ok": true,
}

var nonWordRe = regexp.MustCompile(`[^\p{L}\p{N}]+`)

// GetStoreWordCloud returns word frequency map for user messages in a store.
// If period is "24h", "7d" or "30d", only messages within that window are counted;
// an empty period keeps the original all-time behavior.
func GetStoreWordCloud(storeName string, period string) (map[string]int, error) {
	var messages []*Message
	if period == "" {
		var err error
		messages, err = GetGlobalMessagesByStoreName(storeName)
		if err != nil {
			return nil, err
		}
	} else {
		spec, err := resolvePeriod(period)
		if err != nil {
			return nil, err
		}
		now := time.Now()
		end := now.Truncate(spec.bucketUnit).Add(spec.bucketUnit)
		start := end.Add(-spec.duration)
		startStr := util.FormatTimeForCompare(start)
		endStr := util.FormatTimeForCompare(end)

		messages = []*Message{}
		if err = adapter.engine.
			Cols("author", "text").
			Where("store = ? and created_time >= ? and created_time < ?", storeName, startStr, endStr).
			Find(&messages); err != nil {
			return nil, err
		}
	}

	wordCount := map[string]int{}
	for _, msg := range messages {
		// Only count user messages, skip AI responses
		if msg.Author == "AI" || strings.TrimSpace(msg.Text) == "" {
			continue
		}
		countWords(msg.Text, wordCount)
	}

	// Keep only words with frequency >= 2 to reduce noise
	result := map[string]int{}
	for w, c := range wordCount {
		if c >= 2 {
			result[w] = c
		}
	}
	return result, nil
}

func countWords(text string, wordCount map[string]int) {
	// Collect Chinese bigrams
	runes := []rune(text)
	for i := 0; i < len(runes)-1; i++ {
		r1, r2 := runes[i], runes[i+1]
		if isCJK(r1) && isCJK(r2) {
			w := string([]rune{r1, r2})
			if !chineseStopWords[w] {
				wordCount[w]++
			}
		}
	}

	// Split into tokens by non-word characters and count English words
	tokens := nonWordRe.Split(text, -1)
	for _, token := range tokens {
		token = strings.ToLower(strings.TrimSpace(token))
		if len(token) < 3 {
			continue
		}
		// Skip tokens that are purely CJK (already handled as bigrams)
		if isAllCJK(token) {
			continue
		}
		// Skip purely numeric
		if isAllDigits(token) {
			continue
		}
		if !englishStopWords[token] {
			wordCount[token]++
		}
	}
}

func isCJK(r rune) bool {
	return unicode.Is(unicode.Han, r) ||
		unicode.Is(unicode.Hiragana, r) ||
		unicode.Is(unicode.Katakana, r)
}

func isAllCJK(s string) bool {
	for _, r := range s {
		if !isCJK(r) {
			return false
		}
	}
	return len(s) > 0
}

func isAllDigits(s string) bool {
	for _, r := range s {
		if !unicode.IsDigit(r) {
			return false
		}
	}
	return true
}
