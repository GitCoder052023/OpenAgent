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

package tool

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
	"github.com/carmel/gooxml/document"
)

// ── Word read ─────────────────────────────────────────────────────────────────

type wordReadBuiltin struct{}

func (t *wordReadBuiltin) GetName() string { return "word_read" }

func (t *wordReadBuiltin) GetDescription() string {
	return `Read text content from a Word (.docx) file and return it as plain text.
- path (required): absolute or relative path to the .docx file.`
}

func (t *wordReadBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"path": map[string]interface{}{
				"type":        "string",
				"description": "Path to the .docx file to read.",
			},
		},
		"required": []string{"path"},
	}
}

func (t *wordReadBuiltin) Execute(_ context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	path, ok := arguments["path"].(string)
	if !ok || strings.TrimSpace(path) == "" {
		return officeToolError("Missing required parameter: path"), nil
	}

	text, err := readWordFile(path)
	if err != nil {
		return officeToolError(fmt.Sprintf("Failed to read Word file: %s", err.Error())), nil
	}
	if strings.TrimSpace(text) == "" {
		return officeToolError("The Word document is empty"), nil
	}
	return officeToolText(text), nil
}

// ── Word write ────────────────────────────────────────────────────────────────

type wordWriteBuiltin struct{}

func (t *wordWriteBuiltin) GetName() string { return "word_write" }

func (t *wordWriteBuiltin) GetDescription() string {
	return `Write text content to a Word (.docx) file. Creates a new file; overwrites if it already exists.
- path (required): output path for the .docx file. Absolute paths are used as-is. Relative paths or bare filenames are resolved inside the current user's Documents folder.
- content (required): text to write. Each newline becomes a new paragraph.`
}

func (t *wordWriteBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"path": map[string]interface{}{
				"type":        "string",
				"description": "Output path for the .docx file.",
			},
			"content": map[string]interface{}{
				"type":        "string",
				"description": "Text content to write. Newlines become paragraph breaks.",
			},
		},
		"required": []string{"path", "content"},
	}
}

func (t *wordWriteBuiltin) Execute(_ context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	path, ok := arguments["path"].(string)
	if !ok || strings.TrimSpace(path) == "" {
		return officeToolError("Missing required parameter: path"), nil
	}
	content, ok := arguments["content"].(string)
	if !ok {
		return officeToolError("Missing required parameter: content"), nil
	}

	resolvedPath := ResolveOutputPath(path)
	if err := writeWordFile(path, content); err != nil {
		return officeToolError(fmt.Sprintf("Failed to write Word file: %s", err.Error())), nil
	}
	return officeToolText(fmt.Sprintf("Successfully wrote Word file: %s", resolvedPath)), nil
}

// ── gooxml helpers ────────────────────────────────────────────────────────────

func readWordFile(path string) (string, error) {
	doc, err := document.Open(path)
	if err != nil {
		return "", err
	}

	var parts []string
	for _, para := range doc.Paragraphs() {
		var paraText string
		for _, run := range para.Runs() {
			paraText += run.Text()
		}
		parts = append(parts, paraText)
	}
	return strings.Join(parts, "\n"), nil
}

func writeWordFile(path string, content string) error {
	path = ResolveOutputPath(path)
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("failed to create directory %q: %w", dir, err)
	}

	doc := document.New()
	for _, line := range strings.Split(content, "\n") {
		para := doc.AddParagraph()
		run := para.AddRun()
		run.AddText(line)
	}
	return doc.SaveToFile(path)
}
