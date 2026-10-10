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

// The planning half: what a run would do, decided before anything is written.
// A plan is a pure function of the bundle, the options and the answers the
// storage layer gives about existing names.

package migration

import (
	"fmt"
	"strings"

	"github.com/the-open-agent/openagent/util"
)

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

// NormalizeEntityName turns a free-form third-party identifier into something
// usable as an OpenAgent entity name: lowercase, no spaces, no slashes.
func NormalizeEntityName(name string) string {
	name = strings.TrimSpace(strings.ToLower(name))
	replacer := strings.NewReplacer(" ", "-", "/", "-", "\\", "-", ":", "-", "_", "-", ".", "-")
	name = replacer.Replace(name)
	for strings.Contains(name, "--") {
		name = strings.ReplaceAll(name, "--", "-")
	}
	name = strings.Trim(name, "-")
	if len(name) > 80 {
		name = name[:80]
	}
	return name
}

// Lookup is everything planning needs from the storage layer: for one candidate
// name, whether an entity of that category already exists, and whether what it
// holds is what the bundle was about to import. Keeping it an interface is what
// lets the planning rules be tested -- and read -- without a database.
type Lookup interface {
	SkillState(name string, skill *BundleSkill) (exists bool, identical bool, err error)
	ProviderState(name string, provider *BundleProvider) (exists bool, identical bool, err error)
	ServerState(name string, server *BundleMcpServer) (exists bool, identical bool, err error)
	AgentState(name string, agent *BundleAgent) (exists bool, identical bool, err error)
}

// Conflict policies decide what happens when an imported name is already taken.
const (
	// ConflictRename imports under a source-prefixed name. Default,
	// because it is the only policy that cannot lose existing data.
	ConflictRename = "rename"
	// ConflictSkip leaves the existing entity untouched.
	ConflictSkip = "skip"
	// ConflictOverwrite replaces the existing entity.
	ConflictOverwrite = "overwrite"
)

// Item categories, in apply order: an agent references providers, MCP servers
// and skills, so those must exist before the agent row is written.
const (
	CategorySkill    = "skill"
	CategoryProvider = "provider"
	CategoryServer   = "server"
	CategoryAgent    = "agent"
	CategoryChat     = "chat"
)

// Planned actions.
const (
	ActionCreate    = "create"
	ActionOverwrite = "overwrite"
	ActionSkip      = "skip"
)

// Run states.
const (
	StatusRunning = "Running"
	StatusDone    = "Done"
	StatusError   = "Error"
)

// Options controls what a run covers.
type Options struct {
	ConflictPolicy string `json:"conflictPolicy"`

	IncludeSkills     bool `json:"includeSkills"`
	IncludeProviders  bool `json:"includeProviders"`
	IncludeMcpServers bool `json:"includeMcpServers"`
	IncludeAgents     bool `json:"includeAgents"`
	IncludeChats      bool `json:"includeChats"`

	// SelectedKeys limits the run to the given item keys ("category/sourceName").
	// Empty means "every item the Include flags allow".
	SelectedKeys []string `json:"selectedKeys"`
}

// GetDefaultOptions covers everything, renaming on conflict.
func GetDefaultOptions() *Options {
	return &Options{
		ConflictPolicy:    ConflictRename,
		IncludeSkills:     true,
		IncludeProviders:  true,
		IncludeMcpServers: true,
		IncludeAgents:     true,
		IncludeChats:      true,
	}
}

func (options *Options) includesCategory(category string) bool {
	switch category {
	case CategorySkill:
		return options.IncludeSkills
	case CategoryProvider:
		return options.IncludeProviders
	case CategoryServer:
		return options.IncludeMcpServers
	case CategoryAgent:
		return options.IncludeAgents
	case CategoryChat:
		return options.IncludeChats
	}
	return false
}

func (options *Options) includesKey(key string) bool {
	if len(options.SelectedKeys) == 0 {
		return true
	}
	for _, selected := range options.SelectedKeys {
		if selected == key {
			return true
		}
	}
	return false
}

