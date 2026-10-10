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
	"fmt"
	"strings"
	"unicode"

	"github.com/beego/beego/logs"
	"github.com/the-open-agent/openagent/embedding"
	"github.com/the-open-agent/openagent/util"
	"xorm.io/core"
)

const (
	ExperienceStateDraft    = "Draft"
	ExperienceStateActive   = "Active"
	ExperienceStateArchived = "Archived"
)

const (
	// ExperienceCategoryFact marks a factual correction: the answer's content was wrong.
	ExperienceCategoryFact = "Fact"
	// ExperienceCategoryStyle marks a tone / wording / stance correction.
	ExperienceCategoryStyle = "Style"
	// ExperienceCategoryFormat marks a layout correction (tables, lists, length).
	ExperienceCategoryFormat = "Format"
	// ExperienceCategoryScope marks a correction about what the agent should or should not answer.
	ExperienceCategoryScope = "Scope"
)

const (
	experienceDefaultCount     = 3
	experienceDefaultThreshold = 0.75
	// experienceExactThreshold is the similarity above which a stored correction is
	// treated as the approved answer for the current question instead of a mere example.
	experienceExactThreshold   = 0.95
	experienceMaxGlobalRules   = 20
	experienceMaxQuestionChars = 1000
	experienceMaxAnswerChars   = 2000
	experienceMaxReasonChars   = 500
	experienceMaxRuleChars     = 500
	experienceMaxCatalogChars  = 12000
)

// Experience is one entry of the human-curated experience library ("错题本"): a
// single answer that a person rewrote, kept together with the question and the
// original wrong answer so later generations can learn from the correction.
type Experience struct {
	Owner       string `xorm:"varchar(100) notnull pk" json:"owner"`
	Name        string `xorm:"varchar(100) notnull pk" json:"name"`
	CreatedTime string `xorm:"varchar(100)" json:"createdTime"`
	UpdatedTime string `xorm:"varchar(100)" json:"updatedTime"`

	Store   string `xorm:"varchar(100) index" json:"store"`
	Chat    string `xorm:"varchar(100) index" json:"chat"`
	Message string `xorm:"varchar(100) index" json:"message"`
	User    string `xorm:"varchar(100) index" json:"user"`

	Question      string `xorm:"mediumtext" json:"question"`
	OriginalText  string `xorm:"mediumtext" json:"originalText"`
	CorrectedText string `xorm:"mediumtext" json:"correctedText"`
	Reason        string `xorm:"mediumtext" json:"reason"`
	Category      string `xorm:"varchar(100)" json:"category"`
	Rule          string `xorm:"mediumtext" json:"rule"`
	IsGlobalRule  bool   `json:"isGlobalRule"`

	Provider  string    `xorm:"varchar(100) index" json:"provider"`
	Data      []float32 `xorm:"mediumtext" json:"data"`
	Dimension int       `json:"dimension"`

	HitCount int    `json:"hitCount"`
	State    string `xorm:"varchar(100)" json:"state"`

	Score float32 `xorm:"-" json:"score"`
}

func (experience *Experience) GetId() string {
	return fmt.Sprintf("%s/%s", experience.Owner, experience.Name)
}

// GetMaskedExperience drops the question embedding before an experience leaves the
// server. It is large, and it is only ever used for server-side similarity search.
func GetMaskedExperience(experience *Experience) *Experience {
	if experience == nil {
		return nil
	}
	experience.Data = nil
	return experience
}

func GetMaskedExperiences(experiences []*Experience) []*Experience {
	for _, experience := range experiences {
		GetMaskedExperience(experience)
	}
	return experiences
}

func GetGlobalExperiences() ([]*Experience, error) {
	experiences := []*Experience{}
	err := adapter.engine.Asc("owner").Desc("created_time").Find(&experiences)
	return experiences, err
}

func GetExperiences(owner string) ([]*Experience, error) {
	experiences := []*Experience{}
	err := adapter.engine.Desc("created_time").Find(&experiences, &Experience{Owner: owner})
	return experiences, err
}

func GetExperienceCount(owner string, storeName string, field string, value string) (int64, error) {
	session := GetDbSession(owner, -1, -1, field, value, "", "")
	if storeName != "" {
		session = session.And("store=?", storeName)
	}
	return session.Count(&Experience{})
}

