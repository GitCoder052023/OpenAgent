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

// The generic adapter: it reads Bundle JSON directly, which is the escape
// hatch for every agent OpenAgent has no native adapter for yet.
//
// Writing a Go adapter needs the source's format documented and its quirks
// understood. A user who already has an agent we cannot parse can instead run
// a small script of their own that emits this format, and get the whole
// wizard -- preview, conflict handling, progress, rollback -- for free. It is
// also the format an adapter author develops against: dump a bundle, import
// it, then move the dumping logic into Go.
//
// The file is plain JSON (JSON5 is accepted too, so hand-written files may
// carry comments) and looks like:
//
//	{
//	  "source": "hermes",
//	  "sourceVersion": "2.1",
//	  "agents":     [{"name": "main", "displayName": "Main", "prompt": "...", "skills": ["pdf"]}],
//	  "providers":  [{"name": "openai", "type": "OpenAI", "subType": "gpt-4o", "clientSecret": "sk-..."}],
//	  "skills":     [{"name": "pdf", "skillMd": "---\nname: pdf\n---\n..."}],
//	  "mcpServers": [{"name": "fs", "command": "npx", "args": ["-y", "server-filesystem"]}],
//	  "chats":      [{"name": "c1", "agent": "main", "messages": [{"author": "user", "text": "hi"}]}]
//	}
//
// Every section is optional, so a bundle carrying nothing but chat history is
// as valid as a full installation.

package migration

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func init() {
	RegisterAdapter(&bundleAdapter{})
}

type bundleAdapter struct{}

func (adapter *bundleAdapter) Id() string {
	return "bundle"
}

func (adapter *bundleAdapter) DisplayName() string {
	return "Agent Bundle (JSON)"
}

func (adapter *bundleAdapter) DefaultPath() string {
	return ""
}

func (adapter *bundleAdapter) FileHint() string {
	return "agent-bundle.json: a JSON file with any of the agents, providers, skills, mcpServers and chats sections, exported from an agent OpenAgent has no adapter for"
}

// bundleFileName is what a directory is searched for when a path is scanned.
const bundleFileName = "agent-bundle.json"

// bundleSections are the collections a file must carry at least one of.
var bundleSections = []string{"agents", "providers", "skills", "mcpServers", "chats"}

// readBundleInput returns the raw JSON of a bundle file, from an upload or a
// path pointing at the file itself or at a directory holding it.
func readBundleInput(in *Input) ([]byte, string, error) {
	if len(in.Data) > 0 {
		return in.Data, "", nil
	}
	if in.Path == "" {
		return nil, "", fmt.Errorf("no file uploaded and no path given")
	}

	path := in.Path
	info, err := os.Stat(path)
	if err != nil {
		return nil, "", fmt.Errorf("cannot read %s: %w", path, err)
	}
	if info.IsDir() {
		path = filepath.Join(path, bundleFileName)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, "", fmt.Errorf("cannot read %s: %w", path, err)
	}
	return data, path, nil
}

// ---------------------------------------------------------------------------
// Detect
// ---------------------------------------------------------------------------

// Detect recognizes a bundle by its "source" field plus at least one section
// holding a JSON array. Requiring both keeps it from claiming a third-party
// config that happens to have an "agents" key -- those are objects, not arrays,
// and they carry no "source".
func (adapter *bundleAdapter) Detect(in *Input) (bool, string, error) {
	data, _, err := readBundleInput(in)
	if err != nil {
		// A path that is not a bundle is a non-match, not a failure: every
		// other adapter still gets its turn.
		return false, "", nil
	}

	raw := map[string]json.RawMessage{}
	if err = parseJson5(data, &raw); err != nil {
		return false, "", nil
	}

	source := ""
	if rawSource, ok := raw["source"]; ok {
		_ = json.Unmarshal(rawSource, &source)
	}
	if source == "" {
		return false, "", nil
	}

	hasSection := false
	for _, section := range bundleSections {
		if value, ok := raw[section]; ok && strings.HasPrefix(strings.TrimSpace(string(value)), "[") {
			hasSection = true
			break
		}
	}
	if !hasSection {
		return false, "", nil
	}

	version := ""
	if rawVersion, ok := raw["sourceVersion"]; ok {
		_ = json.Unmarshal(rawVersion, &version)
	}
	return true, version, nil
}

// ---------------------------------------------------------------------------
// Extract
// ---------------------------------------------------------------------------

