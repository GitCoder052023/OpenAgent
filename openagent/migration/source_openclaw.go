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

// OpenClaw migration adapter.
//
// An OpenClaw installation lives in ~/.openclaw:
//
//	openclaw.json            JSON5 config: agents, skills, mcp, channels, env
//	skills/<name>/SKILL.md   skill folders, same format OpenAgent already reads
//	agents/<id>/sessions/    archived transcripts (JSONL)
//	agents/<id>/agent/*.sqlite   live session state
//
// The adapter accepts either a server-side path to that directory, a .zip of
// it, or a bare openclaw.json upload (config only, no skills or transcripts).

package migration

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/the-open-agent/openagent/skillmd"
)

func init() {
	RegisterAdapter(&openClawAdapter{})
}

type openClawAdapter struct{}

func (adapter *openClawAdapter) Id() string {
	return "openclaw"
}

func (adapter *openClawAdapter) DisplayName() string {
	return "OpenClaw"
}

func (adapter *openClawAdapter) DefaultPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".openclaw")
}

func (adapter *openClawAdapter) FileHint() string {
	return "openclaw.json, or a .zip of the whole ~/.openclaw directory"
}

// ---------------------------------------------------------------------------
// Config schema
// ---------------------------------------------------------------------------

// openClawConfig models the parts of openclaw.json that map onto OpenAgent.
// Unknown sections are kept as raw maps only so the adapter can warn about the
// ones it cannot migrate rather than dropping them silently.
type openClawConfig struct {
	Version string `json:"version"`

	Agents struct {
		Defaults *openClawAgent            `json:"defaults"`
		Entries  map[string]*openClawAgent `json:"entries"`
	} `json:"agents"`

	Skills struct {
		Entries map[string]struct {
			Enabled *bool `json:"enabled"`
		} `json:"entries"`
		Load struct {
			ExtraDirs []string `json:"extraDirs"`
		} `json:"load"`
	} `json:"skills"`

	Mcp struct {
		Servers    map[string]*openClawMcpServer `json:"servers"`
		McpServers map[string]*openClawMcpServer `json:"mcpServers"`
	} `json:"mcp"`
	// Some configs put the servers at the top level, the way most MCP hosts do.
	McpServers map[string]*openClawMcpServer `json:"mcpServers"`

	Env map[string]string `json:"env"`

	// Model credentials appear under either key depending on config vintage.
	Models    map[string]*openClawModelProvider `json:"models"`
	Providers map[string]*openClawModelProvider `json:"providers"`

	Channels map[string]json.RawMessage `json:"channels"`
	Cron     json.RawMessage            `json:"cron"`
	Hooks    json.RawMessage            `json:"hooks"`
	Plugins  json.RawMessage            `json:"plugins"`
	Gateway  json.RawMessage            `json:"gateway"`
	Tools    json.RawMessage            `json:"tools"`
	Session  json.RawMessage            `json:"session"`
}

type openClawAgent struct {
	Workspace string             `json:"workspace"`
	Model     openClawModelRef   `json:"model"`
	Skills    openClawStringList `json:"skills"`

	Identity struct {
		Name   string `json:"name"`
		Emoji  string `json:"emoji"`
		Theme  string `json:"theme"`
		Avatar string `json:"avatar"`
	} `json:"identity"`

	// OpenClaw has used several names for the system prompt across versions.
	Prompt       string `json:"prompt"`
	SystemPrompt string `json:"systemPrompt"`
	Instructions string `json:"instructions"`

	MaxConcurrent int `json:"maxConcurrent"`
	ContextLimit  int `json:"contextLimit"`
}

type openClawMcpServer struct {
	Command   string            `json:"command"`
	Args      []string          `json:"args"`
	Env       map[string]string `json:"env"`
	Url       string            `json:"url"`
	Type      string            `json:"type"`
	Transport string            `json:"transport"`
	Headers   map[string]string `json:"headers"`
	Enabled   *bool             `json:"enabled"`
}

type openClawModelProvider struct {
	ApiKey  string `json:"apiKey"`
	BaseUrl string `json:"baseUrl"`
	BaseURL string `json:"baseURL"`
	Type    string `json:"type"`
	Model   string `json:"model"`
}

// openClawModelRef accepts both "model": "anthropic/claude-x" and
// "model": { "primary": "...", "fallbacks": [...] }.
type openClawModelRef struct {
	Primary   string   `json:"primary"`
	Fallbacks []string `json:"fallbacks"`
}

