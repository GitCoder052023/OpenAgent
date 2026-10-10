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

//go:build windows

package windowsuia

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
	"github.com/the-open-agent/openagent/tool/builtin_tool"
)

// BuiltinTools returns all Windows UIA builtin tools.
func BuiltinTools() []builtin_tool.BuiltinTool {
	return []builtin_tool.BuiltinTool{
		&winOpenApplicationBuiltin{},
		&winFocusWindowBuiltin{},
		&winFindElementBuiltin{},
		&winInteractBuiltin{},
		&winWaitBuiltin{},
		&winAssertBuiltin{},
		&winReadSystemMetricBuiltin{},
		&winWordWriteAndSaveBuiltin{},
		&winEmergencyStopBuiltin{},
	}
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

func winToolText(text string) *protocol.CallToolResult {
	return &protocol.CallToolResult{
		IsError: false,
		Content: []protocol.Content{
			&protocol.TextContent{Type: "text", Text: text},
		},
	}
}

func winToolError(text string) *protocol.CallToolResult {
	return &protocol.CallToolResult{
		IsError: true,
		Content: []protocol.Content{
			&protocol.TextContent{Type: "text", Text: text},
		},
	}
}

// resolveDesktopPath tries to resolve the current user's desktop directory.
// It handles OneDrive redirected desktops by checking common locations.
func resolveDesktopPath() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return ""
	}
	// Prefer OneDrive Desktop if present (common on Win11).
	oneDriveDesktop := filepath.Join(home, "OneDrive", "Desktop")
	if st, err := os.Stat(oneDriveDesktop); err == nil && st.IsDir() {
		return oneDriveDesktop
	}
	return filepath.Join(home, "Desktop")
}

func resolveCmdExe() string {
	windir := os.Getenv("WINDIR")
	if windir == "" {
		windir = "C:\\Windows"
	}
	return filepath.Join(windir, "System32", "cmd.exe")
}

func parseNumber(v any) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case int:
		return float64(x), true
	case int64:
		return float64(x), true
	case json.Number:
		f, err := x.Float64()
		return f, err == nil
	default:
		return 0, false
	}
}
