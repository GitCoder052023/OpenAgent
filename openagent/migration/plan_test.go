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

package migration

import (
	"testing"
)

// fakeLookup stands in for the database: taken holds the names that already
// exist, identical the subset whose content matches the bundle.
type fakeLookup struct {
	taken     map[string]bool
	identical map[string]bool
}

func (lookup *fakeLookup) state(name string) (bool, bool, error) {
	return lookup.taken[name], lookup.identical[name], nil
}

func (lookup *fakeLookup) SkillState(name string, skill *BundleSkill) (bool, bool, error) {
	return lookup.state(name)
}

func (lookup *fakeLookup) ProviderState(name string, provider *BundleProvider) (bool, bool, error) {
	return lookup.state(name)
}

func (lookup *fakeLookup) ServerState(name string, server *BundleMcpServer) (bool, bool, error) {
	return lookup.state(name)
}

func (lookup *fakeLookup) AgentState(name string, agent *BundleAgent) (bool, bool, error) {
	return lookup.state(name)
}

func planFixture() *Bundle {
	return &Bundle{
		Source:     "openclaw",
		Skills:     []*BundleSkill{{Name: "pdf-tools", SkillMd: "x"}},
		Providers:  []*BundleProvider{{Name: "openai", Type: "OpenAI"}},
		McpServers: []*BundleMcpServer{{Name: "fs", Command: "npx"}},
		Agents:     []*BundleAgent{{Name: "Main Bot"}},
		Chats:      []*BundleChat{{Name: "c1", Messages: []*BundleMessage{{Text: "hi"}}}},
	}
}

func itemFor(plan *Plan, category string) *Item {
	for _, item := range plan.Items {
		if item.Category == category {
			return item
		}
	}
	return nil
}

func TestBuildPlanOnEmptyDatabase(t *testing.T) {
	plan, err := BuildPlan("admin", planFixture(), GetDefaultOptions(), &fakeLookup{taken: map[string]bool{}, identical: map[string]bool{}})
	if err != nil {
		t.Fatalf("BuildPlan() error: %s", err.Error())
	}
	if plan.Total != 5 {
		t.Fatalf("plan total = %d, want one item per category", plan.Total)
	}
	for _, item := range plan.Items {
		if item.Action != ActionCreate {
			t.Errorf("item %s = %q, want create when nothing exists yet", item.Key, item.Action)
		}
	}
	// Names the source spells however it likes must land as valid entity names.
	if agent := itemFor(plan, CategoryAgent); agent == nil || agent.TargetName != "main-bot" {
		t.Errorf("agent target = %+v, want the normalized name", agent)
	}
}

func TestBuildPlanConflictPolicies(t *testing.T) {
	taken := map[string]bool{"pdf-tools": true, "openai": true, "fs": true, "main-bot": true}

	cases := []struct {
		policy string
		action string
		target string
	}{
		{ConflictRename, ActionCreate, "openclaw-pdf-tools"},
		{ConflictSkip, ActionSkip, "pdf-tools"},
		{ConflictOverwrite, ActionOverwrite, "pdf-tools"},
	}
	for _, tc := range cases {
		options := GetDefaultOptions()
		options.ConflictPolicy = tc.policy

		plan, err := BuildPlan("admin", planFixture(), options, &fakeLookup{taken: taken, identical: map[string]bool{}})
		if err != nil {
			t.Fatalf("BuildPlan(%s) error: %s", tc.policy, err.Error())
		}
		skill := itemFor(plan, CategorySkill)
		if skill == nil || skill.Action != tc.action || skill.TargetName != tc.target {
			t.Errorf("policy %s gave %+v, want action %q on %q", tc.policy, skill, tc.action, tc.target)
		}
		if skill.Action != ActionSkip && skill.Reason == "" {
			t.Errorf("policy %s renamed or replaced silently, the preview would not explain why", tc.policy)
		}
	}
}

// An entity whose content already matches is skipped whatever the policy says:
// importing the same skill again under a second name is noise, not safety.
func TestBuildPlanSkipsIdenticalContent(t *testing.T) {
	lookup := &fakeLookup{
		taken:     map[string]bool{"pdf-tools": true},
		identical: map[string]bool{"pdf-tools": true},
	}
	options := GetDefaultOptions()
	options.ConflictPolicy = ConflictRename

	plan, err := BuildPlan("admin", planFixture(), options, lookup)
	if err != nil {
		t.Fatalf("BuildPlan() error: %s", err.Error())
	}
	skill := itemFor(plan, CategorySkill)
	if skill == nil || skill.Action != ActionSkip {
		t.Fatalf("skill = %+v, want it skipped as already imported", skill)
	}
	if plan.Total != 4 {
		t.Errorf("plan total = %d, want the skipped skill left out of the count", plan.Total)
	}
}

func TestBuildPlanHonoursSelection(t *testing.T) {
	options := GetDefaultOptions()
	options.IncludeChats = false
	options.SelectedKeys = []string{CategorySkill + "/pdf-tools"}

	plan, err := BuildPlan("admin", planFixture(), options, &fakeLookup{taken: map[string]bool{}, identical: map[string]bool{}})
	if err != nil {
		t.Fatalf("BuildPlan() error: %s", err.Error())
	}
	if plan.Total != 1 {
		t.Fatalf("plan total = %d, want only the selected skill", plan.Total)
	}
	// Deselected rows stay in the table rather than vanishing, so the preview
	// still shows everything the source had.
	if len(plan.Items) != 4 {
		t.Errorf("got %d rows, want the unselected ones still listed", len(plan.Items))
	}
	if agent := itemFor(plan, CategoryAgent); agent == nil || agent.Reason != "not selected" {
		t.Errorf("unselected agent = %+v, want it marked as not selected", agent)
	}
}

func TestNormalizeEntityName(t *testing.T) {
	cases := map[string]string{
		"My Agent":              "my-agent",
		"anthropic/claude-x":    "anthropic-claude-x",
		"  Weird__Name..  ":     "weird-name",
		"already-fine":          "already-fine",
		"C:\\Users\\bot\\agent": "c-users-bot-agent",
	}
	for input, want := range cases {
		if got := NormalizeEntityName(input); got != want {
			t.Errorf("NormalizeEntityName(%q) = %q, want %q", input, got, want)
		}
	}
}