func GetPaginationExperiences(owner string, storeName string, offset int, limit int, field string, value string, sortField string, sortOrder string) ([]*Experience, error) {
	experiences := []*Experience{}
	session := GetDbSession(owner, offset, limit, field, value, sortField, sortOrder)
	if storeName != "" {
		session = session.And("store=?", storeName)
	}
	err := session.Find(&experiences)
	return experiences, err
}

func getExperience(owner string, name string) (*Experience, error) {
	experience := Experience{Owner: owner, Name: name}
	existed, err := adapter.engine.Get(&experience)
	if err != nil {
		return nil, err
	}
	if !existed {
		return nil, nil
	}
	return &experience, nil
}

func GetExperience(id string) (*Experience, error) {
	owner, name, err := util.GetOwnerAndNameFromIdWithError(id)
	if err != nil {
		return nil, err
	}
	return getExperience(owner, name)
}

// GetExperienceByMessage returns the correction attached to an AI message, if any.
func GetExperienceByMessage(owner string, messageName string) (*Experience, error) {
	if messageName == "" {
		return nil, nil
	}

	experience := Experience{}
	existed, err := adapter.engine.Where("owner=? and message=?", owner, messageName).Desc("created_time").Get(&experience)
	if err != nil {
		return nil, err
	}
	if !existed {
		return nil, nil
	}
	return &experience, nil
}

func AddExperience(experience *Experience) (bool, error) {
	if experience.Name == "" {
		experience.Name = util.GetRandomString(24)
	}
	now := util.GetCurrentTimeWithMilli()
	if experience.CreatedTime == "" {
		experience.CreatedTime = now
	}
	experience.UpdatedTime = now
	if experience.State == "" {
		experience.State = ExperienceStateDraft
	}

	affected, err := adapter.engine.Insert(experience)
	if err != nil {
		return false, err
	}
	return affected != 0, nil
}

func UpdateExperience(id string, experience *Experience) (bool, error) {
	owner, name, err := util.GetOwnerAndNameFromIdWithError(id)
	if err != nil {
		return false, err
	}

	experienceDb, err := getExperience(owner, name)
	if err != nil {
		return false, err
	}
	if experience == nil || experienceDb == nil {
		return false, nil
	}

	experience.Owner = owner
	experience.Name = name
	experience.CreatedTime = experienceDb.CreatedTime
	experience.UpdatedTime = util.GetCurrentTimeWithMilli()
	// The vector belongs to the question; keep the stored one unless the question changed.
	if experience.Question == experienceDb.Question && len(experience.Data) == 0 {
		experience.Data = experienceDb.Data
		experience.Dimension = experienceDb.Dimension
		experience.Provider = experienceDb.Provider
	}

	_, err = adapter.engine.ID(core.PK{owner, name}).AllCols().Update(experience)
	if err != nil {
		return false, err
	}
	return true, nil
}

func DeleteExperience(experience *Experience) (bool, error) {
	affected, err := adapter.engine.ID(core.PK{experience.Owner, experience.Name}).Delete(&Experience{})
	if err != nil {
		return false, err
	}
	return affected != 0, nil
}

// IncreaseExperienceHitCounts records that the given experiences were injected into a
// generation. It is best-effort telemetry, never worth failing a chat answer over.
func IncreaseExperienceHitCounts(owner string, names []string) {
	if len(names) == 0 {
		return
	}

	_, err := adapter.engine.Where("owner=?", owner).In("name", names).Incr("hit_count").Update(new(Experience))
	if err != nil {
		logs.Warn("IncreaseExperienceHitCounts() error: %s", err.Error())
	}
}

// FillExperienceEmbedding computes the question vector so the experience can later be
// retrieved by similarity. A missing embedding provider is not fatal: the experience is
// still stored, and still works if it is promoted to a global rule.
func FillExperienceEmbedding(experience *Experience, lang string) error {
	if experience == nil || strings.TrimSpace(experience.Question) == "" {
		return nil
	}

	embeddingProviderName := ""
	if experience.Store != "" {
		store, err := GetStore(util.GetId(experience.Owner, experience.Store))
		if err != nil {
			return err
		}
		if store != nil {
			embeddingProviderName = store.EmbeddingProvider
		}
	}

	embeddingProvider, embeddingProviderObj, err := GetEmbeddingProviderFromContext(experience.Owner, embeddingProviderName, lang)
	if err != nil {
		return err
	}

	data, _, err := queryVectorSafe(embeddingProviderObj, experience.Question, embeddingProvider.Name, lang)
	if err != nil {
		return err
	}

	experience.Provider = embeddingProvider.Name
	experience.Data = data
	experience.Dimension = len(data)
	return nil
}