// Item is one row of the preview table, and after a run the record of
// what was actually written.
type Item struct {
	Key         string `json:"key"`
	Category    string `json:"category"`
	SourceName  string `json:"sourceName"`
	TargetName  string `json:"targetName"`
	DisplayName string `json:"displayName"`
	Action      string `json:"action"`
	// Reason explains a skip or a rename so the user is never left guessing.
	Reason string `json:"reason"`
	// Count is a category-specific size hint (messages in a chat, references
	// in a skill), shown in the preview.
	Count int `json:"count"`
	// Secrets flags an item that carries an API key or token.
	Secrets bool `json:"secrets"`
}

// Summary is the per-category tally shown above the preview table.
type Summary struct {
	Category  string `json:"category"`
	Create    int    `json:"create"`
	Overwrite int    `json:"overwrite"`
	Skip      int    `json:"skip"`
}

// Plan is the dry-run result: exactly what a run would do, computed
// without writing anything.
type Plan struct {
	Source         string           `json:"source"`
	SourceVersion  string           `json:"sourceVersion"`
	SourcePath     string           `json:"sourcePath"`
	Owner          string           `json:"owner"`
	ConflictPolicy string           `json:"conflictPolicy"`
	Items          []*Item          `json:"items"`
	Warnings       []*BundleWarning `json:"warnings"`
	Summary        []*Summary       `json:"summary"`
	// Total counts the items a run would actually write.
	Total int `json:"total"`
}

// lookupFunc reports whether an entity name is taken, and whether the existing
// row is byte-for-byte the thing we were about to import.
type lookupFunc func(name string) (exists bool, identical bool, err error)

// resolveTarget decides the target name and action for one item.
// An existing row with identical content is always skipped regardless of
// policy: re-importing the same skill under a second name is noise, not safety.
func resolveTarget(policy string, prefix string, sourceName string, lookup lookupFunc) (string, string, string, error) {
	name := NormalizeEntityName(sourceName)
	if name == "" {
		name = NormalizeEntityName(prefix + "-" + util.GetRandomName())
	}

	exists, identical, err := lookup(name)
	if err != nil {
		return "", "", "", err
	}
	if !exists {
		return name, ActionCreate, "", nil
	}
	if identical {
		return name, ActionSkip, "already imported (identical content)", nil
	}

	switch policy {
	case ConflictSkip:
		return name, ActionSkip, "name already exists", nil
	case ConflictOverwrite:
		return name, ActionOverwrite, "existing entity will be replaced", nil
	}

	// Rename: prefix with the source id, then disambiguate with a counter.
	candidate := NormalizeEntityName(prefix + "-" + name)
	for i := 0; i < 100; i++ {
		probe := candidate
		if i > 0 {
			probe = fmt.Sprintf("%s-%d", candidate, i+1)
		}
		exists, _, err = lookup(probe)
		if err != nil {
			return "", "", "", err
		}
		if !exists {
			return probe, ActionCreate, fmt.Sprintf("renamed, %q was taken", name), nil
		}
	}
	return name, ActionSkip, "name already exists and no free alternative was found", nil
}

