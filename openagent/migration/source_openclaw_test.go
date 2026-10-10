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
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

// openClawFixture writes a small but realistic ~/.openclaw tree: a JSON5 config
// with comments and trailing commas, one skill folder, and one JSONL transcript.
func openClawFixture(t *testing.T) string {
	t.Helper()

	root := t.TempDir()

	config := `{
  // OpenClaw config, written by hand -- comments and trailing commas included.
  "version": "1.4.2",
  "agents": {
    "defaults": {
      "model": "anthropic/claude-sonnet-4",
      "contextLimit": 32000,
    },
    "entries": {
      "main": {
        "identity": {"name": "Main Bot", "emoji": "run"},
        "systemPrompt": "You are a helpful assistant.",
        "skills": ["pdf-tools"],
        "model": {"primary": "openai/gpt-4o", "fallbacks": ["anthropic/claude-sonnet-4"]},
      },
      "scribe": {
        "identity": {"name": "Scribe"},
        "prompt": "You take notes.",
      },
    },
  },
  "skills": {
    "entries": {
      "pdf-tools": {"enabled": true},
    },
  },
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {"ROOT": "/tmp"},
    },
    "remote-search": {
      "url": "https://mcp.example.com/sse",
      "type": "sse",
      "headers": {"Authorization": "Bearer sk-mcp-secret"},
    },
  },
  "models": {
    "openai": {"apiKey": "sk-openai-secret", "baseUrl": "https://api.openai.com/v1"},
    "anthropic": {"apiKey": "sk-ant-secret"},
  },
  "cron": {"jobs": [{"name": "daily"}]},
}`
	if err := os.WriteFile(filepath.Join(root, "openclaw.json"), []byte(config), 0o600); err != nil {
		t.Fatal(err)
	}

	skillDir := filepath.Join(root, "skills", "pdf-tools")
	if err := os.MkdirAll(skillDir, 0o700); err != nil {
		t.Fatal(err)
	}
	skillMd := `---
name: pdf-tools
description: Read and split PDF files.
---

# PDF Tools

Use pdftotext to extract text.
`
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte(skillMd), 0o600); err != nil {
		t.Fatal(err)
	}

	sessionsDir := filepath.Join(root, "agents", "main", "sessions")
	if err := os.MkdirAll(sessionsDir, 0o700); err != nil {
		t.Fatal(err)
	}
	transcript := `{"role":"user","content":"hello there","timestamp":"2026-03-01T10:00:00Z"}
{"role":"assistant","content":[{"type":"text","text":"Hi! How can I help?"}],"timestamp":"2026-03-01T10:00:02Z"}
{"type":"tool_use","name":"bash","input":{"command":"ls"}}
{"role":"user","content":"thanks","timestamp":"2026-03-01T10:00:30Z"}
`
	if err := os.WriteFile(filepath.Join(sessionsDir, "2026-03-01.jsonl"), []byte(transcript), 0o600); err != nil {
		t.Fatal(err)
	}

	return root
}

