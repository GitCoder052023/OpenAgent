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

// The storage half of the migration feature: everything that reads or writes
// rows. The migration package decides what a run should do; this file is where
// it actually touches the database.

package object

import (
	"fmt"
	"strings"

	"github.com/the-open-agent/openagent/migration"
	"github.com/the-open-agent/openagent/util"
	"xorm.io/core"
)

// migrationLookup answers the migration planner's questions about names that
// are already taken. It is the whole of what planning knows about storage.
type migrationLookup struct {
	owner string
}

func (lookup *migrationLookup) SkillState(name string, skill *migration.BundleSkill) (bool, bool, error) {
	existing, err := getSkill(lookup.owner, name)
	if err != nil || existing == nil {
		return false, false, err
	}
	return true, strings.TrimSpace(existing.SkillMd) == strings.TrimSpace(skill.SkillMd), nil
}

func (lookup *migrationLookup) ProviderState(name string, provider *migration.BundleProvider) (bool, bool, error) {
	existing, err := getProvider(lookup.owner, name)
	if err != nil || existing == nil {
		return false, false, err
	}
	identical := existing.Type == provider.Type && existing.SubType == provider.SubType &&
		existing.ClientSecret == provider.ClientSecret && existing.ProviderUrl == provider.ProviderUrl
	return true, identical, nil
}

func (lookup *migrationLookup) ServerState(name string, server *migration.BundleMcpServer) (bool, bool, error) {
	existing, err := getServer(lookup.owner, name)
	if err != nil || existing == nil {
		return false, false, err
	}
	identical := existing.Url == server.Url && existing.Command == server.Command &&
		strings.Join(existing.Args, " ") == strings.Join(server.Args, " ")
	return true, identical, nil
}

// AgentState never reports an agent as identical: a Store carries far more
// configuration than a bundle can describe, so "the same name exists" is all
// that can honestly be said about it.
func (lookup *migrationLookup) AgentState(name string, agent *migration.BundleAgent) (bool, bool, error) {
	existing, err := getStore(lookup.owner, name)
	if err != nil || existing == nil {
		return false, false, err
	}
	return true, false, nil
}

// BuildMigrationPlan is the dry run the wizard shows: it reads the database to
// find name conflicts and writes nothing.
func BuildMigrationPlan(owner string, bundle *migration.Bundle, options *migration.Options) (*migration.Plan, error) {
	return migration.BuildPlan(owner, bundle, options, &migrationLookup{owner: owner})
}

// StartMigration registers a run and applies it in the background, so a large
// import (thousands of messages) does not hold an HTTP request open. The caller
// polls migration.GetProgress with the returned id.
func StartMigration(owner string, bundle *migration.Bundle, plan *migration.Plan) (*migration.Progress, error) {
	if bundle == nil || plan == nil {
		return nil, fmt.Errorf("migration bundle or plan is missing")
	}

	progress := migration.NewProgress(owner, bundle, plan)

	go func() {
		err := applyMigration(owner, bundle, plan, progress.Id)
		saveMigrationRecord(migration.FinishProgress(progress.Id, err), plan)
	}()

	return progress, nil
}

