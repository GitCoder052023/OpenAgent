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

// The neutral intermediate representation every source is translated into.
// Nothing in this package touches the database: an adapter reads a third-party
// installation and produces a Bundle, and the storage layer decides what to do
// with it. That split is what lets a new source be added by writing one file
// here and nothing anywhere else.

package migration

// BundleFile is one extra file shipped alongside a skill's SKILL.md.
type BundleFile struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// BundleSkill maps to a Skill.
type BundleSkill struct {
	Name        string       `json:"name"`
	DisplayName string       `json:"displayName"`
	Description string       `json:"description"`
	Homepage    string       `json:"homepage"`
	Emoji       string       `json:"emoji"`
	Metadata    string       `json:"metadata"`
	Content     string       `json:"content"`
	SkillMd     string       `json:"skillMd"`
	References  []BundleFile `json:"references"`
	Enabled     bool         `json:"enabled"`
}

// BundleProvider maps to a Provider. Only the fields a third-party agent can
// realistically supply are modelled; everything else keeps OpenAgent defaults.
type BundleProvider struct {
	Name         string  `json:"name"`
	DisplayName  string  `json:"displayName"`
	Category     string  `json:"category"`
	Type         string  `json:"type"`
	SubType      string  `json:"subType"`
	ClientId     string  `json:"clientId"`
	ClientSecret string  `json:"clientSecret"`
	ProviderUrl  string  `json:"providerUrl"`
	ApiVersion   string  `json:"apiVersion"`
	Temperature  float32 `json:"temperature"`
	TopP         float32 `json:"topP"`
}

// BundleMcpServer maps to a Server.
type BundleMcpServer struct {
	Name        string            `json:"name"`
	DisplayName string            `json:"displayName"`
	Url         string            `json:"url"`
	Token       string            `json:"token"`
	Transport   string            `json:"transport"`
	Command     string            `json:"command"`
	Args        []string          `json:"args"`
	Env         map[string]string `json:"env"`
}

// BundleAgent maps to a Store -- OpenAgent's unit of "one configured agent".
type BundleAgent struct {
	Name          string   `json:"name"`
	DisplayName   string   `json:"displayName"`
	Prompt        string   `json:"prompt"`
	Avatar        string   `json:"avatar"`
	WelcomeTitle  string   `json:"welcomeTitle"`
	WelcomeText   string   `json:"welcomeText"`
	ModelProvider string   `json:"modelProvider"`
	McpServer     string   `json:"mcpServer"`
	Skills        []string `json:"skills"`
	MemoryLimit   int      `json:"memoryLimit"`
	IsDefault     bool     `json:"isDefault"`
}

// BundleMessage is one turn of a conversation. Author follows the OpenAgent
// convention: "AI" for the assistant, anything else for a human.
type BundleMessage struct {
	Author      string `json:"author"`
	Text        string `json:"text"`
	ReasonText  string `json:"reasonText"`
	CreatedTime string `json:"createdTime"`
	TokenCount  int    `json:"tokenCount"`
}

// BundleChat maps to a Chat plus its Messages.
type BundleChat struct {
	Name        string           `json:"name"`
	DisplayName string           `json:"displayName"`
	Agent       string           `json:"agent"`
	User        string           `json:"user"`
	CreatedTime string           `json:"createdTime"`
	UpdatedTime string           `json:"updatedTime"`
	Messages    []*BundleMessage `json:"messages"`
}

// BundleWarning records something the source had that OpenAgent cannot yet
// represent. Warnings are surfaced in the UI instead of being dropped silently
// -- a migration that quietly loses configuration is not a painless one.
type BundleWarning struct {
	Category string `json:"category"`
	Item     string `json:"item"`
	Reason   string `json:"reason"`
}

// Bundle is the neutral representation every adapter produces.
type Bundle struct {
	Source        string             `json:"source"`
	SourceVersion string             `json:"sourceVersion"`
	SourcePath    string             `json:"sourcePath"`
	Agents        []*BundleAgent     `json:"agents"`
	Providers     []*BundleProvider  `json:"providers"`
	Skills        []*BundleSkill     `json:"skills"`
	McpServers    []*BundleMcpServer `json:"mcpServers"`
	Chats         []*BundleChat      `json:"chats"`
	Warnings      []*BundleWarning   `json:"warnings"`
}

func (b *Bundle) addWarning(category string, item string, reason string) {
	b.Warnings = append(b.Warnings, &BundleWarning{Category: category, Item: item, Reason: reason})
}
