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
	"sort"
	"strings"

	"github.com/the-open-agent/openagent/skillmd"
	"github.com/the-open-agent/openagent/util"
	"xorm.io/core"
)

// SkillReference represents a single file inside a skill's references/ directory.
type SkillReference struct {
	Name    string `json:"name"`    // filename, e.g. "get-started.md"
	Content string `json:"content"` // full file content
}

// Skill is a reusable capability definition.
//
// When loaded from a standard skill folder the fields map as follows:
//   - SkillMd     ← full raw SKILL.md text (front matter + body)
//   - Content     ← markdown body of SKILL.md (after front matter), injected into system prompt
//   - Description ← "description" field from front matter
//   - Homepage    ← "homepage" field from front matter
//   - Emoji       ← metadata.openclaw.emoji extracted from front matter
//   - Metadata    ← raw "metadata:" block text from front matter
//   - References  ← every file found in references/ directory
type Skill struct {
	Owner       string `xorm:"varchar(100) notnull pk" json:"owner"`
	Name        string `xorm:"varchar(100) notnull pk" json:"name"`
	CreatedTime string `xorm:"varchar(100)" json:"createdTime"`

	DisplayName string           `xorm:"varchar(200)" json:"displayName"`
	Type        string           `xorm:"varchar(100)" json:"type"`
	Description string           `xorm:"mediumtext" json:"description"`
	Homepage    string           `xorm:"varchar(500)" json:"homepage"`
	Emoji       string           `xorm:"varchar(50)" json:"emoji"`
	Metadata    string           `xorm:"mediumtext" json:"metadata"`
	Content     string           `xorm:"mediumtext" json:"content"`
	SkillMd     string           `xorm:"mediumtext" json:"skillMd"`
	References  []SkillReference `xorm:"mediumtext" json:"references"`

	State string `xorm:"varchar(100)" json:"state"`
}

func (s *Skill) GetId() string {
	return fmt.Sprintf("%s/%s", s.Owner, s.Name)
}

// parseSkillMd keeps the old six-value shape the callers in this package use,
// over the shared parser in skillmd.
func parseSkillMd(raw string) (name, description, homepage, metadata, emoji, body string) {
	parsed := skillmd.Parse(raw)
	return parsed.Name, parsed.Description, parsed.Homepage, parsed.Metadata, parsed.Emoji, parsed.Content
}

// LoadSkill reads {dir}/SKILL.md and all {dir}/references/* files, and returns
// a Skill struct ready to be saved with AddSkill.
func LoadSkill(dir string) (*Skill, error) {
	parsed, err := skillmd.LoadFolder(dir)
	if err != nil {
		return nil, err
	}

	references := []SkillReference{}
	for _, file := range parsed.References {
		references = append(references, SkillReference{Name: file.Name, Content: file.Content})
	}

	return &Skill{
		Name:        parsed.Name,
		DisplayName: parsed.DisplayName,
		Type:        "built-in",
		Description: parsed.Description,
		Homepage:    parsed.Homepage,
		Emoji:       parsed.Emoji,
		Metadata:    parsed.Metadata,
		Content:     parsed.Content,
		SkillMd:     parsed.SkillMd,
		References:  references,
		State:       "Active",
	}, nil
}

// ---------------------------------------------------------------------------
// Standard CRUD
// ---------------------------------------------------------------------------

func GetGlobalSkills() ([]*Skill, error) {
	skills := []*Skill{}
	err := adapter.engine.Asc("owner").Desc("created_time").Find(&skills)
	return skills, err
}

func GetSkills(owner string) ([]*Skill, error) {
	skills := []*Skill{}
	err := adapter.engine.Desc("created_time").Find(&skills, &Skill{Owner: owner})
	return skills, err
}

func getSkill(owner string, name string) (*Skill, error) {
	s := Skill{Owner: owner, Name: name}
	existed, err := adapter.engine.Get(&s)
	if err != nil {
		return &s, err
	}
	if existed {
		return &s, nil
	}
	return nil, nil
}

