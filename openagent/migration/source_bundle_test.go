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
	"os"
	"path/filepath"
	"testing"
)

// bundleFixture is what a user migrating an agent we have no adapter for would
// hand-write or script: some entries complete, some sloppy.
const bundleFixture = `{
  // A bundle exported from an agent OpenAgent has no native adapter for.
  "source": "hermes",
  "sourceVersion": "2.1",
  "agents": [
    {
      "name": "main",
      "displayName": "Main",
      "prompt": "You are helpful.",
      "modelProvider": "openai",
      "skills": ["pdf", "ghost"],
    },
    {"displayName": "Named By Display Name Only"},
    {"prompt": "no name at all"},
  ],
  "providers": [
    {"name": "openai", "type": "OpenAI", "subType": "gpt-4o", "clientSecret": "sk-secret"},
    {"name": "keyless", "type": "Anthropic"},
  ],
  "skills": [
    {"name": "pdf", "skillMd": "---\nname: pdf\n---\nRead PDFs."},
    {"name": "disabled-one", "skillMd": "x", "enabled": false},
  ],
  "mcpServers": [
    {"name": "fs", "command": "npx", "args": ["-y", "server-filesystem"]},
    {"name": "broken"},
  ],
  "chats": [
    {
      "name": "c1",
      "agent": "main",
      "messages": [
        {"author": "user", "text": "hi"},
        {"author": "assistant", "text": "hello"},
      ],
    },
    {"name": "orphan", "agent": "gone", "messages": [{"text": "who am I talking to"}]},
    {"name": "empty", "messages": []},
  ],
}`

func hasWarning(bundle *Bundle, category string, item string) bool {
	for _, warning := range bundle.Warnings {
		if warning.Category == category && warning.Item == item {
			return true
		}
	}
	return false
}

func TestBundleDetectAndExtract(t *testing.T) {
	in := &Input{Owner: "admin", FileName: "agent-bundle.json", Data: []byte(bundleFixture)}

	source, version, err := Detect(in)
	if err != nil {
		t.Fatalf("Detect() error: %s", err.Error())
	}
	if source == nil || source.Id != "bundle" {
		t.Fatalf("Detect() = %+v, want the bundle adapter", source)
	}
	if version != "2.1" {
		t.Errorf("detected version = %q, want 2.1", version)
	}

	bundle, err := Extract("", in)
	if err != nil {
		t.Fatalf("Extract() error: %s", err.Error())
	}

	// The source name from the file wins over the adapter id, so the plan and
	// the rename prefix say "hermes" rather than "bundle".
	if bundle.Source != "hermes" {
		t.Errorf("bundle source = %q, want hermes", bundle.Source)
	}

	// Two agents survive: the complete one and the one named by display name.
	if len(bundle.Agents) != 2 {
		t.Fatalf("got %d agents, want 2", len(bundle.Agents))
	}
	if bundle.Agents[1].Name != "Named By Display Name Only" {
		t.Errorf("agent fallback name = %q, want the display name", bundle.Agents[1].Name)
	}
	if !hasWarning(bundle, CategoryAgent, "#3") {
		t.Errorf("the nameless agent was dropped without a warning, warnings = %+v", bundle.Warnings)
	}
	if !hasWarning(bundle, CategoryAgent, "main") {
		t.Errorf("the dangling skill reference produced no warning, warnings = %+v", bundle.Warnings)
	}

	// An absent "enabled" means enabled; an explicit false is honoured.
	if len(bundle.Skills) != 2 || !bundle.Skills[0].Enabled || bundle.Skills[1].Enabled {
		t.Errorf("skill enabled flags = %+v, want [true false]", bundle.Skills)
	}

	if len(bundle.Providers) != 2 {
		t.Fatalf("got %d providers, want 2", len(bundle.Providers))
	}
	if bundle.Providers[0].Category != "Model" {
		t.Errorf("provider category = %q, want the Model default", bundle.Providers[0].Category)
	}
	if !hasWarning(bundle, CategoryProvider, "keyless") {
		t.Errorf("the provider without an API key produced no warning, warnings = %+v", bundle.Warnings)
	}

	// An MCP server with neither url nor command cannot be dialed, so it is
	// left out rather than imported as a broken row.
	if len(bundle.McpServers) != 1 {
		t.Fatalf("got %d MCP servers, want 1", len(bundle.McpServers))
	}
	if bundle.McpServers[0].Transport != "stdio" {
		t.Errorf("transport = %q, want stdio for a command-based server", bundle.McpServers[0].Transport)
	}
	if !hasWarning(bundle, CategoryServer, "broken") {
		t.Errorf("the unusable MCP server was dropped without a warning, warnings = %+v", bundle.Warnings)
	}

	// The empty chat is dropped, the orphan is kept but detached.
	if len(bundle.Chats) != 2 {
		t.Fatalf("got %d chats, want 2", len(bundle.Chats))
	}
	if bundle.Chats[0].Messages[1].Author != "AI" {
		t.Errorf("assistant author = %q, want AI", bundle.Chats[0].Messages[1].Author)
	}
	if bundle.Chats[1].Agent != "" {
		t.Errorf("orphan chat agent = %q, want it detached", bundle.Chats[1].Agent)
	}
	if bundle.Chats[1].Messages[0].Author != "user" {
		t.Errorf("missing author = %q, want the user default", bundle.Chats[1].Messages[0].Author)
	}
	if !hasWarning(bundle, CategoryChat, "empty") {
		t.Errorf("the empty chat was dropped without a warning, warnings = %+v", bundle.Warnings)
	}
}