func (ref *openClawModelRef) UnmarshalJSON(data []byte) error {
	var asString string
	if err := json.Unmarshal(data, &asString); err == nil {
		ref.Primary = asString
		return nil
	}

	type plain openClawModelRef
	var asObject plain
	if err := json.Unmarshal(data, &asObject); err != nil {
		return nil
	}
	*ref = openClawModelRef(asObject)
	return nil
}

// openClawStringList accepts both ["a","b"] and {"a": true, "b": false}.
type openClawStringList []string

func (list *openClawStringList) UnmarshalJSON(data []byte) error {
	var asSlice []string
	if err := json.Unmarshal(data, &asSlice); err == nil {
		*list = asSlice
		return nil
	}

	var asMap map[string]bool
	if err := json.Unmarshal(data, &asMap); err == nil {
		names := []string{}
		for name, enabled := range asMap {
			if enabled {
				names = append(names, name)
			}
		}
		sort.Strings(names)
		*list = names
		return nil
	}
	return nil
}

// ---------------------------------------------------------------------------
// Input resolution
// ---------------------------------------------------------------------------

// openClawInput is a resolved installation: a config blob plus, when available,
// the directory holding skills and transcripts.
type openClawInput struct {
	root       string
	configData []byte
	cleanup    func()
}

const openClawConfigFileName = "openclaw.json"

// resolveOpenClawInput turns a Input into a config blob and, where
// possible, a root directory. The returned cleanup is always non-nil.
func resolveOpenClawInput(in *Input) (*openClawInput, error) {
	resolved := &openClawInput{cleanup: func() {}}

	if in.Path != "" {
		info, err := os.Stat(in.Path)
		if err != nil {
			return nil, fmt.Errorf("cannot read %s: %w", in.Path, err)
		}

		if !info.IsDir() {
			data, readErr := os.ReadFile(in.Path)
			if readErr != nil {
				return nil, readErr
			}
			resolved.configData = data
			resolved.root = filepath.Dir(in.Path)
			return resolved, nil
		}

		resolved.root = in.Path
		data, err := os.ReadFile(filepath.Join(in.Path, openClawConfigFileName))
		if err != nil {
			return nil, fmt.Errorf("cannot read %s in %s: %w", openClawConfigFileName, in.Path, err)
		}
		resolved.configData = data
		return resolved, nil
	}

	if len(in.Data) == 0 {
		return nil, fmt.Errorf("no file uploaded and no path given")
	}

	if isZipArchive(in.Data) {
		dir, err := extractZipToTempDir(in.Data)
		if err != nil {
			return nil, err
		}
		resolved.cleanup = func() { os.RemoveAll(dir) }

		configPath, err := findFileInTree(dir, openClawConfigFileName)
		if err != nil {
			resolved.cleanup()
			return nil, err
		}
		data, err := os.ReadFile(configPath)
		if err != nil {
			resolved.cleanup()
			return nil, err
		}
		resolved.root = filepath.Dir(configPath)
		resolved.configData = data
		return resolved, nil
	}

	resolved.configData = in.Data
	return resolved, nil
}

func isZipArchive(data []byte) bool {
	return len(data) > 4 && data[0] == 'P' && data[1] == 'K' &&
		(data[2] == 3 || data[2] == 5 || data[2] == 7)
}

// extractZipToTempDir unpacks an uploaded archive, rejecting entries that would
// escape the destination directory (zip slip).
func extractZipToTempDir(data []byte) (string, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("cannot read the uploaded archive: %w", err)
	}

	dir, err := os.MkdirTemp("", "openagent-migration-")
	if err != nil {
		return "", err
	}

	for _, entry := range reader.File {
		target := filepath.Join(dir, filepath.FromSlash(entry.Name))
		if !strings.HasPrefix(target, filepath.Clean(dir)+string(os.PathSeparator)) {
			os.RemoveAll(dir)
			return "", fmt.Errorf("the archive contains an illegal path: %s", entry.Name)
		}

		if entry.FileInfo().IsDir() {
			if err = os.MkdirAll(target, 0o750); err != nil {
				os.RemoveAll(dir)
				return "", err
			}
			continue
		}

		if err = os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
			os.RemoveAll(dir)
			return "", err
		}

		if err = writeZipEntry(entry, target); err != nil {
			os.RemoveAll(dir)
			return "", err
		}
	}

	return dir, nil
}

