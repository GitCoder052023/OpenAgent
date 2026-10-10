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
	"strings"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
)

// ---------------------------------------------------------------------------
// win_find_element
// ---------------------------------------------------------------------------

type winFindElementBuiltin struct{}

func (b *winFindElementBuiltin) GetName() string { return "win_find_element" }

func (b *winFindElementBuiltin) GetDescription() string {
	return `Find a UI element in a window via generic UIA criteria and return an element_id for later operations.

Recommended planning pattern:
1) win_focus_window / win_find_element
2) win_interact (click / set_text / get_text)
3) win_wait / win_assert for verification`
}

func (b *winFindElementBuiltin) GetInputSchema() interface{} {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"properties": map[string]any{
			"window_title_contains": map[string]any{
				"type":        "string",
				"description": "Top-level window title substring.",
			},
			"name_contains": map[string]any{
				"type":        "string",
				"description": "Element Name substring (optional).",
			},
			"class_name": map[string]any{
				"type":        "string",
				"description": "Element class name substring (optional).",
			},
			"control_type": map[string]any{
				"type":        "string",
				"description": "Optional logical control type: button/edit/document/window/menuitem/text/listitem.",
			},
		},
		"required": []string{"window_title_contains"},
	}
}

func (b *winFindElementBuiltin) Execute(ctx context.Context, arguments map[string]any) (*protocol.CallToolResult, error) {
	_ = ctx
	windowTitleContains, _ := arguments["window_title_contains"].(string)
	nameContains, _ := arguments["name_contains"].(string)
	className, _ := arguments["class_name"].(string)
	controlType, _ := arguments["control_type"].(string)

	engine, err := getUiaEngine()
	if err != nil {
		return winToolError(err.Error()), nil
	}
	_, meta, err := engine.findElementByCriteria(windowTitleContains, nameContains, className, controlType)
	if err != nil {
		return winToolError(err.Error()), nil
	}
	bb, _ := json.Marshal(map[string]any{
		"success": true,
		"element": meta,
	})
	return winToolText(string(bb)), nil
}

// ---------------------------------------------------------------------------
// win_interact
// ---------------------------------------------------------------------------

type winInteractBuiltin struct{}

func (b *winInteractBuiltin) GetName() string { return "win_interact" }

func (b *winInteractBuiltin) GetDescription() string {
	return `Interact with a previously found UI element.

Supported actions:
- click
- set_text (requires text)
- get_text
- focus
- hotkey (without element_id, send keyboard shortcut globally to focused window)`
}

func (b *winInteractBuiltin) GetInputSchema() interface{} {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"properties": map[string]any{
			"action": map[string]any{
				"type": "string",
				"enum": []string{"click", "set_text", "get_text", "focus", "hotkey"},
			},
			"element_id": map[string]any{
				"type":        "string",
				"description": "Element id from win_find_element. Not required for action=hotkey.",
			},
			"text": map[string]any{
				"type":        "string",
				"description": "Text used by action=set_text.",
			},
			"keys": map[string]any{
				"type":        "array",
				"description": "Hotkey keys, e.g. [\"ctrl\",\"shift\",\"s\"] or [\"enter\"].",
				"items": map[string]any{
					"type": "string",
				},
			},
		},
		"required": []string{"action"},
	}
}

func (b *winInteractBuiltin) Execute(ctx context.Context, arguments map[string]any) (*protocol.CallToolResult, error) {
	_ = ctx
	action, _ := arguments["action"].(string)
	action = strings.ToLower(strings.TrimSpace(action))
	elementID, _ := arguments["element_id"].(string)
	text, _ := arguments["text"].(string)

	engine, err := getUiaEngine()
	if err != nil {
		return winToolError(err.Error()), nil
	}

	if action == "hotkey" {
		rawKeys, _ := arguments["keys"].([]any)
		keys := make([]string, 0, len(rawKeys))
		for _, k := range rawKeys {
			s, _ := k.(string)
			s = strings.TrimSpace(strings.ToLower(s))
			if s != "" {
				keys = append(keys, s)
			}
		}
		if len(keys) == 0 {
			return winToolError("keys is required for action=hotkey"), nil
		}
		if len(keys) == 1 {
			if err := sendKeyTap(keys[0]); err != nil {
				return winToolError(err.Error()), nil
			}
		} else {
			mainKey := keys[len(keys)-1]
			mods := keys[:len(keys)-1]
			if err := sendKeyTap(mainKey, mods...); err != nil {
				return winToolError(err.Error()), nil
			}
		}
		return winToolText(`{"success":true}`), nil
	}

	if strings.TrimSpace(elementID) == "" {
		return winToolError("element_id is required for this action"), nil
	}

	switch action {
	case "click":
		if err := engine.clickElement(elementID); err != nil {
			return winToolError(err.Error()), nil
		}
		return winToolText(`{"success":true}`), nil
	case "set_text":
		if err := engine.setTextElement(elementID, text); err != nil {
			return winToolError(err.Error()), nil
		}
		return winToolText(`{"success":true}`), nil
	case "get_text":
		v, err := engine.getTextElement(elementID)
		if err != nil {
			return winToolError(err.Error()), nil
		}
		bb, _ := json.Marshal(map[string]any{"success": true, "text": v})
		return winToolText(string(bb)), nil
	case "focus":
		if err := engine.clickElement(elementID); err != nil {
			return winToolError(err.Error()), nil
		}
		return winToolText(`{"success":true}`), nil
	default:
		return winToolError("unsupported action"), nil
	}
}
