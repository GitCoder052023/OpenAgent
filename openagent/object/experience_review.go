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
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/the-open-agent/openagent/model"
	"github.com/the-open-agent/openagent/util"
	"xorm.io/core"
)

const (
	experienceReviewMinToolCalls       = 3
	experienceReviewMaxToolCalls       = 20
	experienceReviewMaxQuestionChars   = 4000
	experienceReviewMaxAnswerChars     = 4000
	experienceReviewMaxReasonChars     = 1200
	experienceReviewMaxArgumentChars   = 1500
	experienceReviewMaxToolResultChars = 1800
	experienceReviewMaxRefChars        = 12000
)

var experienceReviewSkillNameRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$`)

// ExperienceReviewRequest is the complete, public task summary handed to the
// background reviewer. It intentionally carries tool traces and summaries, not
// a private chain of thought.
type ExperienceReviewRequest struct {
	Store             *Store
	Chat              *Chat
	Question          string
	Answer            string
	ToolCalls         []model.ToolCall
	ReasonSummary     string
	ModelProviderName string
	Lang              string
}

type experienceReviewSnapshot struct {
	StoreOwner        string
	StoreName         string
	StoreSkills       []string
	ChatName          string
	Question          string
	Answer            string
	ToolCalls         []model.ToolCall
	ReasonSummary     string
	ModelProviderName string
	Lang              string
}

type experienceReviewToolTrace struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
	Content   string `json:"content"`
}

type experienceReviewPromptPayload struct {
	StoreName     string                      `json:"storeName"`
	ChatName      string                      `json:"chatName"`
	StoreSkills   []string                    `json:"storeSkills"`
	Question      string                      `json:"question"`
	FinalAnswer   string                      `json:"finalAnswer"`
	ReasonSummary string                      `json:"reasonSummary,omitempty"`
	ToolCalls     []experienceReviewToolTrace `json:"toolCalls"`
}

type experienceReviewReference struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

type experienceReviewResult struct {
	Action      string                      `json:"action"`
	SkillName   string                      `json:"skillName"`
	DisplayName string                      `json:"displayName"`
	Description string                      `json:"description"`
	SkillMd     string                      `json:"skillMd"`
	References  []experienceReviewReference `json:"references"`
	Reason      string                      `json:"reason"`
}

type experienceReviewWritePlan struct {
	Action             string
	Skill              *Skill
	AppendSkillToStore bool
}

const experienceReviewSystemPrompt = `You are OpenAgent's background experience reviewer.

Your job is to decide whether the completed task contains durable procedural knowledge that should be saved as an OpenAgent Skill.

Save only reusable workflows, stable tool usage patterns, user corrections, verified pitfalls, selectors, checks, or recovery paths.
Do not save raw chain-of-thought, private reasoning, secrets, credentials, personal data, one-off task narratives, or transient environment failures.
Do not write permanent negative claims like "this tool is broken"; if setup failed, save only a stable fix or retry pattern.
Prefer updating an existing class-level or umbrella skill over creating narrow one-session skills.

Return exactly one valid JSON object and nothing else. No markdown fences.

Schema:
{
  "action": "none" | "create" | "update",
  "skillName": "class-level-skill-name",
  "displayName": "Human readable name",
  "description": "When this skill should be used",
  "skillMd": "---\nname: ...\ndescription: ...\n---\n\n# ...",
  "references": [{"name": "topic.md", "content": "concise supporting detail"}],
  "reason": "short private log reason"
}