func GetSkill(id string) (*Skill, error) {
	owner, name, err := util.GetOwnerAndNameFromIdWithError(id)
	if err != nil {
		return nil, err
	}
	return getSkill(owner, name)
}

func GetSkillByOwnerAndName(owner string, nameOrId string) (*Skill, error) {
	if nameOrId == "" {
		return nil, nil
	}
	var id string
	if _, _, err := util.GetOwnerAndNameFromIdWithError(nameOrId); err == nil {
		id = nameOrId
	} else {
		id = util.GetIdFromOwnerAndName(owner, nameOrId)
	}
	s, err := GetSkill(id)
	if err != nil {
		return nil, err
	}
	if s != nil {
		return s, nil
	}
	if owner != "admin" && !strings.Contains(nameOrId, "/") {
		return GetSkill(util.GetIdFromOwnerAndName("admin", nameOrId))
	}
	return nil, nil
}

func GetSkillCount(owner, field, value string) (int64, error) {
	session := GetDbSession(owner, -1, -1, field, value, "", "")
	return session.Count(&Skill{})
}

func GetPaginationSkills(owner string, offset, limit int, field, value, sortField, sortOrder string) ([]*Skill, error) {
	skills := []*Skill{}
	session := GetDbSession(owner, offset, limit, field, value, sortField, sortOrder)
	err := session.Find(&skills)
	return skills, err
}

func UpdateSkill(id string, s *Skill) (bool, error) {
	owner, name, err := util.GetOwnerAndNameFromIdWithError(id)
	if err != nil {
		return false, err
	}
	skillDb, err := getSkill(owner, name)
	if err != nil {
		return false, err
	}
	if s == nil || skillDb == nil {
		return false, nil
	}

	_, err = adapter.engine.ID(core.PK{owner, name}).AllCols().Update(s)
	if err != nil {
		return false, err
	}
	return true, nil
}

func AddSkill(s *Skill) (bool, error) {
	affected, err := adapter.engine.Insert(s)
	if err != nil {
		return false, err
	}
	return affected != 0, nil
}

func addSkills(skills []*Skill) (int64, error) {
	if len(skills) == 0 {
		return 0, nil
	}
	// xorm Insert accepts a slice of pointers for batch insert.
	rows := make([]interface{}, len(skills))
	for i, s := range skills {
		rows[i] = s
	}
	return adapter.engine.Insert(rows...)
}

func DeleteSkill(s *Skill) (bool, error) {
	affected, err := adapter.engine.ID(core.PK{s.Owner, s.Name}).Delete(&Skill{})
	if err != nil {
		return false, err
	}
	return affected != 0, nil
}

func resolveEnabledSkills(owner string, skillNames []string) ([]*Skill, error) {
	if len(skillNames) == 0 {
		return nil, nil
	}

	hasAll := false
	var names []string
	for _, name := range skillNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if name == "All" {
			hasAll = true
			continue
		}
		names = append(names, name)
	}
	if hasAll {
		return GetSkills(owner)
	}

	var skills []*Skill
	seen := map[string]bool{}
	for _, name := range names {
		s, err := GetSkillByOwnerAndName(owner, name)
		if err != nil {
			return nil, err
		}
		if s == nil {
			continue
		}

		id := s.GetId()
		if seen[id] {
			continue
		}
		seen[id] = true
		skills = append(skills, s)
	}

	return skills, nil
}

func skillNameMatches(s *Skill, skillName string) bool {
	if s == nil {
		return false
	}

	skillName = strings.TrimSpace(skillName)
	if skillName == "" {
		return false
	}

	if skillName == s.Name || skillName == s.GetId() {
		return true
	}

	owner, name, err := util.GetOwnerAndNameFromIdWithError(skillName)
	return err == nil && owner == s.Owner && name == s.Name
}

