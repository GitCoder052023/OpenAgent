// Copyright 2025 The OpenAgent Authors. All Rights Reserved.
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
	"strings"
	"time"

	"github.com/ThinkInAIXYZ/go-mcp/client"
	"github.com/ThinkInAIXYZ/go-mcp/protocol"
	"github.com/the-open-agent/openagent/i18n"
	"github.com/the-open-agent/openagent/mcp"
	mcppkg "github.com/the-open-agent/openagent/mcp"
	"github.com/the-open-agent/openagent/util"
	"xorm.io/core"
)

type McpTool struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsAllowed   bool   `json:"isAllowed"`
	InputSchema string `json:"inputSchema,omitempty"`
}

type Server struct {
	Owner       string `xorm:"varchar(100) notnull pk" json:"owner"`
	Name        string `xorm:"varchar(100) notnull pk" json:"name"`
	CreatedTime string `xorm:"varchar(100)" json:"createdTime"`
	UpdatedTime string `xorm:"varchar(100)" json:"updatedTime"`
	DisplayName string `xorm:"varchar(100)" json:"displayName"`

	Url   string `xorm:"varchar(500)" json:"url"`
	Token string `xorm:"varchar(500)" json:"token"`

	// Transport selects how the server is reached: "streamablehttp", "sse" or
	// "stdio". Empty means auto-detect: Url set -> streamablehttp, else stdio.
	Transport string   `xorm:"varchar(100)" json:"transport"`
	Command   string   `xorm:"varchar(500)" json:"command"`
	Args      []string `xorm:"mediumtext" json:"args"`
	// Env carries process environment variables for stdio servers and extra HTTP
	// headers for URL-based ones. Values are masked like Token in admin APIs.
	Env map[string]string `xorm:"mediumtext" json:"env"`

	Tools       []*McpTool `xorm:"mediumtext" json:"tools"`
	TestContent string     `xorm:"varchar(500)" json:"testContent"`
	IsDefault   bool       `json:"isDefault"`
}

func (s *Server) GetId() string {
	return fmt.Sprintf("%s/%s", s.Owner, s.Name)
}

// IsConfigured reports whether the server has enough information to be dialed:
// a URL for HTTP transports, or a command for stdio.
func (s *Server) IsConfigured() bool {
	return s.Url != "" || s.Command != ""
}

// IsStdio reports whether connecting to the server launches a local command on this host.
func (s *Server) IsStdio() bool {
	return s != nil && s.Command != "" && s.McpConfig().Type == "stdio"
}

// McpConfig renders the server as a transport-agnostic mcp.ServerConfig.
// Env means process environment for stdio servers and HTTP headers for
// URL-based ones, which is why Token is folded in only for the latter.
func (s *Server) McpConfig() mcp.ServerConfig {
	cfg := mcp.ServerConfig{
		Type:    s.Transport,
		URL:     s.Url,
		Command: s.Command,
		Args:    s.Args,
	}
	if cfg.Type == "" {
		if s.Url != "" {
			cfg.Type = "streamablehttp"
		} else {
			cfg.Type = "stdio"
		}
	}

	env := map[string]string{}
	for k, v := range s.Env {
		env[k] = v
	}
	if cfg.Type != "stdio" && s.Token != "" {
		env["Authorization"] = "Bearer " + s.Token
	}
	if len(env) > 0 {
		cfg.Env = env
	}
	return cfg
}

func GetMaskedServer(server *Server, isMaskEnabled bool) *Server {
	if !isMaskEnabled || server == nil {
		return server
	}
	if server.Token != "" {
		server.Token = "***"
	}
	for key, value := range server.Env {
		if value != "" {
			server.Env[key] = "***"
		}
	}
	return server
}

func GetMaskedServers(servers []*Server, isMaskEnabled bool) []*Server {
	if !isMaskEnabled {
		return servers
	}
	for _, server := range servers {
		server = GetMaskedServer(server, isMaskEnabled)
	}
	return servers
}

// KeepsMaskedSecretWithNewEndpoint reports whether s reuses a masked ("***") token or env value of
// oldServer while changing the server URL, which would disclose that secret to the new URL.
func (s *Server) KeepsMaskedSecretWithNewEndpoint(oldServer *Server) bool {
	if oldServer == nil || s.Url == oldServer.Url {
		return false
	}
	if s.Token == "***" {
		return true
	}
	for _, value := range s.Env {
		if value == "***" {
			return true
		}
	}
	return false
}

