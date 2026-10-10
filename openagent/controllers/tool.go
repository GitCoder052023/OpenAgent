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

	"github.com/beego/beego/utils/pagination"
	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
)

// requireHighRiskToolPermission blocks store-level admins from tools that execute commands,
// touch the local file system or drive the local desktop/browser.
func (c *ApiController) requireHighRiskToolPermission(tools ...*object.Tool) bool {
	for _, t := range tools {
		if t != nil && object.IsToolTypeDisabled(t.Type) {
			c.ResponseError(fmt.Sprintf(c.T("controllers:The tool type: %s is disabled on this server"), t.Type))
			return false
		}
	}
	if c.IsGlobalAdmin() {
		return true
	}
	for _, t := range tools {
		if t != nil && object.IsHighRiskToolType(t.Type) {
			c.ResponseError(c.T("controllers:Only the global admin can configure tools or MCP servers that run commands on the host"))
			return false
		}
	}
	return true
}

// GetGlobalTools
// @Title GetGlobalTools
// @Tag Tool API
// @Description get global tools
// @Success 200 {array} object.Tool The Response object
// @router /get-global-tools [get]
func (c *ApiController) GetGlobalTools() {
	user := c.GetSessionUser()
	tools, err := object.GetGlobalTools()
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(object.GetMaskedTools(tools, true, user))
}

// GetTools
// @Title GetTools
// @Tag Tool API
// @Description get tools
// @Success 200 {array} object.Tool The Response object
// @router /get-tools [get]
func (c *ApiController) GetTools() {
	owner := "admin"
	limit := c.Input().Get("pageSize")
	page := c.Input().Get("p")
	field := c.Input().Get("field")
	value := c.Input().Get("value")
	sortField := c.Input().Get("sortField")
	sortOrder := c.Input().Get("sortOrder")
	user := c.GetSessionUser()

	if limit == "" || page == "" {
		tools, err := object.GetTools(owner)
		if err != nil {
			c.ResponseError(err.Error())
			return
		}
		c.ResponseOk(object.GetMaskedTools(tools, true, user))
	} else {
		if !c.RequireAdmin() {
			return
		}
		limit := util.ParseInt(limit)
		count, err := object.GetToolCount(owner, field, value)
		if err != nil {
			c.ResponseError(err.Error())
			return
		}

		paginator := pagination.SetPaginator(c.Ctx, limit, count)
		tools, err := object.GetPaginationTools(owner, paginator.Offset(), limit, field, value, sortField, sortOrder)
		if err != nil {
			c.ResponseError(err.Error())
			return
		}

		c.ResponseOk(object.GetMaskedTools(tools, true, user), paginator.Nums())
	}
}

// GetTool
// @Title GetTool
// @Tag Tool API
// @Description get tool
// @Param id query string true "The id of tool"
// @Success 200 {object} object.Tool The Response object
// @router /get-tool [get]
func (c *ApiController) GetTool() {
	id := c.Input().Get("id")
	user := c.GetSessionUser()

	t, err := object.GetTool(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(object.GetMaskedTool(t, true, user))
}

// UpdateTool
// @Title UpdateTool
// @Tag Tool API
// @Description update tool
// @Param id query string true "The id (owner/name) of the tool"
// @Param body body object.Tool true "The details of the tool"
// @Success 200 {object} controllers.Response The Response object
// @router /update-tool [post]
func (c *ApiController) UpdateTool() {
	id := c.Input().Get("id")

	var t object.Tool
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &t)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	oldTool, err := object.GetTool(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if !c.requireHighRiskToolPermission(&t, oldTool) {
		return
	}
	if !c.requireSecretNotRedirected(t.KeepsMaskedSecretWithNewEndpoint(oldTool)) {
		return
	}

	success, err := object.UpdateTool(id, &t)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// AddTool
// @Title AddTool
// @Tag Tool API
// @Description add tool
// @Param body body object.Tool true "The details of the tool"
// @Success 200 {object} controllers.Response The Response object
// @router /add-tool [post]
func (c *ApiController) AddTool() {
	var t object.Tool
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &t)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	if !c.requireHighRiskToolPermission(&t) {
		return
	}

	t.Owner = "admin"
	success, err := object.AddTool(&t)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// DeleteTool
// @Title DeleteTool
// @Tag Tool API
// @Description delete tool
// @Param body body object.Tool true "The details of the tool"
// @Success 200 {object} controllers.Response The Response object
// @router /delete-tool [post]
func (c *ApiController) DeleteTool() {
	var t object.Tool
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &t)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	success, err := object.DeleteTool(&t)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// TestTool
// @Title TestTool
// @Tag Tool API
// @Description invoke a single builtin tool using tool configuration
// @Param body body object.Tool true "Tool with testContent JSON: {\"tool\":\"toolName\",\"arguments\":{}}"
// @Success 200 {object} controllers.Response The Response object; data is the tool result string
// @router /test-tool [post]
func (c *ApiController) TestTool() {
	var t object.Tool
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &t)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	if !c.requireHighRiskToolPermission(&t) {
		return
	}
	oldTool, err := object.GetTool(t.GetId())
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if !c.requireSecretNotRedirected(t.KeepsMaskedSecretWithNewEndpoint(oldTool)) {
		return
	}

	result, err := object.TestTool(&t, c.GetSessionUsername(), c.GetAcceptLanguage())
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(result)
}
