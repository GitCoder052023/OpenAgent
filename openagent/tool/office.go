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
	"os"
	"path/filepath"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
)

// ResolveOutputPath returns path unchanged if it is absolute.
// For relative paths it resolves them against the current user's Documents
// folder so that files created by the AI land in a predictable, user-visible
// location rather than in the server's working directory.
//
// Resolution order:
//  1. XDG_DOCUMENTS_DIR environment variable (Linux / freedesktop standard)
//  2. ~/Documents as a cross-platform fallback (Windows, macOS, Linux)
func ResolveOutputPath(path string) string {
	if filepath.IsAbs(path) {
		return path
	}
	if xdgDocs := os.Getenv("XDG_DOCUMENTS_DIR"); xdgDocs != "" {
		return filepath.Join(xdgDocs, path)
	}
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return path
	}
	return filepath.Join(homeDir, "Documents", path)
}

// officeSubType enumerates the allowed SubType values for OfficeTool.
type officeSubType string

const (
	officeSubTypeAll             officeSubType = "All"
	officeSubTypeWordRead        officeSubType = "Word Read"
	officeSubTypeWordWrite       officeSubType = "Word Write"
	officeSubTypeExcelRead       officeSubType = "Excel Read"
	officeSubTypeExcelWrite      officeSubType = "Excel Write"
	officeSubTypePowerPointRead  officeSubType = "PowerPoint Read"
	officeSubTypePowerPointWrite officeSubType = "PowerPoint Write"
)

// allOfficeTools is the full ordered list returned when SubType is "All".
var allOfficeTools = []BuiltinTool{
	&wordReadBuiltin{},
	&wordWriteBuiltin{},
	&excelReadBuiltin{},
	&excelWriteBuiltin{},
	&pptxReadBuiltin{},
	&pptxWriteBuiltin{},
	&pptxTemplateAnalyzeBuiltin{},
	&pptxTemplateFillBuiltin{},
}

// officeToolBySubType maps each specific SubType to its exposed tools.
var officeToolBySubType = map[officeSubType][]BuiltinTool{
	officeSubTypeWordRead:       {&wordReadBuiltin{}},
	officeSubTypeWordWrite:      {&wordWriteBuiltin{}},
	officeSubTypeExcelRead:      {&excelReadBuiltin{}},
	officeSubTypeExcelWrite:     {&excelWriteBuiltin{}},
	officeSubTypePowerPointRead: {&pptxReadBuiltin{}},
	officeSubTypePowerPointWrite: {
		&pptxWriteBuiltin{},
		&pptxTemplateAnalyzeBuiltin{},
		&pptxTemplateFillBuiltin{},
	},
}

// OfficeTool is the Tool Type "office".
// It exposes read/write tools for Word (.docx), Excel (.xlsx), and PowerPoint (.pptx).
// SubType controls which tool(s) are exposed: "All" exposes all tools; any specific
// SubType (e.g. "Word Read") exposes only that single tool.
type OfficeTool struct {
	subType officeSubType
}

func (p *OfficeTool) BuiltinTools() []BuiltinTool {
	if p.subType == officeSubTypeAll || p.subType == "" {
		return allOfficeTools
	}
	if tools, ok := officeToolBySubType[p.subType]; ok {
		return tools
	}
	return allOfficeTools
}

// ── shared response helpers ───────────────────────────────────────────────────

func officeToolText(text string) *protocol.CallToolResult {
	return &protocol.CallToolResult{
		IsError: false,
		Content: []protocol.Content{
			&protocol.TextContent{Type: "text", Text: text},
		},
	}
}

func officeToolError(text string) *protocol.CallToolResult {
	return &protocol.CallToolResult{
		IsError: true,
		Content: []protocol.Content{
			&protocol.TextContent{Type: "text", Text: text},
		},
	}
}