func TestOpenClawDetectAndExtract(t *testing.T) {
	root := openClawFixture(t)

	source, version, err := Detect(&Input{Owner: "admin", Path: root})
	if err != nil {
		t.Fatalf("Detect() error: %s", err.Error())
	}
	if source == nil || source.Id != "openclaw" {
		t.Fatalf("Detect() = %v, want openclaw", source)
	}
	if version != "1.4.2" {
		t.Errorf("version = %q, want 1.4.2", version)
	}

	bundle, err := Extract("", &Input{Owner: "admin", Path: root})
	if err != nil {
		t.Fatalf("Extract() error: %s", err.Error())
	}

	if len(bundle.Agents) != 2 {
		t.Fatalf("got %d agents, want 2", len(bundle.Agents))
	}
	main := bundle.Agents[0]
	if main.DisplayName != "Main Bot" {
		t.Errorf("agent displayName = %q, want %q", main.DisplayName, "Main Bot")
	}
	if main.Prompt != "You are a helpful assistant." {
		t.Errorf("agent prompt = %q", main.Prompt)
	}
	if len(main.Skills) != 1 || main.Skills[0] != "pdf-tools" {
		t.Errorf("agent skills = %v, want [pdf-tools]", main.Skills)
	}
	// "scribe" inherits the default model, so it must not lose its provider.
	scribe := bundle.Agents[1]
	if scribe.ModelProvider == "" {
		t.Errorf("agent %q has no model provider, defaults were not merged", scribe.Name)
	}

	if len(bundle.Providers) != 2 {
		t.Fatalf("got %d providers, want 2", len(bundle.Providers))
	}
	foundKey := false
	for _, provider := range bundle.Providers {
		if provider.ClientSecret == "sk-openai-secret" {
			foundKey = true
		}
	}
	if !foundKey {
		t.Error("the OpenAI API key was not carried over")
	}
	// A key that arrives from the "models" block must not also be reported as
	// missing: the warning is what the preview shows the user.
	for _, warning := range bundle.Warnings {
		if warning.Category == "provider" {
			t.Errorf("provider warning %q was raised even though both keys are in the config", warning.Reason)
		}
	}

	if len(bundle.McpServers) != 2 {
		t.Fatalf("got %d MCP servers, want 2", len(bundle.McpServers))
	}
	var stdio, remote *BundleMcpServer
	for _, server := range bundle.McpServers {
		if server.Command != "" {
			stdio = server
		} else {
			remote = server
		}
	}
	if stdio == nil || stdio.Command != "npx" || len(stdio.Args) != 3 {
		t.Errorf("stdio MCP server was not extracted: %+v", stdio)
	}
	if remote == nil || remote.Url != "https://mcp.example.com/sse" {
		t.Errorf("URL MCP server was not extracted: %+v", remote)
	}

	if len(bundle.Skills) != 1 || bundle.Skills[0].Name != "pdf-tools" {
		t.Fatalf("got %d skills, want the pdf-tools skill", len(bundle.Skills))
	}

	if len(bundle.Chats) != 1 {
		t.Fatalf("got %d chats, want 1", len(bundle.Chats))
	}
	chat := bundle.Chats[0]
	if len(chat.Messages) != 3 {
		t.Fatalf("got %d messages, want 3 (the tool_use event is not a turn)", len(chat.Messages))
	}
	if chat.Messages[1].Author != "AI" {
		t.Errorf("assistant message author = %q, want AI", chat.Messages[1].Author)
	}
	if chat.Messages[1].Text != "Hi! How can I help?" {
		t.Errorf("assistant text = %q, structured content was not flattened", chat.Messages[1].Text)
	}

	// The cron section has no OpenAgent equivalent and must be reported, not dropped.
	foundCronWarning := false
	for _, warning := range bundle.Warnings {
		if warning.Item == "cron" {
			foundCronWarning = true
		}
	}
	if !foundCronWarning {
		t.Errorf("the unmappable cron section produced no warning, warnings = %+v", bundle.Warnings)
	}
}

func TestOpenClawExtractFromZip(t *testing.T) {
	root := openClawFixture(t)

	buffer := &bytes.Buffer{}
	writer := zip.NewWriter(buffer)
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		entry, err := writer.Create(filepath.ToSlash(filepath.Join("openclaw", relative)))
		if err != nil {
			return err
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		_, err = entry.Write(data)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}

	bundle, err := Extract("openclaw", &Input{Owner: "admin", FileName: "openclaw.zip", Data: buffer.Bytes()})
	if err != nil {
		t.Fatalf("Extract() error: %s", err.Error())
	}

	// An uploaded archive must yield the same result as scanning the directory,
	// otherwise the two input modes are not interchangeable.
	if len(bundle.Skills) != 1 {
		t.Errorf("got %d skills from the archive, want 1", len(bundle.Skills))
	}
	if len(bundle.Chats) != 1 {
		t.Errorf("got %d chats from the archive, want 1", len(bundle.Chats))
	}
	if len(bundle.Agents) != 2 {
		t.Errorf("got %d agents from the archive, want 2", len(bundle.Agents))
	}
}

func TestOpenClawExtractFromConfigOnly(t *testing.T) {
	root := openClawFixture(t)
	data, err := os.ReadFile(filepath.Join(root, "openclaw.json"))
	if err != nil {
		t.Fatal(err)
	}

	bundle, err := Extract("openclaw", &Input{Owner: "admin", FileName: "openclaw.json", Data: data})
	if err != nil {
		t.Fatalf("Extract() error: %s", err.Error())
	}

	if len(bundle.Providers) != 2 || len(bundle.McpServers) != 2 {
		t.Errorf("config-only import lost providers or MCP servers: %d providers, %d servers",
			len(bundle.Providers), len(bundle.McpServers))
	}
	// Skills and transcripts live on disk, so a bare config cannot carry them --
	// but the user has to be told that rather than silently getting nothing.
	if len(bundle.Skills) != 0 {
		t.Errorf("got %d skills from a bare config, want 0", len(bundle.Skills))
	}
	foundSkillWarning := false
	foundChatWarning := false
	for _, warning := range bundle.Warnings {
		if warning.Category == "skill" {
			foundSkillWarning = true
		}
		if warning.Category == "chat" {
			foundChatWarning = true
		}
	}
	if !foundSkillWarning || !foundChatWarning {
		t.Errorf("a bare config did not warn about skills and transcripts, warnings = %+v", bundle.Warnings)
	}
}
