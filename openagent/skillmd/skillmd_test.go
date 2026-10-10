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

package skillmd

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseFrontMatter(t *testing.T) {
	raw := `---
name: pdf-tools
description: 'Read and split PDF files'
homepage: https://example.com/pdf
metadata:
  {
    "emoji": "hammer",
    "version": "2.1"
  }
---
# PDF tools

Use these when a PDF shows up.
`

	skill := Parse(raw)

	if skill.Name != "pdf-tools" || skill.DisplayName != "pdf-tools" {
		t.Errorf("name = %q / %q, want pdf-tools", skill.Name, skill.DisplayName)
	}
	// The quotes are YAML syntax, not part of the value.
	if skill.Description != "Read and split PDF files" {
		t.Errorf("description = %q", skill.Description)
	}
	if skill.Homepage != "https://example.com/pdf" {
		t.Errorf("homepage = %q", skill.Homepage)
	}
	if skill.Emoji != "hammer" {
		t.Errorf("emoji = %q, want it lifted out of the metadata block", skill.Emoji)
	}
	if !strings.Contains(skill.Metadata, `"version": "2.1"`) {
		t.Errorf("metadata = %q, want the whole indented block", skill.Metadata)
	}
	// The body is what an agent actually reads; the front matter must be gone
	// from it, and the original kept verbatim on SkillMd.
	if !strings.HasPrefix(skill.Content, "# PDF tools") {
		t.Errorf("content = %q, want the markdown body only", skill.Content)
	}
	if strings.Contains(skill.Content, "description:") {
		t.Errorf("content = %q, want the front matter stripped", skill.Content)
	}
	if skill.SkillMd != raw {
		t.Error("SkillMd was not kept verbatim")
	}
}

// A skill file that carries no front matter is still a usable skill: the whole
// file is its body.
func TestParseWithoutFrontMatter(t *testing.T) {
	raw := "# Just a document\n\nNo front matter here.\n"

	skill := Parse(raw)
	if skill.Name != "" {
		t.Errorf("name = %q, want empty", skill.Name)
	}
	if skill.Content != raw {
		t.Errorf("content = %q, want the whole file", skill.Content)
	}
}

// An opening --- with no closing one is malformed; treating the rest as body
// beats silently swallowing it into front matter.
func TestParseUnterminatedFrontMatter(t *testing.T) {
	raw := "---\nname: broken\n\n# Body that never got a closing marker\n"

	skill := Parse(raw)
	if skill.Name != "" {
		t.Errorf("name = %q, want empty for an unterminated block", skill.Name)
	}
	if skill.Content != raw {
		t.Errorf("content = %q, want the whole file", skill.Content)
	}
}

func TestParseQuotingStyles(t *testing.T) {
	cases := map[string]string{
		`name: bare`:         "bare",
		`name: 'single'`:     "single",
		`name: "double"`:     "double",
		`name:    padded   `: "padded",
	}
	for line, want := range cases {
		skill := Parse("---\n" + line + "\n---\nbody\n")
		if skill.Name != want {
			t.Errorf("%q gave name %q, want %q", line, skill.Name, want)
		}
	}
}

func TestLoadFolder(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "pdf-tools")
	refsDir := filepath.Join(dir, "references")
	if err := os.MkdirAll(refsDir, 0o755); err != nil {
		t.Fatal(err)
	}

	skillMd := "---\nname: pdf-tools\ndescription: Read PDFs\n---\nBody.\n"
	if err := os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte(skillMd), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(refsDir, "forms.md"), []byte("Form notes."), 0o600); err != nil {
		t.Fatal(err)
	}
	// A subdirectory under references/ is not a reference file.
	if err := os.MkdirAll(filepath.Join(refsDir, "nested"), 0o755); err != nil {
		t.Fatal(err)
	}

	skill, err := LoadFolder(dir)
	if err != nil {
		t.Fatalf("LoadFolder() error: %s", err.Error())
	}
	if skill.Name != "pdf-tools" {
		t.Errorf("name = %q", skill.Name)
	}
	if len(skill.References) != 1 || skill.References[0].Name != "forms.md" {
		t.Fatalf("references = %+v, want just forms.md", skill.References)
	}
	if skill.References[0].Content != "Form notes." {
		t.Errorf("reference content = %q", skill.References[0].Content)
	}
}

// A folder whose SKILL.md has no name falls back to the folder name, so a
// skill can never end up nameless.
func TestLoadFolderNameFallsBackToDirectory(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "unnamed-skill")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte("Just a body.\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	skill, err := LoadFolder(dir)
	if err != nil {
		t.Fatalf("LoadFolder() error: %s", err.Error())
	}
	if skill.Name != "unnamed-skill" {
		t.Errorf("name = %q, want the folder name", skill.Name)
	}
}

func TestLoadFolderMissingSkillMd(t *testing.T) {
	if _, err := LoadFolder(t.TempDir()); err == nil {
		t.Error("LoadFolder() accepted a folder with no SKILL.md")
	}
}