// applyMigration writes the plan. Categories are applied in dependency order so
// that an agent row can reference the providers, servers and skills that were
// just created -- possibly under renamed targets.
func applyMigration(owner string, bundle *migration.Bundle, plan *migration.Plan, progressId string) error {
	itemsByKey := map[string]*migration.Item{}
	for _, item := range plan.Items {
		itemsByKey[item.Key] = item
	}

	// sourceName -> targetName, so agent references survive renaming.
	renames := map[string]map[string]string{
		migration.CategorySkill:    {},
		migration.CategoryProvider: {},
		migration.CategoryServer:   {},
	}

	lookupItem := func(category string, sourceName string) *migration.Item {
		return itemsByKey[category+"/"+sourceName]
	}

	now := util.GetCurrentTime()

	for _, skill := range bundle.Skills {
		item := lookupItem(migration.CategorySkill, skill.Name)
		if item == nil || item.Action == migration.ActionSkip {
			if item != nil {
				renames[migration.CategorySkill][skill.Name] = item.TargetName
			}
			continue
		}
		migration.NoteItemStarted(progressId, item)

		state := "Active"
		if !skill.Enabled {
			state = "Inactive"
		}
		row := &Skill{
			Owner:       owner,
			Name:        item.TargetName,
			CreatedTime: now,
			DisplayName: skill.DisplayName,
			Type:        bundle.Source,
			Description: skill.Description,
			Homepage:    skill.Homepage,
			Emoji:       skill.Emoji,
			Metadata:    skill.Metadata,
			Content:     skill.Content,
			SkillMd:     skill.SkillMd,
			References:  toSkillReferences(skill.References),
			State:       state,
		}
		if err := upsertMigratedRow(item.Action, core.PK{owner, item.TargetName}, row, func() error {
			_, err := AddSkill(row)
			return err
		}); err != nil {
			migration.NoteItemFailed(progressId, item, err)
			continue
		}
		renames[migration.CategorySkill][skill.Name] = item.TargetName
		migration.NoteItemDone(progressId, item)
	}

	for _, provider := range bundle.Providers {
		item := lookupItem(migration.CategoryProvider, provider.Name)
		if item == nil || item.Action == migration.ActionSkip {
			if item != nil {
				renames[migration.CategoryProvider][provider.Name] = item.TargetName
			}
			continue
		}
		migration.NoteItemStarted(progressId, item)

		row := &Provider{
			Owner:        owner,
			Name:         item.TargetName,
			CreatedTime:  now,
			DisplayName:  provider.DisplayName,
			Category:     provider.Category,
			Type:         provider.Type,
			SubType:      provider.SubType,
			ClientId:     provider.ClientId,
			ClientSecret: provider.ClientSecret,
			ProviderUrl:  provider.ProviderUrl,
			ApiVersion:   provider.ApiVersion,
			Temperature:  provider.Temperature,
			TopP:         provider.TopP,
			State:        "Active",
		}
		if err := upsertMigratedRow(item.Action, core.PK{owner, item.TargetName}, row, func() error {
			_, err := AddProvider(row)
			return err
		}); err != nil {
			migration.NoteItemFailed(progressId, item, err)
			continue
		}
		renames[migration.CategoryProvider][provider.Name] = item.TargetName
		migration.NoteItemDone(progressId, item)
	}

	for _, server := range bundle.McpServers {
		item := lookupItem(migration.CategoryServer, server.Name)
		if item == nil || item.Action == migration.ActionSkip {
			if item != nil {
				renames[migration.CategoryServer][server.Name] = item.TargetName
			}
			continue
		}
		migration.NoteItemStarted(progressId, item)

		row := &Server{
			Owner:       owner,
			Name:        item.TargetName,
			CreatedTime: now,
			UpdatedTime: now,
			DisplayName: server.DisplayName,
			Url:         server.Url,
			Token:       server.Token,
			Transport:   server.Transport,
			Command:     server.Command,
			Args:        server.Args,
			Env:         server.Env,
			Tools:       []*McpTool{},
		}
		if err := upsertMigratedRow(item.Action, core.PK{owner, item.TargetName}, row, func() error {
			_, err := AddServer(row)
			return err
		}); err != nil {
			migration.NoteItemFailed(progressId, item, err)
			continue
		}
		renames[migration.CategoryServer][server.Name] = item.TargetName
		migration.NoteItemDone(progressId, item)
	}

	// agentTargets lets imported chats attach to the store they belong to.
	agentTargets := map[string]string{}

	for _, agent := range bundle.Agents {
		item := lookupItem(migration.CategoryAgent, agent.Name)
		if item == nil || item.Action == migration.ActionSkip {
			continue
		}
		migration.NoteItemStarted(progressId, item)

		row := buildMigratedStore(owner, item.TargetName, now, agent, renames)
		if err := upsertMigratedRow(item.Action, core.PK{owner, item.TargetName}, row, func() error {
			_, err := AddStore(row)
			return err
		}); err != nil {
			migration.NoteItemFailed(progressId, item, err)
			continue
		}
		agentTargets[agent.Name] = item.TargetName
		migration.NoteItemDone(progressId, item)
	}

	for _, chat := range bundle.Chats {
		item := lookupItem(migration.CategoryChat, chat.Name)
		if item == nil || item.Action == migration.ActionSkip {
			continue
		}
		migration.NoteItemStarted(progressId, item)

		if err := applyMigratedChat(owner, item.TargetName, chat, agentTargets); err != nil {
			migration.NoteItemFailed(progressId, item, err)
			continue
		}
		migration.NoteItemDone(progressId, item)
	}

	return nil
}

// upsertMigratedRow inserts a new row, or replaces an existing one in place
// when the plan asked to overwrite.
func upsertMigratedRow(action string, pk core.PK, row interface{}, insert func() error) error {
	if action == migration.ActionOverwrite {
		_, err := adapter.engine.ID(pk).AllCols().Update(row)
		return err
	}
	return insert()
}

