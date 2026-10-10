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
	"math"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
	"github.com/shirou/gopsutil/v3/cpu"
)

// ---------------------------------------------------------------------------
// win_wait
// ---------------------------------------------------------------------------

type winWaitBuiltin struct{}

func (b *winWaitBuiltin) GetName() string { return "win_wait" }

func (b *winWaitBuiltin) GetDescription() string {
	return `Wait for a condition. Supports waiting by seconds or waiting for a window title to appear.`
}

func (b *winWaitBuiltin) GetInputSchema() interface{} {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"properties": map[string]any{
			"seconds": map[string]any{
				"type":        "number",
				"description": "Simple sleep duration in seconds.",
				"minimum":     0,
				"maximum":     120,
			},
			"window_title_contains": map[string]any{
				"type":        "string",
				"description": "If set, poll until a matching top-level window appears.",
			},
			"timeout_seconds": map[string]any{
				"type":    "number",
				"default": 10,
				"minimum": 1,
				"maximum": 120,
			},
		},
	}
}

func (b *winWaitBuiltin) Execute(ctx context.Context, arguments map[string]any) (*protocol.CallToolResult, error) {
	seconds, hasSeconds := parseNumber(arguments["seconds"])
	windowTitleContains, _ := arguments["window_title_contains"].(string)
	timeoutSeconds := 10.0
	if v, ok := parseNumber(arguments["timeout_seconds"]); ok && v > 0 {
		timeoutSeconds = math.Min(v, 120)
	}

	if strings.TrimSpace(windowTitleContains) != "" {
		deadline := time.Now().Add(time.Duration(timeoutSeconds * float64(time.Second)))
		for time.Now().Before(deadline) {
			select {
			case <-ctx.Done():
				return winToolError("wait cancelled"), nil
			default:
			}
			if hwnd, err := findTopLevelWindowByTitleContains(windowTitleContains); err == nil && hwnd != 0 {
				bb, _ := json.Marshal(map[string]any{"success": true, "hwnd": hwnd})
				return winToolText(string(bb)), nil
			}
			time.Sleep(200 * time.Millisecond)
		}
		return winToolError("wait timeout: window not found"), nil
	}

	if !hasSeconds {
		seconds = 1
	}
	seconds = math.Max(0, math.Min(120, seconds))
	time.Sleep(time.Duration(seconds * float64(time.Second)))
	return winToolText(`{"success":true}`), nil
}

// ---------------------------------------------------------------------------
// win_assert
// ---------------------------------------------------------------------------

type winAssertBuiltin struct{}

func (b *winAssertBuiltin) GetName() string { return "win_assert" }

func (b *winAssertBuiltin) GetDescription() string {
	return `Assert post-conditions in GUI workflows.

Supported checks:
- window_exists (requires window_title_contains)
- file_exists (requires path)
- text_contains (requires text + expected_substring)`
}

func (b *winAssertBuiltin) GetInputSchema() interface{} {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"properties": map[string]any{
			"check": map[string]any{
				"type": "string",
				"enum": []string{"window_exists", "file_exists", "text_contains"},
			},
			"window_title_contains": map[string]any{"type": "string"},
			"path":                  map[string]any{"type": "string"},
			"text":                  map[string]any{"type": "string"},
			"expected_substring":    map[string]any{"type": "string"},
		},
		"required": []string{"check"},
	}
}

func (b *winAssertBuiltin) Execute(ctx context.Context, arguments map[string]any) (*protocol.CallToolResult, error) {
	_ = ctx
	check, _ := arguments["check"].(string)
	check = strings.ToLower(strings.TrimSpace(check))
	switch check {
	case "window_exists":
		title, _ := arguments["window_title_contains"].(string)
		if strings.TrimSpace(title) == "" {
			return winToolError("window_title_contains is required"), nil
		}
		if hwnd, err := findTopLevelWindowByTitleContains(title); err == nil && hwnd != 0 {
			return winToolText(`{"success":true}`), nil
		}
		return winToolError("assertion failed: window not found"), nil
	case "file_exists":
		p, _ := arguments["path"].(string)
		if strings.TrimSpace(p) == "" {
			return winToolError("path is required"), nil
		}
		st, err := os.Stat(p)
		if err == nil && !st.IsDir() {
			return winToolText(`{"success":true}`), nil
		}
		return winToolError("assertion failed: file not found"), nil
	case "text_contains":
		text, _ := arguments["text"].(string)
		exp, _ := arguments["expected_substring"].(string)
		if !strings.Contains(strings.ToLower(text), strings.ToLower(exp)) {
			return winToolError("assertion failed: expected_substring not found"), nil
		}
		return winToolText(`{"success":true}`), nil
	default:
		return winToolError("unsupported check"), nil
	}
}

