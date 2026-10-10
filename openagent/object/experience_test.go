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
	"strings"
	"testing"
)

func TestBuildExperienceCatalogTiersByScore(t *testing.T) {
	matches := []*Experience{
		{
			Question:      "What is the refund window?",
			OriginalText:  "Refunds are accepted within 7 days.",
			CorrectedText: "Refunds are accepted within 30 days.",
			Score:         0.97,
		},
		{
			Question:      "What is the exchange window?",
			OriginalText:  "Exchanges are accepted within 7 days.",
			CorrectedText: "Exchanges are accepted within 30 days.",
			Reason:        "The policy changed in 2026.",
			Score:         0.81,
		},
	}

	res := buildExperienceCatalog(nil, matches, false)

	if !strings.Contains(res, "Approved answer (similarity 0.97)") {
		t.Errorf("a near-identical question should produce an approved answer section, got:\n%s", res)
	}
	if !strings.Contains(res, "Corrected example for a similar question (similarity 0.81)") {
		t.Errorf("a merely similar question should produce an example section, got:\n%s", res)
	}
	// The rejected answer is only useful as a contrast in the example tier; repeating it
	// for a near-exact match would just invite the model to copy the wrong version.
	if strings.Contains(res, "Rejected answer: Refunds are accepted within 7 days.") {
		t.Errorf("the approved-answer section should not restate the rejected answer, got:\n%s", res)
	}
	if !strings.Contains(res, "Rejected answer: Exchanges are accepted within 7 days.") {
		t.Errorf("the example section should show the rejected answer, got:\n%s", res)
	}
	if !strings.Contains(res, "The policy changed in 2026.") {
		t.Errorf("the example section should carry the reason, got:\n%s", res)
	}
}

func TestBuildExperienceCatalogRules(t *testing.T) {
	rules := []*Experience{
		{Rule: "Answer policy questions with the conclusion first.", Category: ExperienceCategoryStyle},
		{Rule: "   ", CorrectedText: "Never invent an order number."},
		{Rule: "", CorrectedText: ""},
	}

	res := buildExperienceCatalog(rules, nil, false)

	if !strings.Contains(res, "1. [Style] Answer policy questions with the conclusion first.") {
		t.Errorf("a rule should be numbered and tagged with its category, got:\n%s", res)
	}
	// A rule saved from a chat correction has no separate rule text, so the corrected
	// answer itself is the instruction.
	if !strings.Contains(res, "Never invent an order number.") {
		t.Errorf("a rule without rule text should fall back to the corrected answer, got:\n%s", res)
	}
	if strings.Contains(res, "3.") {
		t.Errorf("an empty rule should be skipped entirely, got:\n%s", res)
	}
}

func TestBuildExperienceCatalogEmpty(t *testing.T) {
	if res := buildExperienceCatalog(nil, nil, false); !strings.Contains(res, "Calibrated experience library") {
		t.Errorf("the header should still be present, got: %q", res)
	}
}

func TestBuildExperienceCatalogUsesChineseWhenAsked(t *testing.T) {
	matches := []*Experience{{Question: "退货期限是多久？", CorrectedText: "30 天内可退。", Score: 0.99}}

	res := buildExperienceCatalog(nil, matches, true)

	if !strings.Contains(res, "人工校准经验库") || !strings.Contains(res, "已确认答案") {
		t.Errorf("expected the Chinese catalog, got:\n%s", res)
	}
	if strings.Contains(res, "Approved answer") {
		t.Errorf("the Chinese catalog should not mix in English headings, got:\n%s", res)
	}
}

func TestContainsChinese(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"退货期限", true},
		{"refund window", false},
		{"refund 期限", true},
		{"", false},
		{"カタカナ", false},
	}
	for _, c := range cases {
		if got := containsChinese(c.in); got != c.want {
			t.Errorf("containsChinese(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}