// BuildPlan turns a bundle into a preview. It asks the storage layer about
// name conflicts through Lookup and writes nothing itself.
func BuildPlan(owner string, bundle *Bundle, options *Options, storage Lookup) (*Plan, error) {
	if options == nil {
		options = GetDefaultOptions()
	}
	if options.ConflictPolicy == "" {
		options.ConflictPolicy = ConflictRename
	}

	plan := &Plan{
		Source:         bundle.Source,
		SourceVersion:  bundle.SourceVersion,
		SourcePath:     bundle.SourcePath,
		Owner:          owner,
		ConflictPolicy: options.ConflictPolicy,
		Items:          []*Item{},
		Warnings:       bundle.Warnings,
	}
	if plan.Warnings == nil {
		plan.Warnings = []*BundleWarning{}
	}

	prefix := bundle.Source
	// Names claimed earlier in this same plan must not be handed out twice.
	claimed := map[string]bool{}
	claim := func(category string, name string) { claimed[category+"/"+name] = true }
	isClaimed := func(category string, name string) bool { return claimed[category+"/"+name] }

	addItem := func(item *Item) {
		item.Key = item.Category + "/" + item.SourceName
		if !options.includesCategory(item.Category) || !options.includesKey(item.Key) {
			item.Action = ActionSkip
			item.Reason = "not selected"
		}
		plan.Items = append(plan.Items, item)
	}

	if options.IncludeSkills {
		for _, skill := range bundle.Skills {
			lookup := func(name string) (bool, bool, error) {
				if isClaimed(CategorySkill, name) {
					return true, false, nil
				}
				return storage.SkillState(name, skill)
			}
			target, action, reason, err := resolveTarget(options.ConflictPolicy, prefix, skill.Name, lookup)
			if err != nil {
				return nil, err
			}
			if action != ActionSkip {
				claim(CategorySkill, target)
			}
			addItem(&Item{
				Category:    CategorySkill,
				SourceName:  skill.Name,
				TargetName:  target,
				DisplayName: skill.DisplayName,
				Action:      action,
				Reason:      reason,
				Count:       len(skill.References),
			})
		}
	}

	if options.IncludeProviders {
		for _, provider := range bundle.Providers {
			lookup := func(name string) (bool, bool, error) {
				if isClaimed(CategoryProvider, name) {
					return true, false, nil
				}
				return storage.ProviderState(name, provider)
			}
			target, action, reason, err := resolveTarget(options.ConflictPolicy, prefix, provider.Name, lookup)
			if err != nil {
				return nil, err
			}
			if action != ActionSkip {
				claim(CategoryProvider, target)
			}
			addItem(&Item{
				Category:    CategoryProvider,
				SourceName:  provider.Name,
				TargetName:  target,
				DisplayName: provider.DisplayName,
				Action:      action,
				Reason:      reason,
				Secrets:     provider.ClientSecret != "",
			})
		}
	}

	if options.IncludeMcpServers {
		for _, server := range bundle.McpServers {
			lookup := func(name string) (bool, bool, error) {
				if isClaimed(CategoryServer, name) {
					return true, false, nil
				}
				return storage.ServerState(name, server)
			}
			target, action, reason, err := resolveTarget(options.ConflictPolicy, prefix, server.Name, lookup)
			if err != nil {
				return nil, err
			}
			if action != ActionSkip {
				claim(CategoryServer, target)
			}
			addItem(&Item{
				Category:    CategoryServer,
				SourceName:  server.Name,
				TargetName:  target,
				DisplayName: server.DisplayName,
				Action:      action,
				Reason:      reason,
				Secrets:     server.Token != "" || len(server.Env) > 0,
			})
		}
	}

	if options.IncludeAgents {
		for _, agent := range bundle.Agents {
			lookup := func(name string) (bool, bool, error) {
				if isClaimed(CategoryAgent, name) {
					return true, false, nil
				}
				return storage.AgentState(name, agent)
			}
			target, action, reason, err := resolveTarget(options.ConflictPolicy, prefix, agent.Name, lookup)
			if err != nil {
				return nil, err
			}
			if action != ActionSkip {
				claim(CategoryAgent, target)
			}
			addItem(&Item{
				Category:    CategoryAgent,
				SourceName:  agent.Name,
				TargetName:  target,
				DisplayName: agent.DisplayName,
				Action:      action,
				Reason:      reason,
				Count:       len(agent.Skills),
			})
		}
	}

	if options.IncludeChats {
		for _, chat := range bundle.Chats {
			// Chats are always created under a fresh random name, so they never
			// collide; the source name is kept only for traceability.
			addItem(&Item{
				Category:    CategoryChat,
				SourceName:  chat.Name,
				TargetName:  fmt.Sprintf("chat_%s", util.GetRandomName()),
				DisplayName: chat.DisplayName,
				Action:      ActionCreate,
				Count:       len(chat.Messages),
			})
		}
	}

	plan.Summary = summarizeItems(plan.Items)
	for _, item := range plan.Items {
		if item.Action != ActionSkip {
			plan.Total++
		}
	}
	return plan, nil
}

func summarizeItems(items []*Item) []*Summary {
	byCategory := map[string]*Summary{}
	for _, item := range items {
		summary, ok := byCategory[item.Category]
		if !ok {
			summary = &Summary{Category: item.Category}
			byCategory[item.Category] = summary
		}
		switch item.Action {
		case ActionCreate:
			summary.Create++
		case ActionOverwrite:
			summary.Overwrite++
		default:
			summary.Skip++
		}
	}

	summaries := []*Summary{}
	for _, category := range []string{
		CategorySkill, CategoryProvider, CategoryServer,
		CategoryAgent, CategoryChat,
	} {
		if summary, ok := byCategory[category]; ok {
			summaries = append(summaries, summary)
		}
	}
	return summaries
}
