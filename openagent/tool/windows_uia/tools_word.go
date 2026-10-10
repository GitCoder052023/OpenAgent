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
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
	"github.com/uandersonricardo/uiautomation"
)

// ---------------------------------------------------------------------------
// win_word_write_and_save (P0 high-level primitive)
// ---------------------------------------------------------------------------
//
// P0 ships a single high-level tool to ensure we can reliably satisfy the
// end-to-end requirement (Word GUI must open, write content, save to Desktop).
//
// Later phases can split this into lower-level primitives (find/interact/save).

type winWordWriteAndSaveBuiltin struct{}

func (b *winWordWriteAndSaveBuiltin) GetName() string { return "win_word_write_and_save" }

func (b *winWordWriteAndSaveBuiltin) GetDescription() string {
	return `Legacy fallback for Word write+save in one call.

Prefer generic primitives for new plans:
- win_find_element
- win_interact
- win_wait
- win_assert`
}

func (b *winWordWriteAndSaveBuiltin) GetInputSchema() interface{} {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"properties": map[string]any{
			"word_target": map[string]any{
				"type":        "string",
				"default":     "winword",
				"description": "How to launch Word if needed (passed to win_open_application semantics). Examples: \"winword\", \"winword.exe\".",
			},
			"open_if_needed": map[string]any{
				"type":        "boolean",
				"default":     true,
				"description": "If true, attempts to launch Word before writing/saving.",
			},
			"content": map[string]any{
				"type":        "string",
				"description": "Text content to write into Word.",
			},
			"file_name": map[string]any{
				"type":        "string",
				"default":     "CPU_Report.docx",
				"description": "Output file name on Desktop.",
			},
			"overwrite": map[string]any{
				"type":        "boolean",
				"default":     true,
				"description": "Whether to overwrite if file exists.",
			},
		},
		"required": []string{"content"},
	}
}

func (b *winWordWriteAndSaveBuiltin) Execute(ctx context.Context, arguments map[string]any) (*protocol.CallToolResult, error) {
	wordTarget, _ := arguments["word_target"].(string)
	wordTarget = strings.TrimSpace(wordTarget)
	if wordTarget == "" {
		wordTarget = "winword"
	}
	openIfNeeded := true
	if v, ok := arguments["open_if_needed"].(bool); ok {
		openIfNeeded = v
	}
	content, _ := arguments["content"].(string)
	if strings.TrimSpace(content) == "" {
		return winToolError("missing required parameter: content"), nil
	}
	fileName, _ := arguments["file_name"].(string)
	fileName = strings.TrimSpace(fileName)
	if fileName == "" {
		fileName = "CPU_Report.docx"
	}
	overwrite := true
	if v, ok := arguments["overwrite"].(bool); ok {
		overwrite = v
	}
	desktop := resolveDesktopPath()
	if desktop == "" {
		return winToolError("failed to resolve Desktop path"), nil
	}
	outPath := filepath.Join(desktop, fileName)

	// If Word is already open, do NOT launch a new instance (prevents multi-open).
	_, focusErr := b.focusWord()
	if focusErr != nil && openIfNeeded {
		cmdExe := resolveCmdExe()
		_ = exec.CommandContext(ctx, cmdExe, "/C", "start", "", wordTarget).Start()
		time.Sleep(2 * time.Second)
		_, _ = b.focusWord()
	}

	// Write content via clipboard paste (more reliable than direct typing for Word).
	if err := setClipboardUnicodeText(content); err == nil {
		_ = sendKeyTap("a", "ctrl")
		time.Sleep(80 * time.Millisecond)
		_ = sendKeyTap("v", "ctrl")
	} else {
		_ = sendTextInput(content)
	}
	time.Sleep(250 * time.Millisecond)

	// Save As: Ctrl+Shift+S then use UIA to fill the dialog reliably.
	_ = sendKeyTap("s", "ctrl", "shift")
	if err := b.handleSaveAsDialog(outPath, overwrite); err != nil {
		// Fallback: type path and press Enter.
		time.Sleep(900 * time.Millisecond)
		_ = sendTextInput(outPath)
		time.Sleep(200 * time.Millisecond)
		_ = sendKeyTap("enter")
		if overwrite {
			time.Sleep(600 * time.Millisecond)
			_ = sendKeyTap("y")
			_ = sendKeyTap("enter")
		}
	}

	// Verify file exists.
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if st, err := os.Stat(outPath); err == nil && !st.IsDir() {
			bb, _ := json.Marshal(map[string]any{
				"success": true,
				"path":    outPath,
			})
			return winToolText(string(bb)), nil
		}
		time.Sleep(300 * time.Millisecond)
	}
	return winToolError(fmt.Sprintf("file not found after save: %s", outPath)), nil
}