For action "none", set the other fields to empty values. For create/update, skillMd must be a complete SKILL.md with front matter whose name exactly matches skillName.`

// StartExperienceReview starts a non-blocking review if the store has enabled it
// and the task trace is complex enough. Failures are logged and never affect the
// completed user-facing task.
func StartExperienceReview(req ExperienceReviewRequest) {
	snapshot, ok, err := prepareExperienceReviewSnapshot(req)
	if err != nil {
		fmt.Printf("experience review: skipped: %v\n", err)
		return
	}
	if !ok {
		return
	}

	go func() {
		if err := RunExperienceReview(snapshot); err != nil {
			fmt.Printf("experience review: %v\n", err)
		}
	}()
}

func prepareExperienceReviewSnapshot(req ExperienceReviewRequest) (experienceReviewSnapshot, bool, error) {
	if req.Store == nil {
		return experienceReviewSnapshot{}, false, errors.New("store is required")
	}
	if !shouldRunExperienceReview(req.Store, req.ToolCalls) {
		return experienceReviewSnapshot{}, false, nil
	}
	if req.Store.Owner == "" || req.Store.Name == "" {
		return experienceReviewSnapshot{}, false, errors.New("store owner and name are required")
	}
	if req.ModelProviderName == "" {
		return experienceReviewSnapshot{}, false, errors.New("model provider name is required")
	}

	snapshot := experienceReviewSnapshot{
		StoreOwner:        req.Store.Owner,
		StoreName:         req.Store.Name,
		StoreSkills:       append([]string(nil), req.Store.Skills...),
		Question:          req.Question,
		Answer:            req.Answer,
		ToolCalls:         append([]model.ToolCall(nil), req.ToolCalls...),
		ReasonSummary:     req.ReasonSummary,
		ModelProviderName: req.ModelProviderName,
		Lang:              req.Lang,
	}
	if req.Chat != nil {
		snapshot.ChatName = req.Chat.Name
	}
	return snapshot, true, nil
}

func shouldRunExperienceReview(store *Store, toolCalls []model.ToolCall) bool {
	if store == nil || !store.EnableExperienceReview || len(toolCalls) == 0 {
		return false
	}
	for _, toolCall := range toolCalls {
		if strings.Contains(strings.ToLower(toolCall.Name), "browser_use") {
			return true
		}
	}
	return len(toolCalls) >= experienceReviewMinToolCalls
}

func RunExperienceReview(snapshot experienceReviewSnapshot) error {
	if snapshot.StoreOwner == "" || snapshot.StoreName == "" {
		return errors.New("store owner and name are required")
	}
	if snapshot.ModelProviderName == "" {
		return errors.New("model provider name is required")
	}

	_, modelProviderObj, err := getExactExperienceReviewModelProvider(snapshot.ModelProviderName, snapshot.Lang)
	if err != nil {
		return fmt.Errorf("load reviewer model provider: %w", err)
	}
	if modelProviderObj == nil {
		return errors.New("reviewer model provider is nil")
	}

	payloadBytes, err := json.MarshalIndent(buildExperienceReviewPayload(snapshot), "", "  ")
	if err != nil {
		return fmt.Errorf("marshal review payload: %w", err)
	}

	question := "Review this completed OpenAgent task and decide whether to update the skill library.\n\n" + string(payloadBytes)
	var writer MyWriter
	_, err = modelProviderObj.QueryText(question, &writer, []*model.RawMessage{}, experienceReviewSystemPrompt, []*model.RawMessage{}, nil, snapshot.Lang)
	if err != nil {
		return fmt.Errorf("query reviewer model: %w", err)
	}

	result, err := parseExperienceReviewOutput(writer.String())
	if err != nil {
		return fmt.Errorf("parse reviewer output: %w", err)
	}
	if result.Action == "none" {
		if strings.TrimSpace(result.Reason) != "" {
			fmt.Printf("experience review: nothing to save: %s\n", strings.TrimSpace(result.Reason))
		}
		return nil
	}

	return applyExperienceReviewResult(snapshot, result)
}

func buildExperienceReviewPayload(snapshot experienceReviewSnapshot) experienceReviewPromptPayload {
	return experienceReviewPromptPayload{
		StoreName:     snapshot.StoreName,
		ChatName:      snapshot.ChatName,
		StoreSkills:   append([]string(nil), snapshot.StoreSkills...),
		Question:      truncateExperienceText(snapshot.Question, experienceReviewMaxQuestionChars),
		FinalAnswer:   truncateExperienceText(snapshot.Answer, experienceReviewMaxAnswerChars),
		ReasonSummary: truncateExperienceText(snapshot.ReasonSummary, experienceReviewMaxReasonChars),
		ToolCalls:     compactExperienceToolCalls(snapshot.ToolCalls),
	}
}

func compactExperienceToolCalls(toolCalls []model.ToolCall) []experienceReviewToolTrace {
	limit := len(toolCalls)
	if limit > experienceReviewMaxToolCalls {
		limit = experienceReviewMaxToolCalls
	}

	traces := make([]experienceReviewToolTrace, 0, limit)
	for i := 0; i < limit; i++ {
		toolCall := toolCalls[i]
		traces = append(traces, experienceReviewToolTrace{
			Name:      toolCall.Name,
			Arguments: truncateExperienceText(toolCall.Arguments, experienceReviewMaxArgumentChars),
			Content:   truncateExperienceText(toolCall.Content, experienceReviewMaxToolResultChars),
		})
	}
	return traces
}

func truncateExperienceText(text string, maxChars int) string {
	text = strings.TrimSpace(text)
	if maxChars <= 0 {
		return ""
	}
	runes := []rune(text)
	if len(runes) <= maxChars {
		return text
	}
	return string(runes[:maxChars]) + "\n[truncated]"
}

func parseExperienceReviewOutput(raw string) (*experienceReviewResult, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, errors.New("empty output")
	}

	var result experienceReviewResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return nil, err
	}

	result.Action = strings.TrimSpace(strings.ToLower(result.Action))
	switch result.Action {
	case "none":
		return &result, nil
	case "create", "update":
		if strings.TrimSpace(result.SkillName) == "" {
			return nil, errors.New("skillName is required")
		}
		if strings.TrimSpace(result.DisplayName) == "" {
			return nil, errors.New("displayName is required")
		}
		if strings.TrimSpace(result.SkillMd) == "" {
			return nil, errors.New("skillMd is required")
		}
		return &result, nil
	default:
		return nil, fmt.Errorf("unsupported action: %s", result.Action)
	}
}

func applyExperienceReviewResult(snapshot experienceReviewSnapshot, result *experienceReviewResult) error {
	if result == nil || result.Action == "none" {
		return nil
	}

	session := adapter.engine.NewSession()
	defer session.Close()

	if err := session.Begin(); err != nil {
		return err
	}
	committed := false
	defer func() {
		if !committed {
			_ = session.Rollback()
		}
	}()

	var existingSkill *Skill
	skillQuery := Skill{Owner: snapshot.StoreOwner, Name: result.SkillName}
	existed, err := session.Get(&skillQuery)
	if err != nil {
		return err
	}
	if existed {
		existingSkill = &skillQuery
	}

	var storeDb Store
	storeExisted, err := session.ID(core.PK{snapshot.StoreOwner, snapshot.StoreName}).Get(&storeDb)
	if err != nil {
		return err
	}
	if !storeExisted {
		return fmt.Errorf("store %s/%s not found", snapshot.StoreOwner, snapshot.StoreName)
	}

	plan, err := planExperienceReviewSkillWrite(&storeDb, result, existingSkill)
	if err != nil {
		return err
	}
	if plan == nil || plan.Action == "none" {
		if err = session.Commit(); err != nil {
			return err
		}
		committed = true
		return nil
	}

	switch plan.Action {
	case "create":
		if _, err = session.Insert(plan.Skill); err != nil {
			return err
		}
	case "update":
		if _, err = session.ID(core.PK{plan.Skill.Owner, plan.Skill.Name}).AllCols().Update(plan.Skill); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unsupported write action: %s", plan.Action)
	}

	if plan.AppendSkillToStore {
		storeDb.Skills = append(storeDb.Skills, plan.Skill.Name)
		if _, err = session.ID(core.PK{storeDb.Owner, storeDb.Name}).AllCols().Update(&storeDb); err != nil {
			return err
		}
	}

	if err = session.Commit(); err != nil {
		return err
	}
	committed = true

	fmt.Printf("experience review: %s skill %s/%s: %s\n", plan.Action, plan.Skill.Owner, plan.Skill.Name, strings.TrimSpace(result.Reason))
	return nil
}

func planExperienceReviewSkillWrite(store *Store, result *experienceReviewResult, existingSkill *Skill) (*experienceReviewWritePlan, error) {
	if result == nil || result.Action == "none" {
		return &experienceReviewWritePlan{Action: "none"}, nil
	}
	if store == nil {
		return nil, errors.New("store is required")
	}

	skill, err := buildSkillFromExperienceReview(store.Owner, result, existingSkill)
	if err != nil {
		return nil, err
	}

	switch result.Action {
	case "create":
		if existingSkill != nil {
			return nil, fmt.Errorf("skill %s/%s already exists", store.Owner, result.SkillName)
		}
		return &experienceReviewWritePlan{
			Action:             "create",
			Skill:              skill,
			AppendSkillToStore: shouldAppendSkillToStore(store.Skills, skill.Name),
		}, nil
	case "update":
		if existingSkill == nil {
			return nil, fmt.Errorf("skill %s/%s does not exist", store.Owner, result.SkillName)
		}
		return &experienceReviewWritePlan{Action: "update", Skill: skill}, nil
	default:
		return nil, fmt.Errorf("unsupported action: %s", result.Action)
	}
}

func buildSkillFromExperienceReview(owner string, result *experienceReviewResult, existingSkill *Skill) (*Skill, error) {
	if owner == "" {
		return nil, errors.New("owner is required")
	}
	if !experienceReviewSkillNameRe.MatchString(result.SkillName) {
		return nil, fmt.Errorf("invalid skillName: %s", result.SkillName)
	}

	name, description, homepage, metadata, emoji, content := parseSkillMd(result.SkillMd)
	if name == "" {
		return nil, errors.New("skillMd front matter name is required")
	}
	if name != result.SkillName {
		return nil, fmt.Errorf("skillMd name %q does not match skillName %q", name, result.SkillName)
	}
	if strings.TrimSpace(description) == "" {
		return nil, errors.New("skillMd front matter description is required")
	}
	if strings.TrimSpace(content) == "" {
		return nil, errors.New("skillMd body is required")
	}

	references := make([]SkillReference, 0, len(result.References))
	for _, ref := range result.References {
		refName := strings.TrimSpace(ref.Name)
		refContent := truncateExperienceText(ref.Content, experienceReviewMaxRefChars)
		if refName == "" || strings.Contains(refName, "/") || strings.Contains(refName, `\`) {
			return nil, fmt.Errorf("invalid reference name: %s", ref.Name)
		}
		if strings.TrimSpace(refContent) == "" {
			return nil, fmt.Errorf("reference %s content is required", refName)
		}
		references = append(references, SkillReference{
			Name:    refName,
			Content: refContent,
		})
	}

	skill := &Skill{
		Owner:       owner,
		Name:        result.SkillName,
		CreatedTime: util.GetCurrentTime(),
		DisplayName: strings.TrimSpace(result.DisplayName),
		Type:        "custom",
		Description: description,
		Homepage:    homepage,
		Emoji:       emoji,
		Metadata:    metadata,
		Content:     content,
		SkillMd:     result.SkillMd,
		References:  references,
		State:       "Active",
	}

	if existingSkill != nil {
		skill.CreatedTime = existingSkill.CreatedTime
		skill.Type = existingSkill.Type
		skill.State = existingSkill.State
	}

	return skill, nil
}

func shouldAppendSkillToStore(skills []string, skillName string) bool {
	for _, name := range skills {
		if name == "All" || name == skillName {
			return false
		}
	}
	return true
}

func getExactExperienceReviewModelProvider(providerId string, lang string) (*Provider, model.ModelProvider, error) {
	if providerId == "" {
		return nil, nil, errors.New("model provider id is required")
	}
	if _, _, err := util.GetOwnerAndNameFromIdWithError(providerId); err != nil {
		return nil, nil, fmt.Errorf("model provider id must be explicit owner/name: %w", err)
	}

	provider, err := GetProvider(providerId)
	if err != nil {
		return nil, nil, err
	}
	if provider == nil {
		return nil, nil, fmt.Errorf("model provider %s not found", providerId)
	}
	if provider.Category != "Model" {
		return nil, nil, fmt.Errorf("model provider %s must be Model category, got %s", providerId, provider.Category)
	}
	if provider.ClientSecret == "" && provider.Type != "Ollama" {
		return nil, nil, fmt.Errorf("model provider %s client secret is empty", providerId)
	}

	providerObj, err := provider.GetModelProvider(lang)
	if err != nil {
		return nil, nil, err
	}
	return provider, providerObj, nil
}