// buildMigratedStore maps a migration.BundleAgent onto a Store, keeping OpenAgent's
// defaults for everything the source has no concept of.
func buildMigratedStore(owner string, name string, now string, agent *migration.BundleAgent, renames map[string]map[string]string) *Store {
	skills := []string{}
	for _, skillName := range agent.Skills {
		if target, ok := renames[migration.CategorySkill][skillName]; ok {
			skills = append(skills, target)
		} else {
			skills = append(skills, migration.NormalizeEntityName(skillName))
		}
	}
	if len(skills) == 0 {
		skills = []string{"All"}
	}

	modelProvider := agent.ModelProvider
	if target, ok := renames[migration.CategoryProvider][modelProvider]; ok {
		modelProvider = target
	}
	mcpServer := agent.McpServer
	if target, ok := renames[migration.CategoryServer][mcpServer]; ok {
		mcpServer = target
	}

	memoryLimit := agent.MemoryLimit
	if memoryLimit <= 0 {
		memoryLimit = 10
	}

	displayName := agent.DisplayName
	if displayName == "" {
		displayName = agent.Name
	}

	return &Store{
		Owner:               owner,
		Name:                name,
		CreatedTime:         now,
		DisplayName:         displayName,
		Title:               displayName,
		Avatar:              agent.Avatar,
		StorageProvider:     "provider-storage-built-in",
		StorageSubpath:      name,
		SplitProvider:       "Default",
		ModelProvider:       modelProvider,
		McpServer:           mcpServer,
		Prompt:              agent.Prompt,
		WelcomeTitle:        agent.WelcomeTitle,
		WelcomeText:         agent.WelcomeText,
		Frequency:           10000,
		MemoryLimit:         memoryLimit,
		LimitMinutes:        15,
		KnowledgeCount:      5,
		SuggestionCount:     3,
		Skills:              skills,
		Tools:               []string{"All"},
		ExampleQuestions:    []ExampleQuestion{},
		ChildStores:         []string{},
		ChildModelProviders: []string{},
		PropertiesMap:       map[string]*Properties{},
		State:               "Active",
	}
}

// applyMigratedChat writes one conversation. Messages are batch-inserted and
// the chat counters set once, rather than going through AddMessage per row:
// a migrated transcript can hold thousands of turns.
func applyMigratedChat(owner string, name string, chat *migration.BundleChat, agentTargets map[string]string) error {
	store := agentTargets[chat.Agent]

	createdTime := chat.CreatedTime
	if createdTime == "" {
		createdTime = util.GetCurrentTime()
	}
	updatedTime := chat.UpdatedTime
	if updatedTime == "" {
		updatedTime = createdTime
	}

	user := chat.User
	if user == "" {
		user = owner
	}

	displayName := chat.DisplayName
	if displayName == "" {
		displayName = chat.Name
	}

	row := &Chat{
		Owner:        owner,
		Name:         name,
		CreatedTime:  createdTime,
		UpdatedTime:  updatedTime,
		DisplayName:  displayName,
		Store:        store,
		User:         user,
		Category:     "Imported",
		Source:       "Migration",
		MessageCount: len(chat.Messages),
	}
	if _, err := AddChat(row); err != nil {
		return err
	}

	messages := make([]interface{}, 0, len(chat.Messages))
	tokenCount := 0
	lastTime := createdTime
	previousUserMessageName := ""

	for _, message := range chat.Messages {
		messageTime := message.CreatedTime
		if messageTime == "" {
			messageTime = util.GetCurrentTimeBasedOnLastMilli(lastTime)
		}
		lastTime = messageTime

		messageName := fmt.Sprintf("message_%s", util.GetRandomName())
		replyTo := ""
		if message.Author == "AI" {
			replyTo = previousUserMessageName
		} else {
			previousUserMessageName = messageName
		}

		tokenCount += message.TokenCount
		messages = append(messages, &Message{
			Owner:       owner,
			Name:        messageName,
			CreatedTime: messageTime,
			Store:       store,
			Chat:        name,
			User:        user,
			Author:      message.Author,
			ReplyTo:     replyTo,
			Text:        message.Text,
			ReasonText:  message.ReasonText,
			TokenCount:  message.TokenCount,
		})
	}

	if len(messages) > 0 {
		if _, err := adapter.engine.Insert(messages...); err != nil {
			return err
		}
	}

	if tokenCount > 0 {
		row.TokenCount = tokenCount
		if _, err := adapter.engine.ID(core.PK{owner, name}).Cols("token_count").Update(row); err != nil {
			return err
		}
	}
	return nil
}

// toSkillReferences converts a bundle's extra skill files into the storage
// layer's own shape.
func toSkillReferences(files []migration.BundleFile) []SkillReference {
	references := []SkillReference{}
	for _, file := range files {
		references = append(references, SkillReference{Name: file.Name, Content: file.Content})
	}
	return references
}
