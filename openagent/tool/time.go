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
	stdtime "time"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
)

// TimeTool is the Tool Type "time".
type TimeTool struct{}

func (p *TimeTool) BuiltinTools() []BuiltinTool {
	return []BuiltinTool{&timeBuiltin{}}
}

type timeBuiltin struct{}

func (t *timeBuiltin) GetName() string {
	return "time"
}

func (t *timeBuiltin) GetDescription() string {
	return `Date and time utilities. Set "operation" to choose the action:
- current: current date/time in an optional timezone (use "timezone", default UTC).
- localtime_to_timestamp: convert local time string to Unix seconds ("localtime", optional "timezone", default Asia/Shanghai).
- timestamp_to_localtime: convert Unix timestamp to local time string ("timestamp", optional "timezone").
- timezone_conversion: convert a datetime between zones ("datetime", "from_timezone", "to_timezone").
- weekday: weekday for a calendar date ("year", "month", "day").`
}

func (t *timeBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"operation": map[string]interface{}{
				"type": "string",
				"enum": []string{
					"current",
					"localtime_to_timestamp",
					"timestamp_to_localtime",
					"timezone_conversion",
					"weekday",
				},
				"description": "Which time operation to run.",
			},
			"timezone": map[string]interface{}{
				"type":        "string",
				"description": "Timezone (e.g. UTC, Asia/Shanghai). Used by current, localtime_to_timestamp, timestamp_to_localtime.",
			},
			"localtime": map[string]interface{}{
				"type":        "string",
				"description": "Local time string for localtime_to_timestamp (e.g. '2024-01-01 00:00:00').",
			},
			"timestamp": map[string]interface{}{
				"type":        "number",
				"description": "Unix timestamp for timestamp_to_localtime.",
			},
			"datetime": map[string]interface{}{
				"type":        "string",
				"description": "Datetime string for timezone_conversion (e.g. '2024-01-01 12:00:00').",
			},
			"from_timezone": map[string]interface{}{
				"type":        "string",
				"description": "Source timezone for timezone_conversion.",
			},
			"to_timezone": map[string]interface{}{
				"type":        "string",
				"description": "Target timezone for timezone_conversion.",
			},
			"year": map[string]interface{}{
				"type":        "number",
				"description": "Year for weekday (e.g. 2024).",
			},
			"month": map[string]interface{}{
				"type":        "number",
				"description": "Month 1-12 for weekday.",
			},
			"day": map[string]interface{}{
				"type":        "number",
				"description": "Day of month for weekday.",
			},
		},
		"required": []string{"operation"},
	}
}

func (t *timeBuiltin) Execute(ctx context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	op, _ := arguments["operation"].(string)
	switch op {
	case "current":
		return timeExecCurrent(arguments)
	case "localtime_to_timestamp":
		return timeExecLocaltimeToTimestamp(arguments)
	case "timestamp_to_localtime":
		return timeExecTimestampToLocaltime(arguments)
	case "timezone_conversion":
		return timeExecTimezoneConversion(arguments)
	case "weekday":
		return timeExecWeekday(arguments)
	default:
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: `Invalid or missing "operation". Use: current, localtime_to_timestamp, timestamp_to_localtime, timezone_conversion, weekday.`},
			},
		}, nil
	}
}

func timeExecCurrent(arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	tzName := "UTC"
	if tz, ok := arguments["timezone"].(string); ok && tz != "" {
		tzName = tz
	}

	var now stdtime.Time
	if tzName == "UTC" {
		now = stdtime.Now().UTC()
	} else {
		location, err := stdtime.LoadLocation(tzName)
		if err != nil {
			return &protocol.CallToolResult{
				IsError: true,
				Content: []protocol.Content{
					&protocol.TextContent{Type: "text", Text: fmt.Sprintf("Invalid timezone: %s", tzName)},
				},
			}, nil
		}
		now = stdtime.Now().In(location)
	}

	weekday := now.Weekday().String()
	timeStr := fmt.Sprintf("%s %s %s", now.Format("2006-01-02 15:04:05"), weekday, now.Format("MST"))

	return &protocol.CallToolResult{
		IsError: false,
		Content: []protocol.Content{
			&protocol.TextContent{Type: "text", Text: timeStr},
		},
	}, nil
}