func writeZipEntry(entry *zip.File, target string) error {
	source, err := entry.Open()
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	defer destination.Close()

	// Capped so a zip bomb cannot fill the disk.
	_, err = io.Copy(destination, io.LimitReader(source, 64<<20))
	return err
}

// findFileInTree returns the shallowest path with the given base name.
func findFileInTree(root string, name string) (string, error) {
	found := ""
	foundDepth := -1

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || info.Name() != name {
			return nil
		}
		depth := strings.Count(path, string(os.PathSeparator))
		if foundDepth < 0 || depth < foundDepth {
			found, foundDepth = path, depth
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if found == "" {
		return "", fmt.Errorf("the archive does not contain a %s file", name)
	}
	return found, nil
}

// ---------------------------------------------------------------------------
// Detect
// ---------------------------------------------------------------------------

func (adapter *openClawAdapter) Detect(in *Input) (bool, string, error) {
	if in.Path != "" {
		if _, err := os.Stat(filepath.Join(in.Path, openClawConfigFileName)); err == nil {
			return adapter.detectFromConfigFile(filepath.Join(in.Path, openClawConfigFileName))
		}
		if filepath.Base(in.Path) == openClawConfigFileName {
			return adapter.detectFromConfigFile(in.Path)
		}
		return false, "", nil
	}

	if len(in.Data) == 0 {
		return false, "", nil
	}
	if isZipArchive(in.Data) {
		// Cheap check: the archive must contain an openclaw.json somewhere.
		reader, err := zip.NewReader(bytes.NewReader(in.Data), int64(len(in.Data)))
		if err != nil {
			return false, "", nil
		}
		for _, entry := range reader.File {
			if filepath.Base(entry.Name) == openClawConfigFileName {
				return true, "", nil
			}
		}
		return false, "", nil
	}

	return adapter.detectFromConfigData(in.Data)
}

func (adapter *openClawAdapter) detectFromConfigFile(path string) (bool, string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return false, "", err
	}
	return adapter.detectFromConfigData(data)
}

// detectFromConfigData recognizes an OpenClaw config by its section names. A
// file that is simply not OpenClaw is a non-match, never an error.
func (adapter *openClawAdapter) detectFromConfigData(data []byte) (bool, string, error) {
	raw := map[string]json.RawMessage{}
	if err := parseJson5(data, &raw); err != nil {
		return false, "", nil
	}

	markers := 0
	for _, key := range []string{"agents", "gateway", "channels", "skills", "mcp"} {
		if _, ok := raw[key]; ok {
			markers++
		}
	}
	if markers < 2 {
		return false, "", nil
	}

	version := ""
	if rawVersion, ok := raw["version"]; ok {
		_ = json.Unmarshal(rawVersion, &version)
	}
	return true, version, nil
}

// ---------------------------------------------------------------------------
// Extract
// ---------------------------------------------------------------------------

