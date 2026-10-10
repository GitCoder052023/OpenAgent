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

// These tests write to the configured database, so they follow the same
// convention as the other DB-backed tests in this package and stay out of CI.

//go:build !skipCi
// +build !skipCi

package object

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/the-open-agent/openagent/migration"
	"github.com/the-open-agent/openagent/util"
	"xorm.io/core"
)

const migrationTestOwner = "admin"

// applyTestBundle is a full one-of-everything bundle under names nothing else
// will collide with, so the test can assert on exact rows and clean up after
// itself no matter what the database already holds.
func applyTestBundle(suffix string) *migration.Bundle {
	return &migration.Bundle{
		Source:        "migtest",
		SourceVersion: "1.0",
		SourcePath:    "/tmp/migtest",
		Skills: []*migration.BundleSkill{
			{Name: "migtest-skill-" + suffix, DisplayName: "Test Skill", SkillMd: "---\nname: test\n---\nDo things.", Enabled: true},
		},
		Providers: []*migration.BundleProvider{
			{Name: "migtest-provider-" + suffix, DisplayName: "Test Provider", Category: "Model", Type: "OpenAI", SubType: "gpt-4o", ClientSecret: "sk-test"},
		},
		McpServers: []*migration.BundleMcpServer{
			{Name: "migtest-server-" + suffix, DisplayName: "Test Server", Command: "npx", Args: []string{"-y", "server-filesystem"}, Transport: "stdio"},
		},
		Agents: []*migration.BundleAgent{
			{
				Name:          "migtest-agent-" + suffix,
				DisplayName:   "Test Agent",
				Prompt:        "You are a test.",
				ModelProvider: "migtest-provider-" + suffix,
				McpServer:     "migtest-server-" + suffix,
				Skills:        []string{"migtest-skill-" + suffix},
			},
		},
		Chats: []*migration.BundleChat{
			{
				Name:  "migtest-chat-" + suffix,
				Agent: "migtest-agent-" + suffix,
				Messages: []*migration.BundleMessage{
					{Author: "user", Text: "hello"},
					{Author: "AI", Text: "hi there", TokenCount: 7},
				},
			},
		},
		Warnings: []*migration.BundleWarning{},
	}
}

// runMigrationToCompletion starts a run and waits for it, so the assertions do
// not race the background goroutine that does the writing.
func runMigrationToCompletion(t *testing.T, bundle *migration.Bundle, plan *migration.Plan) *migration.Progress {
	t.Helper()

	progress, err := StartMigration(migrationTestOwner, bundle, plan)
	if err != nil {
		t.Fatalf("StartMigration() error: %s", err.Error())
	}

	deadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(deadline) {
		progress = migration.GetProgress(progress.Id)
		if progress == nil {
			t.Fatalf("the migration progress disappeared while the run was in flight")
		}
		if progress.Status != migration.StatusRunning {
			return progress
		}
		time.Sleep(50 * time.Millisecond)
	}

	t.Fatalf("the migration did not finish within 30s, last state = %+v", progress)
	return nil
}

// cleanupMigrationRun removes the run record itself. The entities it created
// are removed by the rollback the test performs.
func cleanupMigrationRun(t *testing.T, id string) {
	t.Helper()

	if _, err := adapter.engine.ID(core.PK{migrationTestOwner, id}).Delete(&Migration{}); err != nil {
		t.Logf("cleaning up the migration record failed: %s", err.Error())
	}
}