func (s *Server) processServerParams(oldServer *Server) {
	if oldServer == nil {
		return
	}
	if s.Token == "***" {
		s.Token = oldServer.Token
	}
	for key, value := range s.Env {
		if value == "***" {
			if oldValue, ok := oldServer.Env[key]; ok {
				s.Env[key] = oldValue
			}
		}
	}
}

func GetServers(owner string) ([]*Server, error) {
	servers := []*Server{}
	err := adapter.engine.Desc("created_time").Find(&servers, &Server{Owner: owner})
	if err != nil {
		return servers, err
	}
	return servers, nil
}

func getServer(owner, name string) (*Server, error) {
	server := Server{Owner: owner, Name: name}
	existed, err := adapter.engine.Get(&server)
	if err != nil {
		return &server, err
	}
	if existed {
		return &server, nil
	}
	return nil, nil
}

func GetServer(id string) (*Server, error) {
	owner, name, err := util.GetOwnerAndNameFromIdWithError(id)
	if err != nil {
		return nil, err
	}
	return getServer(owner, name)
}

func GetServerByOwnerAndName(owner, nameOrId string) (*Server, error) {
	if nameOrId == "" {
		return nil, nil
	}
	var id string
	if _, _, err := util.GetOwnerAndNameFromIdWithError(nameOrId); err == nil {
		id = nameOrId
	} else {
		id = util.GetIdFromOwnerAndName(owner, nameOrId)
	}
	s, err := GetServer(id)
	if err != nil {
		return nil, err
	}
	if s != nil {
		return s, nil
	}
	if owner != "admin" && !strings.Contains(nameOrId, "/") {
		return GetServer(util.GetIdFromOwnerAndName("admin", nameOrId))
	}
	return nil, nil
}

func AddServer(server *Server) (bool, error) {
	affected, err := adapter.engine.Insert(server)
	if err != nil {
		return false, err
	}
	return affected != 0, nil
}

func UpdateServer(id string, server *Server) (bool, error) {
	owner, name, err := util.GetOwnerAndNameFromIdWithError(id)
	if err != nil {
		return false, err
	}

	oldServer, err := getServer(owner, name)
	if err != nil {
		return false, err
	}
	server.processServerParams(oldServer)

	_, err = adapter.engine.ID(core.PK{owner, name}).AllCols().Update(server)
	if err != nil {
		return false, err
	}
	return true, nil
}

func SyncMcpTool(id string, server *Server, isCleared bool) (bool, error) {
	owner, name, err := util.GetOwnerAndNameFromIdWithError(id)
	if err != nil {
		return false, err
	}

	if isCleared {
		server.Tools = nil
		_, err = adapter.engine.ID(core.PK{owner, name}).Cols("tools").Update(server)
		if err != nil {
			return false, err
		}
		return true, nil
	}

	oldServer, err := getServer(owner, name)
	if err != nil {
		return false, err
	}
	if oldServer == nil {
		return false, nil
	}
	server.processServerParams(oldServer)

	if err = syncServerTools(server); err != nil {
		return false, err
	}

	_, err = adapter.engine.ID(core.PK{owner, name}).AllCols().Update(server)
	if err != nil {
		return false, err
	}
	return true, nil
}

func syncServerTools(server *Server) error {
	if !server.IsConfigured() {
		return fmt.Errorf("server has neither a URL nor a command")
	}

	oldTools := server.Tools
	if oldTools == nil {
		oldTools = []*McpTool{}
	}

	tools, err := mcppkg.GetToolsFromConfig(server.McpConfig())
	if err != nil {
		return err
	}

	newTools := make([]*McpTool, 0, len(tools))
	for _, t := range tools {
		isAllowed := true
		for _, old := range oldTools {
			if old.Name == t.Name {
				isAllowed = old.IsAllowed
				break
			}
		}
		schemaJSON, _ := json.Marshal(t.InputSchema)
		newTools = append(newTools, &McpTool{
			Name:        t.Name,
			Description: t.Description,
			IsAllowed:   isAllowed,
			InputSchema: string(schemaJSON),
		})
	}

	server.Tools = newTools
	return nil
}