func GetSkillsCatalog(owner string, skillNames []string) (string, error) {
	if len(skillNames) == 0 {
		return "", nil
	}

	skills, err := resolveEnabledSkills(owner, skillNames)
	if err != nil {
		return "", err
	}

	var items []string
	for _, s := range skills {
		if s == nil || s.State != "Active" {
			continue
		}

		parts := []string{fmt.Sprintf("- %s", s.Name)}
		if strings.TrimSpace(s.Description) != "" {
			parts = append(parts, fmt.Sprintf("description: %s", strings.TrimSpace(s.Description)))
		}
		if strings.TrimSpace(s.Type) != "" {
			parts = append(parts, fmt.Sprintf("type: %s", strings.TrimSpace(s.Type)))
		}

		refNames := make([]string, 0, len(s.References))
		for _, ref := range s.References {
			if strings.TrimSpace(ref.Name) != "" {
				refNames = append(refNames, ref.Name)
			}
		}
		sort.Strings(refNames)
		if len(refNames) > 0 {
			parts = append(parts, fmt.Sprintf("references: %s", strings.Join(refNames, ", ")))
		}

		items = append(items, strings.Join(parts, " | "))
	}

	if len(items) == 0 {
		return "", nil
	}

	return "## Skills Usage Rules\n" +
		"- If the user explicitly mentions a skill by name, you MUST call load_skill for that skill before answering.\n" +
		"- If the user's request is clearly about a listed skill's domain, you MUST load that skill before giving procedural, policy, workflow, or step-by-step guidance.\n" +
		"- Do not answer from general memory when a relevant listed skill exists but has not been loaded.\n" +
		"- If the user asks what skills are available, answer from the catalog below instead of giving a generic summary of your broad abilities.\n\n" +
		"## Skills Catalog\n" +
		"You have access to the following skills. Do not assume all details are already loaded. If a skill looks relevant, call the load_skill tool to load its full instructions before relying on it.\n\n" +
		strings.Join(items, "\n"), nil
}

func LoadSkillPromptContent(owner string, skillName string, referenceName string) (string, error) {
	s, err := GetSkillByOwnerAndName(owner, skillName)
	if err != nil {
		return "", err
	}
	if s == nil {
		return "", fmt.Errorf("skill not found: %s", skillName)
	}
	if s.State != "Active" {
		return "", fmt.Errorf("skill is not active: %s", skillName)
	}

	buf := strings.TrimSpace(s.Content)
	if referenceName == "" {
		if len(s.References) > 0 {
			refNames := make([]string, 0, len(s.References))
			for _, ref := range s.References {
				if strings.TrimSpace(ref.Name) != "" {
					refNames = append(refNames, ref.Name)
				}
			}
			sort.Strings(refNames)
			if len(refNames) > 0 {
				buf += "\n\n## Available References\n"
				for _, name := range refNames {
					buf += "- " + name + "\n"
				}
			}
		}
		return strings.TrimSpace(buf), nil
	}

	for _, ref := range s.References {
		if ref.Name == referenceName {
			if strings.TrimSpace(ref.Content) == "" {
				return "", fmt.Errorf("reference is empty: %s", referenceName)
			}
			if buf != "" {
				buf += "\n\n"
			}
			buf += "## Reference: " + ref.Name + "\n\n" + strings.TrimSpace(ref.Content)
			return strings.TrimSpace(buf), nil
		}
	}

	return "", fmt.Errorf("reference not found: %s", referenceName)
}

type skillLoader struct{}

func (skillLoader) Load(owner string, allowedSkillNames []string, skillName string, referenceName string) (string, error) {
	if len(allowedSkillNames) > 0 {
		skills, err := resolveEnabledSkills(owner, allowedSkillNames)
		if err != nil {
			return "", err
		}

		allowed := false
		for _, s := range skills {
			if skillNameMatches(s, skillName) {
				allowed = true
				break
			}
		}
		if !allowed {
			return "", fmt.Errorf("skill is not enabled for this store: %s", skillName)
		}
	}
	return LoadSkillPromptContent(owner, skillName, referenceName)
}
