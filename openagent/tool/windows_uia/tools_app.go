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
	"context"
	"fmt"
	"math"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
)

// ---------------------------------------------------------------------------
// win_open_application
// ---------------------------------------------------------------------------

type winOpenApplicationBuiltin struct{}

func (b *winOpenApplicationBuiltin) GetName() string { return "win_open_application" }

func (b *winOpenApplicationBuiltin) GetDescription() string {
	return `Open a Windows application in the current interactive desktop session.

This tool is generic and does NOT hardcode specific apps. The model should pass a target such as:
- "calc" / "calc.exe"
- "taskmgr" / "taskmgr.exe"
- "winword" / "winword.exe"
- an absolute path to an executable

method:
- "auto" (default): prefer exe, fallback to shell/search
- "exe": run the executable
- "shell": use "cmd /c start" to open the target (best-effort)
- "search": open Start menu, type target and press Enter (fallback, less reliable)`
}

func (b *winOpenApplicationBuiltin) GetInputSchema() interface{} {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"properties": map[string]any{
			"target": map[string]any{
				"type":        "string",
				"description": "Application identifier: executable name, path, or a searchable name.",
			},
			"method": map[string]any{
				"type":        "string",
				"enum":        []string{"auto", "exe", "shell", "search"},
				"default":     "auto",
				"description": "Launch method preference.",
			},
			"wait_seconds": map[string]any{
				"type":        "number",
				"default":     2,
				"minimum":     0,
				"maximum":     30,
				"description": "Seconds to wait after launching (best-effort).",
			},
		},
		"required": []string{"target"},
	}
}

func (b *winOpenApplicationBuiltin) Execute(ctx context.Context, arguments map[string]any) (*protocol.CallToolResult, error) {
	target, _ := arguments["target"].(string)
	target = strings.TrimSpace(target)
	if target == "" {
		return winToolError("missing required parameter: target"), nil
	}
	method, _ := arguments["method"].(string)
	method = strings.ToLower(strings.TrimSpace(method))
	if method == "" {
		method = "auto"
	}
	waitSecs := 2.0
	if v, ok := parseNumber(arguments["wait_seconds"]); ok && v >= 0 {
		waitSecs = math.Min(30, v)
	}

	launch := func(m string) error {
		switch m {
		case "exe":
			// LookPath for non-absolute paths.
			cmdTarget := target
			if !filepath.IsAbs(cmdTarget) && !strings.Contains(cmdTarget, string(filepath.Separator)) {
				if p, err := exec.LookPath(cmdTarget); err == nil {
					cmdTarget = p
				}
			}
			cmd := exec.CommandContext(ctx, cmdTarget)
			return cmd.Start()
		case "shell":
			// Best-effort: `cmd.exe /C start "" <target>`
			cmdExe := resolveCmdExe()
			cmd := exec.CommandContext(ctx, cmdExe, "/C", "start", "", target)
			return cmd.Start()
		case "search":
			// Fallback: open Start and type.
			if err := sendKeyTap("win"); err != nil {
				return err
			}
			time.Sleep(350 * time.Millisecond)
			if err := sendTextInput(target); err != nil {
				return err
			}
			time.Sleep(150 * time.Millisecond)
			if err := sendKeyTap("enter"); err != nil {
				return err
			}
			return nil
		default:
			return fmt.Errorf("unsupported method: %s", m)
		}
	}

	if method == "auto" {
		errExe := launch("exe")
		if errExe != nil {
			errShell := launch("shell")
			if errShell != nil {
				errSearch := launch("search")
				if errSearch != nil {
					return winToolError(fmt.Sprintf(
						"failed to launch target via auto (exe: %v; shell: %v; search: %v)",
						errExe, errShell, errSearch,
					)), nil
				}
			}
		}
	} else {
		if err := launch(method); err != nil {
			return winToolError(fmt.Sprintf("failed to launch target via %s: %s", method, err.Error())), nil
		}
	}

	if waitSecs > 0 {
		time.Sleep(time.Duration(waitSecs * float64(time.Second)))
	}

	return winToolText(fmt.Sprintf(`{"success":true,"target":%q,"method":%q}`, target, method)), nil
}

// ---------------------------------------------------------------------------
// win_focus_window
// ---------------------------------------------------------------------------

type winFocusWindowBuiltin struct{}

func (b *winFocusWindowBuiltin) GetName() string { return "win_focus_window" }

func (b *winFocusWindowBuiltin) GetDescription() string {
	return `Focus (bring to foreground) an application window.

Preferred criteria is "title_contains". If multiple match, the first found is focused.`
}

func (b *winFocusWindowBuiltin) GetInputSchema() interface{} {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"properties": map[string]any{
			"title_contains": map[string]any{
				"type":        "string",
				"description": "Substring of the window title to match.",
			},
		},
		"required": []string{"title_contains"},
	}
}

func (b *winFocusWindowBuiltin) Execute(ctx context.Context, arguments map[string]any) (*protocol.CallToolResult, error) {
	_ = ctx
	title, _ := arguments["title_contains"].(string)
	title = strings.TrimSpace(title)
	if title == "" {
		return winToolError("missing required parameter: title_contains"), nil
	}
	hwnd, err := findTopLevelWindowByTitleContains(title)
	if err != nil {
		return winToolError(err.Error()), nil
	}
	if err := focusWindow(hwnd); err != nil {
		return winToolError(err.Error()), nil
	}
	return winToolText(fmt.Sprintf(`{"success":true,"hwnd":%d}`, hwnd)), nil
}