func TestMigrationApplyAndRollback(t *testing.T) {
	InitConfig()

	// Entity names are normalized to lower case on the way in, so the fixture
	// uses a suffix that survives normalization unchanged and the test can look
	// the rows up by the names it asked for.
	suffix := strings.ToLower(util.GetRandomString(8))
	bundle := applyTestBundle(suffix)

	plan, err := BuildMigrationPlan(migrationTestOwner, bundle, migration.GetDefaultOptions())
	if err != nil {
		t.Fatalf("BuildMigrationPlan() error: %s", err.Error())
	}
	if plan.Total != 5 {
		t.Fatalf("plan total = %d, want 5 (one of each category)", plan.Total)
	}
	for _, item := range plan.Items {
		if item.Action != migration.ActionCreate {
			t.Fatalf("item %s planned as %q on a clean database, want create", item.Key, item.Action)
		}
	}

	progress := runMigrationToCompletion(t, bundle, plan)
	defer cleanupMigrationRun(t, progress.Id)

	if progress.Status != migration.StatusDone {
		t.Fatalf("migration status = %q (%s), want Done", progress.Status, progress.ErrorText)
	}
	if progress.Done != 5 || len(progress.Errors) != 0 {
		t.Fatalf("migration wrote %d/5 items with errors %+v", progress.Done, progress.Errors)
	}

	// The entities must actually be readable through the normal getters, not
	// just counted by the progress tracker.
	skill, err := getSkill(migrationTestOwner, "migtest-skill-"+suffix)
	if err != nil || skill == nil {
		t.Fatalf("the imported skill is not readable: %v %v", skill, err)
	}
	provider, err := getProvider(migrationTestOwner, "migtest-provider-"+suffix)
	if err != nil || provider == nil {
		t.Fatalf("the imported provider is not readable: %v %v", provider, err)
	}
	if provider.ClientSecret != "sk-test" {
		t.Errorf("provider secret = %q, the API key did not survive the import", provider.ClientSecret)
	}
	server, err := getServer(migrationTestOwner, "migtest-server-"+suffix)
	if err != nil || server == nil {
		t.Fatalf("the imported MCP server is not readable: %v %v", server, err)
	}
	if server.Command != "npx" || len(server.Args) != 2 {
		t.Errorf("imported stdio server = %+v, want the command and its two arguments", server)
	}

	store, err := getStore(migrationTestOwner, "migtest-agent-"+suffix)
	if err != nil || store == nil {
		t.Fatalf("the imported agent is not readable: %v %v", store, err)
	}
	// The agent must point at the rows this same run created, or the imported
	// agent looks fine in the list and is broken the moment it is used.
	if store.ModelProvider != "migtest-provider-"+suffix || store.McpServer != "migtest-server-"+suffix {
		t.Errorf("agent references = %q / %q, want the imported provider and server", store.ModelProvider, store.McpServer)
	}
	if len(store.Skills) != 1 || store.Skills[0] != "migtest-skill-"+suffix {
		t.Errorf("agent skills = %+v, want the imported skill", store.Skills)
	}

	chatItem := findMigrationItem(progress.Applied, migration.CategoryChat)
	if chatItem == nil {
		t.Fatalf("the run reported no chat item, applied = %+v", progress.Applied)
	}
	chat, err := getChat(migrationTestOwner, chatItem.TargetName)
	if err != nil || chat == nil {
		t.Fatalf("the imported chat is not readable: %v %v", chat, err)
	}
	if chat.Store != "migtest-agent-"+suffix || chat.MessageCount != 2 || chat.TokenCount != 7 {
		t.Errorf("imported chat = %+v, want it attached to the agent with 2 messages and 7 tokens", chat)
	}
	messages := []*Message{}
	if err = adapter.engine.Where("owner = ? and chat = ?", migrationTestOwner, chatItem.TargetName).Asc("created_time").Find(&messages); err != nil {
		t.Fatal(err)
	}
	if len(messages) != 2 {
		t.Fatalf("got %d messages, want 2", len(messages))
	}
	// The reply chain is what the chat UI walks, so the assistant turn has to
	// point back at the user turn it answered.
	if messages[1].Author != "AI" || messages[1].ReplyTo != messages[0].Name {
		t.Errorf("assistant message = %+v, want it replying to %q", messages[1], messages[0].Name)
	}

	// Re-planning the same bundle must not offer to import it a second time:
	// the identical skill is recognized, and the rest is renamed rather than
	// silently replaced.
	replan, err := BuildMigrationPlan(migrationTestOwner, bundle, migration.GetDefaultOptions())
	if err != nil {
		t.Fatalf("BuildMigrationPlan() error on re-plan: %s", err.Error())
	}
	skillItem := findMigrationItem(replan.Items, migration.CategorySkill)
	if skillItem == nil || skillItem.Action != migration.ActionSkip {
		t.Errorf("re-planned skill = %+v, want it skipped as already imported", skillItem)
	}
	agentItem := findMigrationItem(replan.Items, migration.CategoryAgent)
	if agentItem == nil || agentItem.TargetName == "migtest-agent-"+suffix {
		t.Errorf("re-planned agent = %+v, want it renamed away from the existing one", agentItem)
	}

	notes, err := RollbackMigration(fmt.Sprintf("%s/%s", migrationTestOwner, progress.Id))
	if err != nil {
		t.Fatalf("RollbackMigration() error: %s", err.Error())
	}
	if len(notes) != 0 {
		t.Errorf("rollback reported %+v, want a clean undo", notes)
	}

	for _, check := range []struct {
		name string
		load func() (bool, error)
	}{
		{"skill", func() (bool, error) {
			row, err := getSkill(migrationTestOwner, "migtest-skill-"+suffix)
			return row != nil, err
		}},
		{"provider", func() (bool, error) {
			row, err := getProvider(migrationTestOwner, "migtest-provider-"+suffix)
			return row != nil, err
		}},
		{"server", func() (bool, error) {
			row, err := getServer(migrationTestOwner, "migtest-server-"+suffix)
			return row != nil, err
		}},
		{"agent", func() (bool, error) {
			row, err := getStore(migrationTestOwner, "migtest-agent-"+suffix)
			return row != nil, err
		}},
		{"chat", func() (bool, error) {
			row, err := getChat(migrationTestOwner, chatItem.TargetName)
			return row != nil, err
		}},
	} {
		exists, err := check.load()
		if err != nil {
			t.Fatalf("reading the %s after the rollback failed: %s", check.name, err.Error())
		}
		if exists {
			t.Errorf("the %s survived the rollback", check.name)
		}
	}

	messages = []*Message{}
	if err = adapter.engine.Where("owner = ? and chat = ?", migrationTestOwner, chatItem.TargetName).Find(&messages); err != nil {
		t.Fatal(err)
	}
	if len(messages) != 0 {
		t.Errorf("%d messages survived the rollback of their chat", len(messages))
	}
}