func (adapter *openClawAdapter) Extract(in *Input) (*Bundle, error) {
	resolved, err := resolveOpenClawInput(in)
	if err != nil {
		return nil, err
	}
	defer resolved.cleanup()

	config := &openClawConfig{}
	if err = parseJson5(resolved.configData, config); err != nil {
		return nil, fmt.Errorf("cannot parse %s: %w", openClawConfigFileName, err)
	}

	bundle := &Bundle{
		Source:        adapter.Id(),
		SourceVersion: config.Version,
		SourcePath:    resolved.root,
		Agents:        []*BundleAgent{},
		Providers:     []*BundleProvider{},
		Skills:        []*BundleSkill{},
		McpServers:    []*BundleMcpServer{},
		Chats:         []*BundleChat{},
		Warnings:      []*BundleWarning{},
	}

	providersByModelKey := adapter.extractProviders(config, bundle)
	adapter.extractMcpServers(config, bundle)
	adapter.extractSkills(config, resolved.root, bundle)
	adapter.extractAgents(config, providersByModelKey, bundle)
	adapter.extractChats(config, resolved.root, bundle)
	adapter.warnAboutUnmappableSections(config, bundle)

	return bundle, nil
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

// openClawProviderMapping ties an OpenClaw model-id prefix and the environment
// variable that holds its key to an OpenAgent provider Type.
type openClawProviderMapping struct {
	// key is the canonical vendor key used to dedupe providers.
	key string
	// providerType is the OpenAgent Provider.Type.
	providerType string
	displayName  string
	// envNames are the environment variables OpenClaw stores the API key in.
	envNames []string
	// modelPrefixes match the vendor part of an OpenClaw model id.
	modelPrefixes []string
}

// openClawProviderMappings is ordered: the first entry whose prefix matches a
// model id wins, so more specific vendors must come before generic ones.
var openClawProviderMappings = []openClawProviderMapping{
	{"anthropic", "Claude", "Anthropic Claude", []string{"ANTHROPIC_API_KEY", "CLAUDE_API_KEY"}, []string{"anthropic", "claude"}},
	{"openai", "OpenAI", "OpenAI", []string{"OPENAI_API_KEY"}, []string{"openai", "gpt", "o1", "o3", "o4"}},
	{"google", "Gemini", "Google Gemini", []string{"GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"}, []string{"google", "gemini"}},
	{"openrouter", "OpenRouter", "OpenRouter", []string{"OPENROUTER_API_KEY"}, []string{"openrouter"}},
	{"deepseek", "DeepSeek", "DeepSeek", []string{"DEEPSEEK_API_KEY"}, []string{"deepseek"}},
	{"xai", "Grok", "xAI Grok", []string{"XAI_API_KEY", "GROK_API_KEY"}, []string{"xai", "grok"}},
	{"mistral", "Mistral", "Mistral", []string{"MISTRAL_API_KEY"}, []string{"mistral"}},
	{"moonshot", "Moonshot", "Moonshot", []string{"MOONSHOT_API_KEY"}, []string{"moonshot", "kimi"}},
	{"alibaba", "Alibaba Cloud", "Alibaba Cloud", []string{"DASHSCOPE_API_KEY", "ALIBABA_API_KEY"}, []string{"alibaba", "dashscope", "qwen"}},
	{"siliconflow", "Silicon Flow", "Silicon Flow", []string{"SILICONFLOW_API_KEY", "SILICON_FLOW_API_KEY"}, []string{"siliconflow", "silicon-flow"}},
	{"zhipu", "ChatGLM", "Zhipu ChatGLM", []string{"ZHIPU_API_KEY", "ZHIPUAI_API_KEY", "GLM_API_KEY"}, []string{"zhipu", "glm", "chatglm"}},
	{"cohere", "Cohere", "Cohere", []string{"COHERE_API_KEY"}, []string{"cohere", "command-r"}},
	{"ollama", "Ollama", "Ollama", nil, []string{"ollama"}},
}

// splitOpenClawModelId splits "anthropic/claude-opus-4-5" into vendor and model.
// A bare model id has no vendor part, so the model itself is used for matching.
func splitOpenClawModelId(modelId string) (string, string) {
	modelId = strings.TrimSpace(modelId)
	if modelId == "" {
		return "", ""
	}
	if index := strings.Index(modelId, "/"); index > 0 {
		return strings.ToLower(modelId[:index]), modelId[index+1:]
	}
	return "", modelId
}

// matchOpenClawProvider picks the mapping for a model id, falling back to a
// generic OpenAI-compatible provider so an unknown vendor still migrates.
func matchOpenClawProvider(modelId string) (openClawProviderMapping, string) {
	vendor, model := splitOpenClawModelId(modelId)
	needle := strings.ToLower(vendor)
	if needle == "" {
		needle = strings.ToLower(model)
	}

	for _, mapping := range openClawProviderMappings {
		for _, prefix := range mapping.modelPrefixes {
			if strings.HasPrefix(needle, prefix) {
				return mapping, model
			}
		}
	}

	key := vendor
	if key == "" {
		key = "custom"
	}
	return openClawProviderMapping{
		key:          key,
		providerType: "OpenAI Compatible",
		displayName:  fmt.Sprintf("%s (OpenAI compatible)", key),
	}, model
}

func openClawProviderName(key string) string {
	return NormalizeEntityName("provider-model-" + key)
}

// extractProviders builds one Provider per vendor referenced by the config,
// pairing model ids with the API keys found in env / models / providers.
// It returns model-id -> provider-name so agents can be wired up afterwards.
func (adapter *openClawAdapter) extractProviders(config *openClawConfig, bundle *Bundle) map[string]string {
	// vendor key -> provider being built, plus the creation order so the
	// warnings below come out in a stable sequence.
	providers := map[string]*BundleProvider{}
	providerTypes := map[string]string{}
	providerKeys := []string{}
	modelToProvider := map[string]string{}

	apiKeyFor := func(mapping openClawProviderMapping) string {
		for _, envName := range mapping.envNames {
			if value, ok := config.Env[envName]; ok && value != "" {
				return value
			}
		}
		return ""
	}

	addModel := func(modelId string) {
		if strings.TrimSpace(modelId) == "" {
			return
		}
		mapping, model := matchOpenClawProvider(modelId)
		name := openClawProviderName(mapping.key)

		provider, ok := providers[mapping.key]
		if !ok {
			displayName := mapping.displayName
			if displayName == "" {
				displayName = mapping.key
			}
			provider = &BundleProvider{
				Name:         name,
				DisplayName:  displayName,
				Category:     "Model",
				Type:         mapping.providerType,
				SubType:      model,
				ClientSecret: apiKeyFor(mapping),
			}
			providers[mapping.key] = provider
			providerTypes[mapping.key] = mapping.providerType
			providerKeys = append(providerKeys, mapping.key)
			bundle.Providers = append(bundle.Providers, provider)
		}
		modelToProvider[modelId] = name
	}

	collectAgentModels := func(agent *openClawAgent) {
		if agent == nil {
			return
		}
		addModel(agent.Model.Primary)
		for _, fallback := range agent.Model.Fallbacks {
			addModel(fallback)
		}
	}

	collectAgentModels(config.Agents.Defaults)
	for _, name := range sortedAgentIds(config.Agents.Entries) {
		collectAgentModels(config.Agents.Entries[name])
	}

	// Explicit provider blocks can carry a base URL and their own key, which
	// takes precedence over anything inferred from env.
	for _, block := range []map[string]*openClawModelProvider{config.Models, config.Providers} {
		for rawName := range block {
			entry := block[rawName]
			if entry == nil {
				continue
			}
			modelId := entry.Model
			if modelId == "" {
				modelId = rawName
			}
			addModel(modelId)

			mapping, _ := matchOpenClawProvider(modelId)
			if provider, ok := providers[mapping.key]; ok {
				if entry.ApiKey != "" {
					provider.ClientSecret = entry.ApiKey
				}
				if baseUrl := firstNonEmpty(entry.BaseUrl, entry.BaseURL); baseUrl != "" {
					provider.ProviderUrl = baseUrl
				}
			}
		}
	}

	// Only warn once every source of keys has been consulted: a provider first
	// seen through an agent's model id often gets its key from a later block.
	for _, key := range providerKeys {
		provider := providers[key]
		if provider.ClientSecret == "" && providerTypes[key] != "Ollama" {
			bundle.addWarning("provider", provider.DisplayName,
				"no API key found in the config; set it in OpenAgent after migrating")
		}
	}

	return modelToProvider
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func sortedAgentIds(entries map[string]*openClawAgent) []string {
	ids := make([]string, 0, len(entries))
	for id := range entries {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

// ---------------------------------------------------------------------------
// MCP servers
// ---------------------------------------------------------------------------

func (adapter *openClawAdapter) extractMcpServers(config *openClawConfig, bundle *Bundle) {
	merged := map[string]*openClawMcpServer{}
	for _, source := range []map[string]*openClawMcpServer{
		config.Mcp.Servers, config.Mcp.McpServers, config.McpServers,
	} {
		for name, server := range source {
			if server != nil {
				merged[name] = server
			}
		}
	}

	names := make([]string, 0, len(merged))
	for name := range merged {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, name := range names {
		server := merged[name]
		if server.Enabled != nil && !*server.Enabled {
			bundle.addWarning("mcp", name, "disabled in OpenClaw, not migrated")
			continue
		}

		transport := firstNonEmpty(server.Type, server.Transport)
		if transport == "" {
			if server.Url != "" {
				transport = "streamablehttp"
			} else {
				transport = "stdio"
			}
		}
		// OpenClaw uses "http" for what OpenAgent calls "streamablehttp".
		if transport == "http" {
			transport = "streamablehttp"
		}

		env := map[string]string{}
		for key, value := range server.Env {
			env[key] = value
		}
		token := ""
		for key, value := range server.Headers {
			if strings.EqualFold(key, "Authorization") {
				token = strings.TrimPrefix(value, "Bearer ")
				continue
			}
			env[key] = value
		}

		if transport == "stdio" && server.Command == "" {
			bundle.addWarning("mcp", name, "stdio server without a command, not migrated")
			continue
		}

		bundle.McpServers = append(bundle.McpServers, &BundleMcpServer{
			Name:        NormalizeEntityName(name),
			DisplayName: name,
			Url:         server.Url,
			Token:       token,
			Transport:   transport,
			Command:     server.Command,
			Args:        server.Args,
			Env:         env,
		})
	}
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

// extractSkills reads every skill folder OpenClaw would load: the bundled
// skills/ directory plus any configured extraDirs. LoadSkill already
// understands this exact SKILL.md layout, so the mapping is one to one.
func (adapter *openClawAdapter) extractSkills(config *openClawConfig, root string, bundle *Bundle) {
	if root == "" {
		if len(config.Skills.Entries) > 0 {
			bundle.addWarning("skill", "skills",
				"skills live in folders on disk; upload a .zip of ~/.openclaw or use a server-side path to migrate them")
		}
		return
	}

	dirs := []string{filepath.Join(root, "skills")}
	for _, extraDir := range config.Skills.Load.ExtraDirs {
		dirs = append(dirs, expandOpenClawPath(extraDir, root))
	}

	seen := map[string]bool{}
	for _, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if !entry.IsDir() || seen[entry.Name()] {
				continue
			}

			skill, err := skillmd.LoadFolder(filepath.Join(dir, entry.Name()))
			if err != nil {
				bundle.addWarning("skill", entry.Name(), err.Error())
				continue
			}
			seen[entry.Name()] = true

			enabled := true
			if setting, ok := config.Skills.Entries[skill.Name]; ok && setting.Enabled != nil {
				enabled = *setting.Enabled
			}

			bundle.Skills = append(bundle.Skills, &BundleSkill{
				Name:        skill.Name,
				DisplayName: skill.DisplayName,
				Description: skill.Description,
				Homepage:    skill.Homepage,
				Emoji:       skill.Emoji,
				Metadata:    skill.Metadata,
				Content:     skill.Content,
				SkillMd:     skill.SkillMd,
				References:  toBundleFiles(skill.References),
				Enabled:     enabled,
			})
		}
	}
}

// expandOpenClawPath resolves "~" and relative paths the way OpenClaw does.
func expandOpenClawPath(path string, root string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	if strings.HasPrefix(path, "~") {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, strings.TrimPrefix(path, "~"))
		}
	}
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(root, path)
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

func (adapter *openClawAdapter) extractAgents(config *openClawConfig, modelToProvider map[string]string, bundle *Bundle) {
	entries := config.Agents.Entries
	if len(entries) == 0 {
		// A config with only defaults still describes one working agent.
		if config.Agents.Defaults == nil {
			return
		}
		entries = map[string]*openClawAgent{"main": config.Agents.Defaults}
	}

	// The first MCP server becomes the agent's server: Store holds exactly one.
	defaultMcpServer := ""
	if len(bundle.McpServers) > 0 {
		defaultMcpServer = bundle.McpServers[0].Name
		if len(bundle.McpServers) > 1 {
			bundle.addWarning("agent", "mcpServer",
				fmt.Sprintf("an OpenAgent agent references one MCP server; %q was wired up and the other %d were imported but left unattached",
					defaultMcpServer, len(bundle.McpServers)-1))
		}
	}

	isFirst := true
	for _, id := range sortedAgentIds(entries) {
		agent := mergeOpenClawAgent(config.Agents.Defaults, entries[id])

		displayName := firstNonEmpty(agent.Identity.Name, id)
		prompt := firstNonEmpty(agent.Prompt, agent.SystemPrompt, agent.Instructions)

		skills := []string{}
		for _, skillName := range agent.Skills {
			skills = append(skills, skillName)
		}

		bundle.Agents = append(bundle.Agents, &BundleAgent{
			Name:          NormalizeEntityName("store-" + id),
			DisplayName:   displayName,
			Prompt:        prompt,
			Avatar:        agent.Identity.Avatar,
			WelcomeTitle:  displayName,
			ModelProvider: modelToProvider[agent.Model.Primary],
			McpServer:     defaultMcpServer,
			Skills:        skills,
			MemoryLimit:   agent.ContextLimit,
			IsDefault:     isFirst,
		})
		isFirst = false
	}
}

// mergeOpenClawAgent layers a per-agent entry over agents.defaults, which is
// how OpenClaw resolves an agent's effective configuration.
func mergeOpenClawAgent(defaults *openClawAgent, entry *openClawAgent) *openClawAgent {
	merged := openClawAgent{}
	if defaults != nil {
		merged = *defaults
	}
	if entry == nil {
		return &merged
	}

	if entry.Workspace != "" {
		merged.Workspace = entry.Workspace
	}
	if entry.Model.Primary != "" {
		merged.Model = entry.Model
	}
	if len(entry.Skills) > 0 {
		merged.Skills = entry.Skills
	}
	if entry.Identity.Name != "" {
		merged.Identity.Name = entry.Identity.Name
	}
	if entry.Identity.Emoji != "" {
		merged.Identity.Emoji = entry.Identity.Emoji
	}
	if entry.Identity.Avatar != "" {
		merged.Identity.Avatar = entry.Identity.Avatar
	}
	if entry.Prompt != "" {
		merged.Prompt = entry.Prompt
	}
	if entry.SystemPrompt != "" {
		merged.SystemPrompt = entry.SystemPrompt
	}
	if entry.Instructions != "" {
		merged.Instructions = entry.Instructions
	}
	if entry.ContextLimit != 0 {
		merged.ContextLimit = entry.ContextLimit
	}
	if entry.MaxConcurrent != 0 {
		merged.MaxConcurrent = entry.MaxConcurrent
	}
	return &merged
}

// ---------------------------------------------------------------------------
// Chats
// ---------------------------------------------------------------------------

func (adapter *openClawAdapter) extractChats(config *openClawConfig, root string, bundle *Bundle) {
	if root == "" {
		bundle.addWarning("chat", "sessions",
			"transcripts live on disk; upload a .zip of ~/.openclaw or use a server-side path to migrate them")
		return
	}

	agentsDir := filepath.Join(root, "agents")
	entries, err := os.ReadDir(agentsDir)
	if err != nil {
		return
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		agentId := entry.Name()
		agentName := NormalizeEntityName("store-" + agentId)

		chats, warnings := readOpenClawTranscripts(filepath.Join(agentsDir, agentId), agentName)
		bundle.Chats = append(bundle.Chats, chats...)
		for _, warning := range warnings {
			bundle.addWarning("chat", agentId, warning)
		}
	}
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

// warnAboutUnmappableSections reports the OpenClaw features OpenAgent has no
// equivalent for. Surfacing them is the point: a user who relied on a WhatsApp
// channel needs to know it did not come across.
func (adapter *openClawAdapter) warnAboutUnmappableSections(config *openClawConfig, bundle *Bundle) {
	for _, name := range sortedRawKeys(config.Channels) {
		bundle.addWarning("channel", name,
			"OpenAgent has no messaging-channel equivalent yet; this channel and its credentials were not migrated")
	}

	unmapped := []struct {
		raw     json.RawMessage
		name    string
		reason  string
		enabled bool
	}{
		{config.Cron, "cron", "scheduled jobs are not migrated; recreate them in OpenAgent", len(config.Cron) > 0},
		{config.Hooks, "hooks", "webhook ingestion endpoints are not migrated", len(config.Hooks) > 0},
		{config.Plugins, "plugins", "OpenClaw plugins have no OpenAgent equivalent", len(config.Plugins) > 0},
		{config.Gateway, "gateway", "gateway port and auth settings are server config in OpenAgent, set them in conf/app.conf", len(config.Gateway) > 0},
		{config.Tools, "tools", "tool allow/deny rules are not migrated in this version; set them under Tool Permissions", len(config.Tools) > 0},
	}
	for _, section := range unmapped {
		if section.enabled && !isEmptyJson(section.raw) {
			bundle.addWarning("config", section.name, section.reason)
		}
	}
}

func sortedRawKeys(raw map[string]json.RawMessage) []string {
	keys := make([]string, 0, len(raw))
	for key := range raw {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func isEmptyJson(raw json.RawMessage) bool {
	trimmed := strings.TrimSpace(string(raw))
	return trimmed == "" || trimmed == "null" || trimmed == "{}" || trimmed == "[]"
}

// toBundleFiles converts the reference files of a skill folder into the
// bundle's own shape, so the IR stays free of any other package's types.
func toBundleFiles(files []skillmd.File) []BundleFile {
	converted := []BundleFile{}
	for _, file := range files {
		converted = append(converted, BundleFile{Name: file.Name, Content: file.Content})
	}
	return converted
}