func (b *winWordWriteAndSaveBuiltin) focusWord() (uintptr, error) {
	for _, hint := range []string{"Word", "Microsoft Word", "WPS Writer", "文档", "Word 文档"} {
		hwnd, err := findTopLevelWindowByTitleContains(hint)
		if err == nil {
			return hwnd, focusWindow(hwnd)
		}
	}
	return 0, fmt.Errorf("unable to locate Word window to focus")
}

func (b *winWordWriteAndSaveBuiltin) handleSaveAsDialog(path string, overwrite bool) error {
	engine, err := getUiaEngine()
	if err != nil {
		return err
	}

	// Wait for Save As dialog window.
	var dlgHwnd uintptr
	deadline := time.Now().Add(6 * time.Second)
	for time.Now().Before(deadline) {
		for _, t := range []string{"另存为", "Save As", "保存", "Save"} {
			if hwnd, err := findTopLevelWindowByTitleContains(t); err == nil && hwnd != 0 {
				dlgHwnd = hwnd
				break
			}
		}
		if dlgHwnd != 0 {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	if dlgHwnd == 0 {
		return fmt.Errorf("save dialog not found")
	}
	_ = focusWindow(dlgHwnd)

	root, err := engine.elementFromHandle(dlgHwnd)
	if err != nil {
		return err
	}

	// Find file name edit box: prefer Edit control.
	editCond, err := engine.createPropertyConditionControlType(uiautomation.EditControlTypeId)
	if err != nil {
		return err
	}
	editEl, err := engine.findFirst(root, uiautomation.TreeScopeDescendants, editCond)
	if err != nil {
		return err
	}

	// Set via ValuePattern if available; fallback to focus + typing.
	_ = globalSta.run(func() error {
		patObj, err := editEl.GetCurrentPatternAs(uiautomation.ValuePatternId, uiautomation.IID_IUIAutomationValuePattern)
		if err == nil && patObj != nil {
			vp := (*uiautomation.ValuePattern)(unsafe.Pointer(patObj))
			if err := vp.SetValue(path); err == nil {
				return nil
			}
		}
		_ = editEl.SetFocus()
		// Use clipboard paste for safety (path contains backslashes/colon).
		if err := setClipboardUnicodeText(path); err == nil {
			_ = sendKeyTap("a", "ctrl")
			time.Sleep(50 * time.Millisecond)
			_ = sendKeyTap("v", "ctrl")
			return nil
		}
		_ = sendTextInput(path)
		return nil
	})

	// Confirm save: press Enter in the dialog (more reliable than "first button" heuristics).
	time.Sleep(120 * time.Millisecond)
	_ = sendKeyTap("enter")

	// Overwrite confirmation: best-effort click Yes.
	if overwrite {
		time.Sleep(400 * time.Millisecond)
		for _, yesHint := range []string{"确认另存为", "Confirm Save As", "确认保存", "Confirm Save", "Microsoft Word"} {
			if hwnd, err := findTopLevelWindowByTitleContains(yesHint); err == nil && hwnd != 0 && hwnd != dlgHwnd {
				confRoot, err := engine.elementFromHandle(hwnd)
				if err != nil {
					continue
				}
				for _, yesLabel := range []string{"是", "Yes"} {
					yesNameCond, err := engine.createPropertyConditionString(uiautomation.NamePropertyId, yesLabel, uiautomation.PropertyConditionFlagsMatchSubstring)
					if err != nil {
						continue
					}
					yesEl, err := engine.findFirst(confRoot, uiautomation.TreeScopeDescendants, yesNameCond)
					if err == nil && yesEl != nil {
						_ = globalSta.run(func() error {
							patObj, err := yesEl.GetCurrentPatternAs(uiautomation.InvokePatternId, uiautomation.IID_IUIAutomationInvokePattern)
							if err == nil && patObj != nil {
								ip := (*uiautomation.InvokePattern)(unsafe.Pointer(patObj))
								_ = ip.Invoke()
							}
							return nil
						})
						return nil
					}
				}
			}
		}
	}
	return nil
}
