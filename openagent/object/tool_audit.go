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

package object

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
	"github.com/beego/beego/logs"
	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/tool"
	"github.com/the-open-agent/openagent/util"
)

const toolAuditTextLimit = 4000

type auditedBuiltinTool struct {
	toolType string
	user     string
	inner    tool.BuiltinTool
}

func wrapAuditedBuiltin(toolType string, user string, builtin tool.BuiltinTool) tool.BuiltinTool {
	if !IsHighRiskToolType(toolType) {
		return builtin
	}
	return &auditedBuiltinTool{toolType: toolType, user: user, inner: builtin}
}

func (t *auditedBuiltinTool) GetName() string {
	return t.inner.GetName()
}

func (t *auditedBuiltinTool) GetDescription() string {
	return t.inner.GetDescription()
}

func (t *auditedBuiltinTool) GetInputSchema() interface{} {
	return t.inner.GetInputSchema()
}

func (t *auditedBuiltinTool) Execute(ctx context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	if t.inner.GetName() == "shell" {
		if err := checkShellCommandAllowed(arguments); err != nil {
			addToolAuditRecord(t.toolType, t.inner.GetName(), t.user, arguments, err.Error())
			return snapshotToolError(err.Error()), nil
		}
	}

	result, err := t.inner.Execute(ctx, arguments)

	output := ""
	if err != nil {
		output = err.Error()
	} else if result != nil {
		texts := []string{}
		for _, c := range result.Content {
			if tc, ok := c.(*protocol.TextContent); ok {
				texts = append(texts, tc.Text)
			}
		}
		output = strings.Join(texts, "\n")
	}
	addToolAuditRecord(t.toolType, t.inner.GetName(), t.user, arguments, output)

	return result, err
}

func checkShellCommandAllowed(arguments map[string]interface{}) error {
	allowlist := conf.GetStringArray("shellCommandAllowlist")
	if len(allowlist) == 0 {
		return nil
	}

	action, _ := arguments["action"].(string)
	if action != "" && action != "start" && action != "poll" && action != "stop" {
		return fmt.Errorf("the shell action: %s is not allowed on this server", action)
	}
	if action == "poll" || action == "stop" {
		return nil
	}

	command, _ := arguments["command"].(string)
	command = strings.TrimSpace(command)
	if strings.ContainsAny(command, ";&|<>`$\r\n") {
		return fmt.Errorf("the shell command is not allowed on this server: %s", command)
	}
	fields := strings.Fields(command)
	if len(fields) == 0 {
		return fmt.Errorf("the shell command is empty")
	}

	name := strings.ToLower(strings.TrimSuffix(filepath.Base(fields[0]), ".exe"))
	for _, allowed := range allowlist {
		if strings.ToLower(strings.TrimSpace(allowed)) == name {
			return nil
		}
	}
	return fmt.Errorf("the shell command is not allowed on this server: %s", command)
}

func truncateToolAuditText(text string) string {
	if len(text) > toolAuditTextLimit {
		return text[:toolAuditTextLimit] + "...(truncated)"
	}
	return text
}

func addToolAuditRecord(toolType string, toolName string, user string, arguments map[string]interface{}, output string) {
	argumentsBytes, err := json.Marshal(arguments)
	if err != nil {
		argumentsBytes = []byte("{}")
	}
	object := util.RedactSensitiveJson(string(argumentsBytes))

	organization := conf.GetConfigString("casdoorOrganization")
	if organization == "" {
		organization = "admin"
	}

	logs.Info("Tool executed: type=%s tool=%s user=%s arguments=%s", toolType, toolName, user, truncateToolAuditText(object))

	record := &Record{
		Organization: organization,
		User:         user,
		Method:       "POST",
		RequestUri:   fmt.Sprintf("/tool/%s/%s", toolType, toolName),
		Action:       "execute-tool",
		Object:       truncateToolAuditText(object),
		Response:     truncateToolAuditText(output),
	}
	if _, _, err = AddRecord(record, "en"); err != nil {
		logs.Error("addToolAuditRecord() error: %s", err.Error())
	}
}
