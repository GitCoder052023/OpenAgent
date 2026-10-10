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

// Package skillmd reads skill folders -- a SKILL.md with YAML-ish front matter
// plus an optional references/ directory -- into plain structs.
//
// It is a leaf package on purpose. Both the storage layer, which saves skills
// as database rows, and the migration adapters, which read skills out of a
// third-party agent's install directory, need this parsing, and neither should
// have to import the other to get it.

package skillmd

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// File is one file shipped alongside SKILL.md, from the references/ directory.
type File struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// Skill is one skill folder as it exists on disk, with no storage concerns
// attached: no owner, no state, no timestamps.
type Skill struct {
	Name        string
	DisplayName string
	Description string
	Homepage    string
	Emoji       string
	Metadata    string
	Content     string
	SkillMd     string
	References  []File
}

// Parse reads the front matter of a raw SKILL.md and returns its fields
// together with the markdown body.
func Parse(raw string) *Skill {
	name, description, homepage, metadata, emoji, body := parseSkillMd(raw)
	return &Skill{
		Name:        name,
		DisplayName: name,
		Description: description,
		Homepage:    homepage,
		Emoji:       emoji,
		Metadata:    metadata,
		Content:     body,
		SkillMd:     raw,
	}
}

// parseSkillMd pulls the front matter apart and returns its fields plus the
// markdown body. Front-matter format:
//
//	---
//	name: <name>
//	description: '<desc>'   # may be single/double quoted or bare
//	homepage: <url>         # optional
//	metadata:               # optional JSON5-ish block
//	  { ... }
//	---
//	<markdown body>
func parseSkillMd(raw string) (name, description, homepage, metadata, emoji, body string) {
	// Must start with "---"
	trimmed := strings.TrimLeft(raw, " \t")
	if !strings.HasPrefix(trimmed, "---") {
		body = raw
		return
	}

	// Skip the opening "---" line
	afterOpen := raw[strings.Index(raw, "---")+3:]
	newlineIdx := strings.Index(afterOpen, "\n")
	if newlineIdx >= 0 {
		afterOpen = afterOpen[newlineIdx+1:]
	}

	// Find closing "---"
	closingIdx := strings.Index(afterOpen, "\n---")
	if closingIdx < 0 {
		body = raw
		return
	}

	frontMatter := afterOpen[:closingIdx]
	body = strings.TrimSpace(afterOpen[closingIdx+4:]) // skip "\n---"

	// -----------------------------------------------------------------------
	// Parse front-matter line by line.
	// We handle:
	//   key: bare value
	//   key: 'single-quoted value'
	//   key: "double-quoted value"
	//   metadata: <multi-line block until next top-level key or EOF>
	// -----------------------------------------------------------------------
	lines := strings.Split(frontMatter, "\n")
	var metaLines []string
	inMetadata := false

	for _, line := range lines {
		// A top-level key starts at column 0 with no leading whitespace
		// and contains at least one word character before the colon.
		isTopKey := len(line) > 0 && line[0] != ' ' && line[0] != '\t' && strings.Contains(line, ":")

		if isTopKey {
			key, val, _ := strings.Cut(line, ":")
			key = strings.TrimSpace(key)
			val = strings.TrimSpace(val)

			switch key {
			case "name":
				name = unquote(val)
				inMetadata = false
			case "description":
				description = unquote(val)
				inMetadata = false
			case "homepage":
				homepage = unquote(val)
				inMetadata = false
			case "metadata":
				inMetadata = true
				metaLines = nil
				if val != "" {
					metaLines = append(metaLines, val)
				}
			default:
				inMetadata = false
			}
		} else if inMetadata {
			metaLines = append(metaLines, line)
		}
	}

	metadata = strings.Join(metaLines, "\n")

	// Extract emoji: look for  "emoji": "<value>"
	if m := regexp.MustCompile(`"emoji"\s*:\s*"([^"]+)"`).FindStringSubmatch(metadata); len(m) > 1 {
		emoji = m[1]
	}

	return
}

// unquote strips surrounding single or double quotes from a YAML string value.
func unquote(s string) string {
	s = strings.TrimSpace(s)
	if len(s) >= 2 {
		if (s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'') {
			return s[1 : len(s)-1]
		}
	}
	return s
}

// LoadFolder reads {dir}/SKILL.md and all {dir}/references/* files and returns
// what they hold. Callers turn it into whatever their own layer needs.
func LoadFolder(dir string) (*Skill, error) {
	skillMdPath := filepath.Join(dir, "SKILL.md")
	rawBytes, err := os.ReadFile(skillMdPath)
	if err != nil {
		return nil, fmt.Errorf("cannot read SKILL.md at %s: %w", skillMdPath, err)
	}
	raw := string(rawBytes)

	name, description, homepage, metadata, emoji, content := parseSkillMd(raw)
	if name == "" {
		// Fall back to directory base-name
		name = filepath.Base(dir)
	}

	// Read references/
	var refs []File
	refsDir := filepath.Join(dir, "references")
	if entries, err2 := os.ReadDir(refsDir); err2 == nil {
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			refPath := filepath.Join(refsDir, e.Name())
			refBytes, err3 := os.ReadFile(refPath)
			if err3 != nil {
				continue
			}
			refs = append(refs, File{
				Name:    e.Name(),
				Content: string(refBytes),
			})
		}
	}

	return &Skill{
		Name:        name,
		DisplayName: name,
		Description: description,
		Homepage:    homepage,
		Emoji:       emoji,
		Metadata:    metadata,
		Content:     content,
		SkillMd:     raw,
		References:  refs,
	}, nil
}