func DeleteServer(server *Server) (bool, error) {
	affected, err := adapter.engine.ID(core.PK{server.Owner, server.Name}).Delete(&Server{})
	if err != nil {
		return false, err
	}
	return affected != 0, nil
}

// BuildMcpToolSet opens a connection to the server's URL and returns an
// McpToolSet with the allowed tools and the open connection.
// The caller must close all connections in McpToolSet.Connections when done.
func (s *Server) BuildMcpToolSet() (*mcp.ToolSet, error) {
	if !s.IsConfigured() {
		return nil, nil
	}

	cli, err := mcp.NewClientFromConfig(s.McpConfig())
	if err != nil {
		return nil, err
	}

	// Determine which tools are allowed. If Tools is empty (not yet synced),
	// allow everything; otherwise only include tools with IsAllowed = true.
	allowedSet := make(map[string]bool)
	hasFilter := len(s.Tools) > 0
	for _, t := range s.Tools {
		allowedSet[t.Name] = t.IsAllowed
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	list, err := cli.ListTools(ctx)
	if err != nil {
		cli.Close()
		return nil, err
	}

	var filteredTools []*protocol.Tool
	for _, t := range list.Tools {
		if hasFilter {
			if allowed, ok := allowedSet[t.Name]; !ok || !allowed {
				continue
			}
		}
		tCopy := *t
		tCopy.Name = mcp.GetIdFromServerNameAndToolName(s.Name, t.Name)
		filteredTools = append(filteredTools, &tCopy)
	}

	return &mcp.ToolSet{
		Connections: map[string]*client.Client{s.Name: cli},
		Tools:       filteredTools,
	}, nil
}

// GetServerMcpToolSet loads the named MCP server and returns its tool set.
func GetServerMcpToolSet(owner, serverName, lang string) (*mcp.ToolSet, error) {
	if serverName == "" {
		return nil, nil
	}
	server, err := GetServerByOwnerAndName(owner, serverName)
	if err != nil {
		return nil, err
	}
	if server == nil {
		return nil, fmt.Errorf(i18n.Translate(lang, "object:The MCP server: %s is not found"), serverName)
	}
	return server.BuildMcpToolSet()
}

// TestMcpServer connects to the server URL and calls the tool specified in
// TestContent (JSON: {"tool": "toolName", "arguments": {...}}).
func TestMcpServer(s *Server, lang string) (string, error) {
	if !s.IsConfigured() {
		return "", fmt.Errorf(i18n.Translate(lang, "object:Server URL is empty"))
	}
	if s.Token == "***" {
		if s.Owner != "" && s.Name != "" {
			oldServer, err := getServer(s.Owner, s.Name)
			if err != nil {
				return "", err
			}
			s.processServerParams(oldServer)
		}
	}
	var payload struct {
		Tool      string                 `json:"tool"`
		Arguments map[string]interface{} `json:"arguments"`
	}
	if err := json.Unmarshal([]byte(s.TestContent), &payload); err != nil {
		return "", fmt.Errorf(i18n.Translate(lang, "object:invalid MCP test JSON: %v"), err)
	}
	if strings.TrimSpace(payload.Tool) == "" {
		return "", fmt.Errorf(i18n.Translate(lang, "object:MCP test JSON must include non-empty \"tool\""))
	}
	if payload.Arguments == nil {
		payload.Arguments = map[string]interface{}{}
	}
	return mcp.CallToolWithConfig(s.McpConfig(), payload.Tool, payload.Arguments)
}

func GetServerCount(owner, field, value string) (int64, error) {
	session := GetDbSession(owner, -1, -1, field, value, "", "")
	count, err := session.Count(&Server{})
	if err != nil {
		return 0, err
	}
	return count, nil
}

func GetPaginationServers(owner string, offset, limit int, field, value, sortField, sortOrder string) ([]*Server, error) {
	servers := []*Server{}
	session := GetDbSession(owner, offset, limit, field, value, sortField, sortOrder)
	err := session.Find(&servers)
	if err != nil {
		return servers, err
	}
	return servers, nil
}