// Extract parses the file and normalizes it. The bundle is written by hand or
// by someone else's script, so nothing in it is trusted: entries without a
// usable name are dropped with a warning, and dangling references between
// sections are reported rather than silently producing a broken agent.
func (adapter *bundleAdapter) Extract(in *Input) (*Bundle, error) {
	data, path, err := readBundleInput(in)
	if err != nil {
		return nil, err
	}

	bundle := &Bundle{}
	if err = parseJson5(data, bundle); err != nil {
		return nil, fmt.Errorf("cannot parse the bundle file: %w", err)
	}

	if bundle.Source == "" {
		bundle.Source = adapter.Id()
	}
	if bundle.SourcePath == "" {
		bundle.SourcePath = path
	}
	if bundle.Agents == nil {
		bundle.Agents = []*BundleAgent{}
	}
	if bundle.Providers == nil {
		bundle.Providers = []*BundleProvider{}
	}
	if bundle.Skills == nil {
		bundle.Skills = []*BundleSkill{}
	}
	if bundle.McpServers == nil {
		bundle.McpServers = []*BundleMcpServer{}
	}
	if bundle.Chats == nil {
		bundle.Chats = []*BundleChat{}
	}
	if bundle.Warnings == nil {
		bundle.Warnings = []*BundleWarning{}
	}

	adapter.normalizeSkills(bundle, data)
	adapter.normalizeProviders(bundle)
	adapter.normalizeMcpServers(bundle)
	adapter.normalizeAgents(bundle)
	adapter.normalizeChats(bundle)

	if len(bundle.Agents) == 0 && len(bundle.Providers) == 0 && len(bundle.Skills) == 0 &&
		len(bundle.McpServers) == 0 && len(bundle.Chats) == 0 {
		return nil, fmt.Errorf("the bundle file carries no agents, providers, skills, MCP servers or chats")
	}
	return bundle, nil
}

// bundleEntryName falls back from name to display name, and reports whether
// anything usable was found at all.
func bundleEntryName(name string, displayName string) (string, bool) {
	if strings.TrimSpace(name) != "" {
		return strings.TrimSpace(name), true
	}
	if strings.TrimSpace(displayName) != "" {
		return strings.TrimSpace(displayName), true
	}
	return "", false
}

// normalizeSkills drops nameless skills and restores the "enabled defaults to
// true" reading that plain JSON unmarshalling cannot express: an absent
// "enabled" would otherwise land as false and import every skill inactive.
func (adapter *bundleAdapter) normalizeSkills(bundle *Bundle, data []byte) {
	flags := struct {
		Skills []struct {
			Enabled *bool `json:"enabled"`
		} `json:"skills"`
	}{}
	_ = parseJson5(data, &flags)

	skills := make([]*BundleSkill, 0, len(bundle.Skills))
	for i, skill := range bundle.Skills {
		name, ok := bundleEntryName(skill.Name, skill.DisplayName)
		if !ok {
			bundle.addWarning(CategorySkill, fmt.Sprintf("#%d", i+1), "the skill has no name and was left out")
			continue
		}
		skill.Name = name
		if skill.DisplayName == "" {
			skill.DisplayName = name
		}
		if i < len(flags.Skills) && flags.Skills[i].Enabled != nil {
			skill.Enabled = *flags.Skills[i].Enabled
		} else {
			skill.Enabled = true
		}
		if skill.SkillMd == "" && skill.Content == "" {
			bundle.addWarning(CategorySkill, name, "the skill has neither skillMd nor content, it will be imported empty")
		}
		if skill.References == nil {
			skill.References = []BundleFile{}
		}
		skills = append(skills, skill)
	}
	bundle.Skills = skills
}

func (adapter *bundleAdapter) normalizeProviders(bundle *Bundle) {
	providers := make([]*BundleProvider, 0, len(bundle.Providers))
	for i, provider := range bundle.Providers {
		name, ok := bundleEntryName(provider.Name, provider.DisplayName)
		if !ok {
			bundle.addWarning(CategoryProvider, fmt.Sprintf("#%d", i+1), "the provider has no name and was left out")
			continue
		}
		provider.Name = name
		if provider.DisplayName == "" {
			provider.DisplayName = name
		}
		if provider.Category == "" {
			provider.Category = "Model"
		}
		if provider.Type == "" {
			bundle.addWarning(CategoryProvider, name, "the provider has no type, pick one on its page after the import")
		}
		if provider.ClientSecret == "" {
			bundle.addWarning(CategoryProvider, name, "the provider carries no API key, fill it in after the import")
		}
		providers = append(providers, provider)
	}
	bundle.Providers = providers
}