func getActiveExperiences(owner string, storeNames []string, provider string) ([]*Experience, error) {
	experiences := []*Experience{}
	session := adapter.engine.Where("owner=?", owner).And("state=?", ExperienceStateActive)
	if len(storeNames) > 0 {
		session = session.In("store", storeNames)
	}
	if provider != "" {
		session = session.And("provider=?", provider)
	}
	err := session.Find(&experiences)
	return experiences, err
}

func getGlobalRuleExperiences(owner string, storeNames []string) ([]*Experience, error) {
	experiences := []*Experience{}
	err := adapter.engine.Where("owner=?", owner).And("state=?", ExperienceStateActive).And("is_global_rule=?", true).
		In("store", storeNames).Asc("created_time").Limit(experienceMaxGlobalRules).Find(&experiences)
	return experiences, err
}

// GetNearestExperiences returns the corrections whose original question is closest to the
// current one, ordered by descending similarity and filtered by threshold.
func GetNearestExperiences(owner string, storeNames []string, embeddingProvider *Provider, embeddingProviderObj embedding.EmbeddingProvider, question string, count int, threshold float32, lang string) ([]*Experience, error) {
	if count <= 0 || embeddingProvider == nil || embeddingProviderObj == nil || strings.TrimSpace(question) == "" {
		return nil, nil
	}

	candidates, err := getActiveExperiences(owner, storeNames, embeddingProvider.Name)
	if err != nil {
		return nil, err
	}

	matchable := []*Experience{}
	vectorData := [][]float32{}
	for _, candidate := range candidates {
		// Global rules are injected unconditionally, so they must not also take a
		// similarity slot away from question-specific corrections.
		if candidate.IsGlobalRule || len(candidate.Data) == 0 {
			continue
		}
		matchable = append(matchable, candidate)
		vectorData = append(vectorData, candidate.Data)
	}
	if len(matchable) == 0 {
		return nil, nil
	}

	qVector, _, err := queryVectorSafe(embeddingProviderObj, question, embeddingProvider.Name, lang)
	if err != nil {
		return nil, err
	}
	if len(qVector) == 0 {
		return nil, fmt.Errorf("no qVector found")
	}

	similarities, err := getNearestVectors(qVector, vectorData, count)
	if err != nil {
		return nil, err
	}

	res := []*Experience{}
	for _, similarity := range similarities {
		if similarity.Similarity < threshold {
			continue
		}
		experience := matchable[similarity.Index]
		experience.Score = similarity.Similarity
		res = append(res, experience)
	}
	return res, nil
}

// GetExperienceCatalog builds the prompt block for the experience library and returns it
// together with the names of the experiences it used, so hit counts can be recorded.
func GetExperienceCatalog(store *Store, question string, embeddingProvider *Provider, embeddingProviderObj embedding.EmbeddingProvider, lang string) (string, []string, error) {
	if store == nil || !store.EnableExperienceLibrary {
		return "", nil, nil
	}

	storeNames := make([]string, 0, len(store.VectorStores)+1)
	storeNames = append(storeNames, store.VectorStores...)
	storeNames = append(storeNames, store.Name)

	rules, err := getGlobalRuleExperiences(store.Owner, storeNames)
	if err != nil {
		return "", nil, err
	}

	count := store.ExperienceCount
	if count == 0 {
		count = experienceDefaultCount
	}
	threshold := float32(store.ExperienceThreshold)
	if threshold <= 0 {
		threshold = experienceDefaultThreshold
	}

	matches, err := GetNearestExperiences(store.Owner, storeNames, embeddingProvider, embeddingProviderObj, question, count, threshold, lang)
	if err != nil {
		// A failed similarity lookup must not drop the standing rules too.
		logs.Warn("GetNearestExperiences() error: %s", err.Error())
	}

	if len(rules) == 0 && len(matches) == 0 {
		return "", nil, nil
	}

	names := make([]string, 0, len(rules)+len(matches))
	for _, rule := range rules {
		names = append(names, rule.Name)
	}
	for _, match := range matches {
		names = append(names, match.Name)
	}

	return buildExperienceCatalog(rules, matches, containsChinese(question) || containsChinese(store.Prompt)), names, nil
}