// ---------------------------------------------------------------------------
// win_read_system_metric
// ---------------------------------------------------------------------------

type winReadSystemMetricBuiltin struct{}

func (b *winReadSystemMetricBuiltin) GetName() string { return "win_read_system_metric" }

func (b *winReadSystemMetricBuiltin) GetDescription() string {
	return `Read system metrics such as CPU utilization without relying on UI text.

For cpu_percent, this uses gopsutil sampling (P0).`
}

func (b *winReadSystemMetricBuiltin) GetInputSchema() interface{} {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"properties": map[string]any{
			"metric": map[string]any{
				"type":        "string",
				"enum":        []string{"cpu_percent"},
				"description": "Metric to read.",
			},
			"duration_seconds": map[string]any{
				"type":        "number",
				"default":     10,
				"minimum":     1,
				"maximum":     120,
				"description": "Sampling duration in seconds.",
			},
			"interval_seconds": map[string]any{
				"type":        "number",
				"default":     1,
				"minimum":     0.2,
				"maximum":     10,
				"description": "Sampling interval in seconds.",
			},
			"aggregation": map[string]any{
				"type":        "string",
				"enum":        []string{"avg", "series"},
				"default":     "avg",
				"description": "Aggregation method.",
			},
		},
		"required": []string{"metric"},
	}
}

func (b *winReadSystemMetricBuiltin) Execute(ctx context.Context, arguments map[string]any) (*protocol.CallToolResult, error) {
	metric, _ := arguments["metric"].(string)
	metric = strings.TrimSpace(metric)
	if metric != "cpu_percent" {
		return winToolError(`metric must be "cpu_percent"`), nil
	}
	dur := 10.0
	if v, ok := parseNumber(arguments["duration_seconds"]); ok && v > 0 {
		dur = math.Min(120, v)
	}
	interval := 1.0
	if v, ok := parseNumber(arguments["interval_seconds"]); ok && v > 0 {
		interval = math.Min(10, v)
	}
	agg, _ := arguments["aggregation"].(string)
	agg = strings.ToLower(strings.TrimSpace(agg))
	if agg == "" {
		agg = "avg"
	}

	// Warm-up: first call sometimes returns 0.
	_, _ = cpu.Percent(0, false)

	var samples []float64
	start := time.Now()
	for time.Since(start) < time.Duration(dur*float64(time.Second)) {
		select {
		case <-ctx.Done():
			return winToolError("metric sampling cancelled"), nil
		default:
		}
		p, err := cpu.Percent(0, false)
		if err == nil && len(p) > 0 {
			samples = append(samples, p[0])
		}
		time.Sleep(time.Duration(interval * float64(time.Second)))
	}

	if len(samples) == 0 {
		return winToolError("no samples collected"), nil
	}

	sum := 0.0
	for _, s := range samples {
		sum += s
	}
	avg := sum / float64(len(samples))

	if agg == "series" {
		b, _ := json.Marshal(map[string]any{
			"success":      true,
			"metric":       "cpu_percent",
			"aggregation":  "series",
			"samples":      samples,
			"sample_count": len(samples),
			"duration":     dur,
			"interval":     interval,
		})
		return winToolText(string(b)), nil
	}

	bb, _ := json.Marshal(map[string]any{
		"success":      true,
		"metric":       "cpu_percent",
		"aggregation":  "avg",
		"value":        avg,
		"unit":         "%",
		"sample_count": len(samples),
		"duration":     dur,
		"interval":     interval,
	})
	return winToolText(string(bb)), nil
}

// ---------------------------------------------------------------------------
// win_safety_emergency_stop
// ---------------------------------------------------------------------------

type winEmergencyStopBuiltin struct{}

func (b *winEmergencyStopBuiltin) GetName() string { return "win_safety_emergency_stop" }

func (b *winEmergencyStopBuiltin) GetDescription() string {
	return `Emergency stop: release modifier keys and send Escape to cancel modal dialogs.`
}

func (b *winEmergencyStopBuiltin) GetInputSchema() interface{} {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"properties":           map[string]any{},
	}
}

func (b *winEmergencyStopBuiltin) Execute(ctx context.Context, arguments map[string]any) (*protocol.CallToolResult, error) {
	_ = ctx
	_ = arguments
	once := sync.Once{}
	once.Do(func() {
		_ = sendKeyUp("ctrl")
		_ = sendKeyUp("alt")
		_ = sendKeyUp("shift")
		_ = sendKeyTap("esc")
	})
	return winToolText(`{"success":true}`), nil
}