func (adapter *bundleAdapter) normalizeMcpServers(bundle *Bundle) {
	servers := make([]*BundleMcpServer, 0, len(bundle.McpServers))
	for i, server := range bundle.McpServers {
		name, ok := bundleEntryName(server.Name, server.DisplayName)
		if !ok {
			bundle.addWarning(CategoryServer, fmt.Sprintf("#%d", i+1), "the MCP server has no name and was left out")
			continue
		}
		server.Name = name
		if server.DisplayName == "" {
			server.DisplayName = name
		}
		if server.Url == "" && server.Command == "" {
			bundle.addWarning(CategoryServer, name, "the MCP server has neither a url nor a command and was left out")
			continue
		}
		if server.Transport == "" {
			if server.Url != "" {
				server.Transport = "streamablehttp"
			} else {
				server.Transport = "stdio"
			}
		}
		if server.Args == nil {
			server.Args = []string{}
		}
		servers = append(servers, server)
	}
	bundle.McpServers = servers
}

// normalizeAgents drops nameless agents and reports references that point at
// nothing, since a skill or provider named in the bundle but not defined by it
// would leave the imported agent misconfigured.
func (adapter *bundleAdapter) normalizeAgents(bundle *Bundle) {
	skillNames := map[string]bool{}
	for _, skill := range bundle.Skills {
		skillNames[skill.Name] = true
	}
	providerNames := map[string]bool{}
	for _, provider := range bundle.Providers {
		providerNames[provider.Name] = true
	}
	serverNames := map[string]bool{}
	for _, server := range bundle.McpServers {
		serverNames[server.Name] = true
	}

	agents := make([]*BundleAgent, 0, len(bundle.Agents))
	for i, agent := range bundle.Agents {
		name, ok := bundleEntryName(agent.Name, agent.DisplayName)
		if !ok {
			bundle.addWarning(CategoryAgent, fmt.Sprintf("#%d", i+1), "the agent has no name and was left out")
			continue
		}
		agent.Name = name
		if agent.DisplayName == "" {
			agent.DisplayName = name
		}
		if agent.Skills == nil {
			agent.Skills = []string{}
		}

		for _, skillName := range agent.Skills {
			if !skillNames[skillName] {
				bundle.addWarning(CategoryAgent, name, fmt.Sprintf("references the skill %q, which the bundle does not define", skillName))
			}
		}
		if agent.ModelProvider != "" && !providerNames[agent.ModelProvider] {
			bundle.addWarning(CategoryAgent, name, fmt.Sprintf("references the model provider %q, which the bundle does not define", agent.ModelProvider))
		}
		if agent.McpServer != "" && !serverNames[agent.McpServer] {
			bundle.addWarning(CategoryAgent, name, fmt.Sprintf("references the MCP server %q, which the bundle does not define", agent.McpServer))
		}
		agents = append(agents, agent)
	}
	bundle.Agents = agents
}

// normalizeChats gives every chat a name, folds the many spellings of "the
// assistant said this" onto OpenAgent's "AI" author, and drops empty ones.
func (adapter *bundleAdapter) normalizeChats(bundle *Bundle) {
	agentNames := map[string]bool{}
	for _, agent := range bundle.Agents {
		agentNames[agent.Name] = true
	}

	chats := make([]*BundleChat, 0, len(bundle.Chats))
	for i, chat := range bundle.Chats {
		name, ok := bundleEntryName(chat.Name, chat.DisplayName)
		if !ok {
			name = fmt.Sprintf("chat-%d", i+1)
		}
		chat.Name = name
		if chat.DisplayName == "" {
			chat.DisplayName = name
		}

		if len(chat.Messages) == 0 {
			bundle.addWarning(CategoryChat, name, "the chat has no messages and was left out")
			continue
		}
		if chat.Agent != "" && !agentNames[chat.Agent] {
			bundle.addWarning(CategoryChat, name, fmt.Sprintf("belongs to the agent %q, which the bundle does not define, so it will be imported unattached", chat.Agent))
			chat.Agent = ""
		}

		messages := make([]*BundleMessage, 0, len(chat.Messages))
		for _, message := range chat.Messages {
			if message == nil {
				continue
			}
			message.Author = normalizeBundleAuthor(message.Author)
			messages = append(messages, message)
		}
		chat.Messages = messages
		chats = append(chats, chat)
	}
	bundle.Chats = chats
}

// normalizeBundleAuthor maps whatever the source called the assistant onto
// "AI", which is the only author string OpenAgent treats as the model.
func normalizeBundleAuthor(author string) string {
	switch strings.ToLower(strings.TrimSpace(author)) {
	case "ai", "assistant", "bot", "agent", "model":
		return "AI"
	case "":
		return "user"
	}
	return author
}