func timeExecLocaltimeToTimestamp(arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	localtimeStr, ok := arguments["localtime"].(string)
	if !ok || localtimeStr == "" {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: "Missing required parameter: localtime"},
			},
		}, nil
	}

	tzName := "Asia/Shanghai"
	if tz, ok := arguments["timezone"].(string); ok && tz != "" {
		tzName = tz
	}

	location, err := stdtime.LoadLocation(tzName)
	if err != nil {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: fmt.Sprintf("Invalid timezone: %s", tzName)},
			},
		}, nil
	}

	layouts := []string{
		"2006-1-2 15:4:5",
		"2006-01-02 15:04:05",
		"2006-1-2 15:04:05",
		"2006-01-02 15:4:5",
		"2006-1-2",
		"2006-01-02",
	}

	var parsedTime stdtime.Time
	var parseErr error
	for _, layout := range layouts {
		parsedTime, parseErr = stdtime.ParseInLocation(layout, localtimeStr, location)
		if parseErr == nil {
			break
		}
	}

	if parseErr != nil {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: fmt.Sprintf("Invalid time format: %s. Please use format like '2024-1-1 0:0:0'", localtimeStr)},
			},
		}, nil
	}

	return &protocol.CallToolResult{
		IsError: false,
		Content: []protocol.Content{
			&protocol.TextContent{Type: "text", Text: fmt.Sprintf("%d", parsedTime.Unix())},
		},
	}, nil
}

func timeExecTimestampToLocaltime(arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	var ts int64
	switch v := arguments["timestamp"].(type) {
	case float64:
		ts = int64(v)
	case int64:
		ts = v
	case int:
		ts = int64(v)
	default:
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: "Missing or invalid parameter: timestamp"},
			},
		}, nil
	}

	tzName := "Asia/Shanghai"
	if tz, ok := arguments["timezone"].(string); ok && tz != "" {
		tzName = tz
	}

	location, err := stdtime.LoadLocation(tzName)
	if err != nil {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: fmt.Sprintf("Invalid timezone: %s", tzName)},
			},
		}, nil
	}

	localTime := stdtime.Unix(ts, 0).In(location)
	return &protocol.CallToolResult{
		IsError: false,
		Content: []protocol.Content{
			&protocol.TextContent{Type: "text", Text: localTime.Format("2006-01-02 15:04:05")},
		},
	}, nil
}

func timeExecTimezoneConversion(arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	datetimeStr, ok := arguments["datetime"].(string)
	if !ok || datetimeStr == "" {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: "Missing required parameter: datetime"},
			},
		}, nil
	}

	fromTz, ok := arguments["from_timezone"].(string)
	if !ok || fromTz == "" {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: "Missing required parameter: from_timezone"},
			},
		}, nil
	}

	toTz, ok := arguments["to_timezone"].(string)
	if !ok || toTz == "" {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: "Missing required parameter: to_timezone"},
			},
		}, nil
	}

	fromLocation, err := stdtime.LoadLocation(fromTz)
	if err != nil {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: fmt.Sprintf("Invalid source timezone: %s", fromTz)},
			},
		}, nil
	}

	toLocation, err := stdtime.LoadLocation(toTz)
	if err != nil {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: fmt.Sprintf("Invalid target timezone: %s", toTz)},
			},
		}, nil
	}

	layouts := []string{
		"2006-01-02 15:04:05",
		"2006-1-2 15:4:5",
		"2006-01-02 15:04",
		"2006-01-02",
	}

	var parsedTime stdtime.Time
	var parseErr error
	for _, layout := range layouts {
		parsedTime, parseErr = stdtime.ParseInLocation(layout, datetimeStr, fromLocation)
		if parseErr == nil {
			break
		}
	}

	if parseErr != nil {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: fmt.Sprintf("Invalid datetime format: %s. Please use format like '2024-01-01 12:00:00'", datetimeStr)},
			},
		}, nil
	}

	converted := parsedTime.In(toLocation)
	return &protocol.CallToolResult{
		IsError: false,
		Content: []protocol.Content{
			&protocol.TextContent{Type: "text", Text: converted.Format("2006-01-02 15:04:05")},
		},
	}, nil
}

func timeExecWeekday(arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	var year int
	switch v := arguments["year"].(type) {
	case float64:
		year = int(v)
	case int:
		year = v
	default:
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: "Missing or invalid parameter: year"},
			},
		}, nil
	}

	var month int
	switch v := arguments["month"].(type) {
	case float64:
		month = int(v)
	case int:
		month = v
	default:
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: "Missing or invalid parameter: month"},
			},
		}, nil
	}

	var day int
	switch v := arguments["day"].(type) {
	case float64:
		day = int(v)
	case int:
		day = v
	default:
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: "Missing or invalid parameter: day"},
			},
		}, nil
	}

	if month < 1 || month > 12 {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: fmt.Sprintf("Invalid month: %d. Month must be between 1 and 12", month)},
			},
		}, nil
	}

	if day < 1 || day > 31 {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: fmt.Sprintf("Invalid day: %d. Day must be between 1 and 31", day)},
			},
		}, nil
	}

	date := stdtime.Date(year, stdtime.Month(month), day, 0, 0, 0, 0, stdtime.UTC)
	weekday := date.Weekday().String()
	monthName := date.Month().String()
	readableDate := fmt.Sprintf("%s %d, %d", monthName, date.Day(), date.Year())
	result := fmt.Sprintf("%s is %s.", readableDate, weekday)

	return &protocol.CallToolResult{
		IsError: false,
		Content: []protocol.Content{
			&protocol.TextContent{Type: "text", Text: result},
		},
	}, nil
}
