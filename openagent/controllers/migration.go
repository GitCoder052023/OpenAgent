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

package controllers

import (
	"encoding/json"
	"fmt"
	"io"

	"github.com/the-open-agent/openagent/migration"
	"github.com/the-open-agent/openagent/object"
)

// migrationOwner is the owner every imported entity is written under. It
// matches the convention used by the rest of the admin APIs.
const migrationOwner = "admin"

// MigrationRequest is the body of the preview and start APIs: a ticket for an
// already-extracted bundle plus the options to apply it under.
type MigrationRequest struct {
	BundleId string             `json:"bundleId"`
	Options  *migration.Options `json:"options"`
}

// MigrationPreview is what the wizard needs after an extract: the ticket for
// the parked bundle plus the dry-run plan it produced.
type MigrationPreview struct {
	BundleId string          `json:"bundleId"`
	Plan     *migration.Plan `json:"plan"`
}

// GetMigrationSources
// @Title GetMigrationSources
// @Tag Migration API
// @Description get the list of agent installations that can be migrated from
// @Success 200 {array} migration.Source The Response object
// @router /get-migration-sources [get]
func (c *ApiController) GetMigrationSources() {
	if !c.RequireGlobalAdmin() {
		return
	}

	c.ResponseOk(migration.GetSources())
}

// UploadMigrationFile
// @Title UploadMigrationFile
// @Tag Migration API
// @Description upload a third-party agent config or archive, extract it and return a dry-run plan
// @Param file formData file false "The config file or .zip archive to import"
// @Param source formData string false "Migration source id, empty means auto-detect"
// @Param path formData string false "Server-side directory to scan, used when no file is uploaded"
// @Success 200 {object} controllers.MigrationPreview The Response object
// @router /upload-migration-file [post]
func (c *ApiController) UploadMigrationFile() {
	if !c.RequireGlobalAdmin() {
		return
	}

	sourceId := c.GetString("source")
	in := &migration.Input{
		Owner: migrationOwner,
		Path:  c.GetString("path"),
	}

	file, header, err := c.GetFile("file")
	if err == nil && file != nil {
		defer file.Close()

		data, readErr := io.ReadAll(file)
		if readErr != nil {
			c.ResponseError(readErr.Error())
			return
		}
		in.FileName = header.Filename
		in.Data = data
	}

	if len(in.Data) == 0 && in.Path == "" {
		c.ResponseError(c.T("migration:Please upload a config file or fill in a directory to scan"))
		return
	}

	c.respondWithPreview(sourceId, in, nil)
}

// PreviewMigration
// @Title PreviewMigration
// @Tag Migration API
// @Description re-plan an already uploaded bundle with a different selection or conflict policy
// @Param body body controllers.MigrationRequest true "The bundle id and the options"
// @Success 200 {object} controllers.MigrationPreview The Response object
// @router /preview-migration [post]
func (c *ApiController) PreviewMigration() {
	if !c.RequireGlobalAdmin() {
		return
	}

	var request MigrationRequest
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &request)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	bundle, err := migration.GetCachedBundle(migrationOwner, request.BundleId)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	plan, err := object.BuildMigrationPlan(migrationOwner, bundle, request.Options)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(&MigrationPreview{BundleId: request.BundleId, Plan: plan})
}

// StartMigration
// @Title StartMigration
// @Tag Migration API
// @Description apply a migration in the background and return the progress handle to poll
// @Param body body controllers.MigrationRequest true "The bundle id and the options"
// @Success 200 {object} migration.Progress The Response object
// @router /start-migration [post]
func (c *ApiController) StartMigration() {
	if !c.RequireGlobalAdmin() {
		return
	}

	var request MigrationRequest
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &request)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	bundle, err := migration.GetCachedBundle(migrationOwner, request.BundleId)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	// Re-plan right before applying, so the run reflects the selection the user
	// is actually looking at and not a preview that has since gone stale.
	plan, err := object.BuildMigrationPlan(migrationOwner, bundle, request.Options)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	progress, err := object.StartMigration(migrationOwner, bundle, plan)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(progress)
}

// GetMigrationProgress
// @Title GetMigrationProgress
// @Tag Migration API
// @Description get the live state of a running or finished migration
// @Param id query string true "The progress id returned by start-migration"
// @Success 200 {object} migration.Progress The Response object
// @router /get-migration-progress [get]
func (c *ApiController) GetMigrationProgress() {
	if !c.RequireGlobalAdmin() {
		return
	}

	id := c.Input().Get("id")
	progress := migration.GetProgress(id)
	if progress == nil {
		c.ResponseError(fmt.Sprintf(c.T("migration:The migration run: %s is not found"), id))
		return
	}

	c.ResponseOk(progress)
}

// GetMigrations
// @Title GetMigrations
// @Tag Migration API
// @Description get the past migration runs
// @Success 200 {array} object.Migration The Response object
// @router /get-migrations [get]
func (c *ApiController) GetMigrations() {
	if !c.RequireGlobalAdmin() {
		return
	}

	migrations, err := object.GetMigrations(migrationOwner)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(migrations)
}

// GetMigration
// @Title GetMigration
// @Tag Migration API
// @Description get one past migration run
// @Param id query string true "The id (owner/name) of the migration"
// @Success 200 {object} object.Migration The Response object
// @router /get-migration [get]
func (c *ApiController) GetMigration() {
	if !c.RequireGlobalAdmin() {
		return
	}

	id := c.Input().Get("id")
	record, err := object.GetMigration(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(record)
}

// RollbackMigration
// @Title RollbackMigration
// @Tag Migration API
// @Description delete the entities a past migration run created
// @Param id query string true "The id (owner/name) of the migration"
// @Success 200 {array} string The Response object, notes about what could not be undone
// @router /rollback-migration [post]
func (c *ApiController) RollbackMigration() {
	if !c.RequireGlobalAdmin() {
		return
	}

	id := c.Input().Get("id")
	notes, err := object.RollbackMigration(id)
	if err != nil {
		c.ResponseError(err.Error(), notes)
		return
	}

	c.ResponseOk(notes)
}

// respondWithPreview extracts the input, parks the bundle and returns its plan.
func (c *ApiController) respondWithPreview(sourceId string, in *migration.Input, options *migration.Options) {
	bundle, err := migration.Extract(sourceId, in)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	plan, err := object.BuildMigrationPlan(migrationOwner, bundle, options)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	bundleId := migration.CacheBundle(migrationOwner, bundle)
	c.ResponseOk(&MigrationPreview{BundleId: bundleId, Plan: plan})
}
