// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
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

	"github.com/the-open-agent/openagent/auth"
	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/util"
)

// GetPermissions
// @Title GetPermissions
// @Tag Permission API
// @Description get permissions
// @Success 200 {array} auth.Permission The Response object
// @router /get-permissions [get]
func (c *ApiController) GetPermissions() {
	if !conf.IsCasdoorAvailable() {
		c.ResponseOk([]*auth.Permission{})
		return
	}

	permissions, err := auth.GetPermissions()
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(permissions)
}

// GetPermission
// @Title GetPermission
// @Tag Permission API
// @Description get permission
// @Param id query string true "The id(owner/name) of permission"
// @Success 200 {object} auth.Permission The Response object
// @router /get-permission [get]
func (c *ApiController) GetPermission() {
	if !conf.IsCasdoorAvailable() {
		c.ResponseOk(nil)
		return
	}

	id := c.Input().Get("id")
	_, name, err := util.GetOwnerAndNameFromIdWithError(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	permission, err := auth.GetPermission(name)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(permission)
}

// UpdatePermission
// @Title UpdatePermission
// @Tag Permission API
// @Description update permission
// @Param body body auth.Permission true "The details of the permission"
// @Success 200 {object} controllers.Response The Response object
// @router /update-permission [post]
func (c *ApiController) UpdatePermission() {
	// Permissions are written to Casdoor with the application's credentials, so store-level
	// admins must not manage them.
	if !c.RequireGlobalAdmin() {
		return
	}

	if !conf.IsCasdoorAvailable() {
		c.ResponseOk(true)
		return
	}

	var permission auth.Permission
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &permission)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	permission.Owner = conf.GetConfigString("casdoorOrganization")

	success, err := auth.UpdatePermission(&permission)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// AddPermission
// @Title AddPermission
// @Tag Permission API
// @Description add permission
// @Param body body auth.Permission true "The details of the permission"
// @Success 200 {object} controllers.Response The Response object
// @router /add-permission [post]
func (c *ApiController) AddPermission() {
	// Permissions are written to Casdoor with the application's credentials, so store-level
	// admins must not manage them.
	if !c.RequireGlobalAdmin() {
		return
	}

	if !conf.IsCasdoorAvailable() {
		c.ResponseOk(true)
		return
	}

	var permission auth.Permission
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &permission)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	// The application credentials reach every organization in Casdoor, so keep writes in our own.
	permission.Owner = conf.GetConfigString("casdoorOrganization")

	success, err := auth.AddPermission(&permission)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// DeletePermission
// @Title DeletePermission
// @Tag Permission API
// @Description delete permission
// @Param body body auth.Permission true "The details of the permission"
// @Success 200 {object} controllers.Response The Response object
// @router /delete-permission [post]
func (c *ApiController) DeletePermission() {
	// Permissions are written to Casdoor with the application's credentials, so store-level
	// admins must not manage them.
	if !c.RequireGlobalAdmin() {
		return
	}

	if !conf.IsCasdoorAvailable() {
		c.ResponseOk(true)
		return
	}

	var permission auth.Permission
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &permission)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	// The application credentials reach every organization in Casdoor, so keep writes in our own.
	permission.Owner = conf.GetConfigString("casdoorOrganization")

	success, err := auth.DeletePermission(&permission)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}