// TestMigrationSelectionIsHonoured checks that unticking rows in the preview
// really keeps them out of the run, since that is the whole promise of the
// preview step.
func TestMigrationSelectionIsHonoured(t *testing.T) {
	InitConfig()

	suffix := strings.ToLower(util.GetRandomString(8))
	bundle := applyTestBundle(suffix)

	options := migration.GetDefaultOptions()
	options.IncludeChats = false
	options.SelectedKeys = []string{migration.CategorySkill + "/migtest-skill-" + suffix}

	plan, err := BuildMigrationPlan(migrationTestOwner, bundle, options)
	if err != nil {
		t.Fatalf("BuildMigrationPlan() error: %s", err.Error())
	}
	if plan.Total != 1 {
		t.Fatalf("plan total = %d, want only the one selected skill", plan.Total)
	}

	progress := runMigrationToCompletion(t, bundle, plan)
	defer cleanupMigrationRun(t, progress.Id)

	if progress.Status != migration.StatusDone || progress.Done != 1 {
		t.Fatalf("run = %s %d/%d, want a clean single-item import", progress.Status, progress.Done, progress.Total)
	}
	if row, _ := getStore(migrationTestOwner, "migtest-agent-"+suffix); row != nil {
		t.Errorf("the unselected agent was imported anyway")
	}

	if _, err = RollbackMigration(fmt.Sprintf("%s/%s", migrationTestOwner, progress.Id)); err != nil {
		t.Fatalf("RollbackMigration() error: %s", err.Error())
	}
	if row, _ := getSkill(migrationTestOwner, "migtest-skill-"+suffix); row != nil {
		t.Errorf("the imported skill survived the rollback")
	}
}

func findMigrationItem(items []*migration.Item, category string) *migration.Item {
	for _, item := range items {
		if item.Category == category {
			return item
		}
	}
	return nil
}
