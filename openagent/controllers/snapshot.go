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
	"strings"

	"github.com/beego/beego/utils/pagination"
	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
)

// GetSnapshots
// @Title GetSnapshots
// @Tag Snapshot API
// @Description get snapshots
// @Success 200 {array} object.Snapshot The Response object
// @router /get-snapshots [get]
func (c *ApiController) GetSnapshots() {
	// Snapshots hold the contents of host files changed by local tools, and rolling one back
	// writes to the host, so they belong to the global admin only.
	if !c.RequireGlobalAdmin() {
		return
	}

	owner := strings.TrimSpace(c.Input().Get("owner"))
	if owner == "" {
		c.ResponseError("owner is required")
		return
	}
	limit := c.Input().Get("pageSize")
	page := c.Input().Get("p")
	field := c.Input().Get("field")
	value := c.Input().Get("value")
	sortField := c.Input().Get("sortField")
	sortOrder := c.Input().Get("sortOrder")

	if limit == "" || page == "" {
		snapshots, err := object.GetSnapshots(owner)
		if err != nil {
			c.ResponseError(err.Error())
			return
		}
		c.ResponseOk(snapshots)
		return
	}

	limitInt := util.ParseInt(limit)
	count, err := object.GetSnapshotCount(owner, field, value)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	paginator := pagination.SetPaginator(c.Ctx, limitInt, count)
	snapshots, err := object.GetPaginationSnapshots(owner, paginator.Offset(), limitInt, field, value, sortField, sortOrder)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	c.ResponseOk(snapshots, paginator.Nums())
}

// GetSnapshot
// @Title GetSnapshot
// @Tag Snapshot API
// @Description get snapshot
// @Param id query string true "The id of snapshot"
// @Success 200 {object} object.Snapshot The Response object
// @router /get-snapshot [get]
func (c *ApiController) GetSnapshot() {
	if !c.RequireGlobalAdmin() {
		return
	}

	id := c.Input().Get("id")
	snapshot, err := object.GetSnapshot(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	c.ResponseOk(snapshot)
}

// RollbackSnapshot
// @Title RollbackSnapshot
// @Tag Snapshot API
// @Description rollback snapshot
// @Param id query string true "The id of snapshot"
// @Success 200 {object} controllers.Response The Response object
// @router /rollback-snapshot [post]
func (c *ApiController) RollbackSnapshot() {
	if !c.RequireGlobalAdmin() {
		return
	}

	id := c.Input().Get("id")
	success, err := object.RollbackSnapshot(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	c.ResponseOk(success)
}