func TestBundleExtractFromPath(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, bundleFileName), []byte(bundleFixture), 0o600); err != nil {
		t.Fatal(err)
	}

	// Scanning the directory must give the same result as uploading the file,
	// otherwise the two input modes are not interchangeable.
	bundle, err := Extract("bundle", &Input{Owner: "admin", Path: root})
	if err != nil {
		t.Fatalf("Extract() error: %s", err.Error())
	}
	if len(bundle.Agents) != 2 || len(bundle.Chats) != 2 {
		t.Errorf("directory scan gave %d agents and %d chats, want 2 and 2", len(bundle.Agents), len(bundle.Chats))
	}
	if bundle.SourcePath == "" {
		t.Errorf("bundle source path is empty, the run history would not say where it came from")
	}
}

// The bundle adapter must not claim files that belong to a native adapter, or
// auto-detect would route an OpenClaw config to the generic path and lose
// everything the native adapter knows how to read.
func TestBundleDoesNotClaimOpenClawConfig(t *testing.T) {
	root := openClawFixture(t)
	data, err := os.ReadFile(filepath.Join(root, openClawConfigFileName))
	if err != nil {
		t.Fatal(err)
	}

	adapter := &bundleAdapter{}
	matched, _, err := adapter.Detect(&Input{Owner: "admin", FileName: openClawConfigFileName, Data: data})
	if err != nil {
		t.Fatalf("Detect() error: %s", err.Error())
	}
	if matched {
		t.Errorf("the bundle adapter claimed an OpenClaw config")
	}

	source, _, err := Detect(&Input{Owner: "admin", Path: root})
	if err != nil {
		t.Fatalf("Detect() error: %s", err.Error())
	}
	if source == nil || source.Id != "openclaw" {
		t.Errorf("auto-detect routed an OpenClaw directory to %+v, want the openclaw adapter", source)
	}
}

func TestBundleRejectsUnrelatedJson(t *testing.T) {
	adapter := &bundleAdapter{}
	for _, data := range []string{`{"hello": "world"}`, `{"source": "x"}`, `not json at all`} {
		matched, _, err := adapter.Detect(&Input{Owner: "admin", Data: []byte(data)})
		if err != nil {
			t.Fatalf("Detect(%s) error: %s", data, err.Error())
		}
		if matched {
			t.Errorf("Detect(%s) claimed a file that is not a bundle", data)
		}
	}
}
