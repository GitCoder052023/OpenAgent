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

// The Migration entity: one row per completed run, which is what makes a
// migration listable in the history tab and undoable afterwards.

package object

import (
	"fmt"

	"github.com/the-open-agent/openagent/migration"
	"github.com/the-open-agent/openagent/util"
	"xorm.io/core"
)

// Migration records one completed run so it can be listed and undone.
type Migration struct {
	Owner       string `xorm:"varchar(100) notnull pk" json:"owner"`
	Name        string `xorm:"varchar(100) notnull pk" json:"name"`
	CreatedTime string `xorm:"varchar(100)" json:"createdTime"`

	Source        string                     `xorm:"varchar(100)" json:"source"`
	SourceVersion string                     `xorm:"varchar(100)" json:"sourceVersion"`
	SourcePath    string                     `xorm:"varchar(500)" json:"sourcePath"`
	Status        string                     `xorm:"varchar(100)" json:"status"`
	StartedTime   string                     `xorm:"varchar(100)" json:"startedTime"`
	EndedTime     string                     `xorm:"varchar(100)" json:"endedTime"`
	ErrorText     string                     `xorm:"mediumtext" json:"errorText"`
	Items         []*migration.Item          `xorm:"mediumtext" json:"items"`
	Warnings      []*migration.BundleWarning `xorm:"mediumtext" json:"warnings"`
	// IsRolledBack marks a run whose created entities have been deleted again.
	IsRolledBack bool `json:"isRolledBack"`
}

func (record *Migration) GetId() string {
	return fmt.Sprintf("%s/%s", record.Owner, record.Name)
}

// saveMigrationRecord persists a finished run. A failure here must not fail the
// migration itself -- the entities are already written -- so it is only logged.
func saveMigrationRecord(progress *migration.Progress, plan *migration.Plan) {
	record := &Migration{
		Owner:         progress.Owner,
		Name:          progress.Id,
		CreatedTime:   progress.StartedTime,
		Source:        progress.Source,
		SourceVersion: progress.SourceVersion,
		SourcePath:    plan.SourcePath,
		Status:        progress.Status,
		StartedTime:   progress.StartedTime,
		EndedTime:     progress.EndedTime,
		ErrorText:     progress.ErrorText,
		Items:         progress.Applied,
		Warnings:      progress.Warnings,
	}
	if _, err := adapter.engine.Insert(record); err != nil {
		fmt.Printf("saveMigrationRecord() error: %s\n", err.Error())
	}
}

// GetMigrations lists past runs, newest first.
func GetMigrations(owner string) ([]*Migration, error) {
	migrations := []*Migration{}
	var err error
	if owner != "" {
		err = adapter.engine.Desc("created_time").Where("owner = ?", owner).Find(&migrations)
	} else {
		err = adapter.engine.Desc("created_time").Find(&migrations)
	}
	return migrations, err
}

func getMigration(owner string, name string) (*Migration, error) {
	migration := Migration{Owner: owner, Name: name}
	existed, err := adapter.engine.Get(&migration)
	if err != nil {
		return nil, err
	}
	if existed {
		return &migration, nil
	}
	return nil, nil
}

// GetMigration loads one run by "owner/name" id.
func GetMigration(id string) (*Migration, error) {
	owner, name, err := util.GetOwnerAndNameFromIdWithError(id)
	if err != nil {
		return nil, err
	}
	return getMigration(owner, name)
}

// RollbackMigration deletes the entities a run created. Overwritten entities
// cannot be restored -- the previous content is gone -- so they are reported
// back to the caller instead of being touched.
func RollbackMigration(id string) ([]string, error) {
	record, err := GetMigration(id)
	if err != nil {
		return nil, err
	}
	if record == nil {
		return nil, fmt.Errorf("the migration: %s is not found", id)
	}
	if record.IsRolledBack {
		return nil, fmt.Errorf("the migration: %s has already been rolled back", id)
	}

	notes := []string{}
	owner := record.Owner

	// Reverse order, so agents go before the providers and skills they reference.
	items := make([]*migration.Item, 0, len(record.Items))
	for i := len(record.Items) - 1; i >= 0; i-- {
		items = append(items, record.Items[i])
	}

	for _, item := range items {
		if item.Action == migration.ActionOverwrite {
			notes = append(notes, fmt.Sprintf("%s %q was overwritten and cannot be restored", item.Category, item.TargetName))
			continue
		}
		if item.Action != migration.ActionCreate {
			continue
		}

		var deleteErr error
		switch item.Category {
		case migration.CategorySkill:
			_, deleteErr = DeleteSkill(&Skill{Owner: owner, Name: item.TargetName})
		case migration.CategoryProvider:
			_, deleteErr = DeleteProvider(&Provider{Owner: owner, Name: item.TargetName})
		case migration.CategoryServer:
			_, deleteErr = DeleteServer(&Server{Owner: owner, Name: item.TargetName})
		case migration.CategoryAgent:
			_, deleteErr = DeleteStore(&Store{Owner: owner, Name: item.TargetName})
		case migration.CategoryChat:
			_, deleteErr = DeleteMessagesByChat(&Message{Owner: owner, Chat: item.TargetName})
			if deleteErr == nil {
				_, deleteErr = DeleteChat(&Chat{Owner: owner, Name: item.TargetName})
			}
		}
		if deleteErr != nil {
			notes = append(notes, fmt.Sprintf("%s %q: %s", item.Category, item.TargetName, deleteErr.Error()))
		}
	}

	record.IsRolledBack = true
	if _, err = adapter.engine.ID(core.PK{record.Owner, record.Name}).Cols("is_rolled_back").Update(record); err != nil {
		return notes, err
	}
	return notes, nil
}