func buildExperienceCatalog(rules []*Experience, matches []*Experience, useZh bool) string {
	var sb strings.Builder

	if useZh {
		sb.WriteString("## 人工校准经验库\n")
		sb.WriteString("以下内容来自人工对本智能体历史回答的修正。请遵循这些修正；当它们与上文知识冲突时，以这些修正为准。\n")
	} else {
		sb.WriteString("## Calibrated experience library\n")
		sb.WriteString("The following corrections were written by human reviewers on this agent's previous answers. Follow them; when they conflict with the knowledge above, the corrections win.\n")
	}

	if len(rules) > 0 {
		if useZh {
			sb.WriteString("\n### 长期规则\n")
		} else {
			sb.WriteString("\n### Standing rules\n")
		}
		for i, rule := range rules {
			text := strings.TrimSpace(rule.Rule)
			if text == "" {
				text = strings.TrimSpace(rule.CorrectedText)
			}
			text = truncateExperienceText(text, experienceMaxRuleChars)
			if text == "" {
				continue
			}
			if rule.Category != "" {
				sb.WriteString(fmt.Sprintf("%d. [%s] %s\n", i+1, rule.Category, text))
			} else {
				sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, text))
			}
		}
	}

	for _, match := range matches {
		sb.WriteString("\n")
		if match.Score >= experienceExactThreshold {
			writeExactExperience(&sb, match, useZh)
		} else {
			writeExampleExperience(&sb, match, useZh)
		}
	}

	res := sb.String()
	if len([]rune(res)) > experienceMaxCatalogChars {
		res = truncateExperienceText(res, experienceMaxCatalogChars)
	}
	return res
}

func writeExactExperience(sb *strings.Builder, experience *Experience, useZh bool) {
	question := truncateExperienceText(experience.Question, experienceMaxQuestionChars)
	answer := truncateExperienceText(experience.CorrectedText, experienceMaxAnswerChars)

	if useZh {
		sb.WriteString(fmt.Sprintf("### 已确认答案（相似度 %.2f）\n", experience.Score))
		sb.WriteString(fmt.Sprintf("历史问题：%s\n", question))
		sb.WriteString(fmt.Sprintf("人工确认的答案：\n%s\n", answer))
		sb.WriteString("当前问题与之几乎相同，请直接复用上面这个答案，只在当前问题确实不同的细节处做调整。\n")
	} else {
		sb.WriteString(fmt.Sprintf("### Approved answer (similarity %.2f)\n", experience.Score))
		sb.WriteString(fmt.Sprintf("Earlier question: %s\n", question))
		sb.WriteString(fmt.Sprintf("Human-approved answer:\n%s\n", answer))
		sb.WriteString("The current question is nearly the same, so reuse the approved answer and only adapt the details the current question actually changes.\n")
	}
}

func writeExampleExperience(sb *strings.Builder, experience *Experience, useZh bool) {
	question := truncateExperienceText(experience.Question, experienceMaxQuestionChars)
	original := truncateExperienceText(experience.OriginalText, experienceMaxAnswerChars)
	corrected := truncateExperienceText(experience.CorrectedText, experienceMaxAnswerChars)
	reason := truncateExperienceText(experience.Reason, experienceMaxReasonChars)

	if useZh {
		sb.WriteString(fmt.Sprintf("### 同类问题的修正示例（相似度 %.2f）\n", experience.Score))
		sb.WriteString(fmt.Sprintf("历史问题：%s\n", question))
		if original != "" {
			sb.WriteString(fmt.Sprintf("被否决的回答：%s\n", original))
		}
		sb.WriteString(fmt.Sprintf("人工修正后的回答：%s\n", corrected))
		if reason != "" {
			sb.WriteString(fmt.Sprintf("修正原因：%s\n", reason))
		}
		sb.WriteString("请沿用修正后回答的口径、措辞与格式，不要重犯被否决回答里的问题。\n")
	} else {
		sb.WriteString(fmt.Sprintf("### Corrected example for a similar question (similarity %.2f)\n", experience.Score))
		sb.WriteString(fmt.Sprintf("Earlier question: %s\n", question))
		if original != "" {
			sb.WriteString(fmt.Sprintf("Rejected answer: %s\n", original))
		}
		sb.WriteString(fmt.Sprintf("Human-corrected answer: %s\n", corrected))
		if reason != "" {
			sb.WriteString(fmt.Sprintf("Why it was corrected: %s\n", reason))
		}
		sb.WriteString("Match the stance, wording and format of the corrected answer, and do not repeat the problem in the rejected one.\n")
	}
}

func containsChinese(text string) bool {
	for _, r := range text {
		if unicode.Is(unicode.Han, r) {
			return true
		}
	}
	return false
}
