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

	"github.com/beego/beego/utils/pagination"
	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
)

// GetGlobalSkills
// @Title GetGlobalSkills
// @Tag Skill API
// @Description get global skills
// @Success 200 {array} object.Skill The Response object
// @router /get-global-skills [get]
func (c *ApiController) GetGlobalSkills() {
	skills, err := object.GetGlobalSkills()
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(skills)
}

// GetSkills
// @Title GetSkills
// @Tag Skill API
// @Description get skills
// @Success 200 {array} object.Skill The Response object
// @router /get-skills [get]
func (c *ApiController) GetSkills() {
	owner := "admin"
	limit := c.Input().Get("pageSize")
	page := c.Input().Get("p")
	field := c.Input().Get("field")
	value := c.Input().Get("value")
	sortField := c.Input().Get("sortField")
	sortOrder := c.Input().Get("sortOrder")

	if limit == "" || page == "" {
		skills, err := object.GetSkills(owner)
		if err != nil {
			c.ResponseError(err.Error())
			return
		}
		c.ResponseOk(skills)
	} else {
		if !c.RequireAdmin() {
			return
		}
		limit := util.ParseInt(limit)
		count, err := object.GetSkillCount(owner, field, value)
		if err != nil {
			c.ResponseError(err.Error())
			return
		}

		paginator := pagination.SetPaginator(c.Ctx, limit, count)
		skills, err := object.GetPaginationSkills(owner, paginator.Offset(), limit, field, value, sortField, sortOrder)
		if err != nil {
			c.ResponseError(err.Error())
			return
		}

		c.ResponseOk(skills, paginator.Nums())
	}
}

// GetSkill
// @Title GetSkill
// @Tag Skill API
// @Description get skill
// @Param id query string true "The id of skill"
// @Success 200 {object} object.Skill The Response object
// @router /get-skill [get]
func (c *ApiController) GetSkill() {
	id := c.Input().Get("id")

	s, err := object.GetSkill(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(s)
}

// UpdateSkill
// @Title UpdateSkill
// @Tag Skill API
// @Description update skill
// @Param id query string true "The id (owner/name) of the skill"
// @Param body body object.Skill true "The details of the skill"
// @Success 200 {object} controllers.Response The Response object
// @router /update-skill [post]
func (c *ApiController) UpdateSkill() {
	id := c.Input().Get("id")

	var s object.Skill
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &s)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	success, err := object.UpdateSkill(id, &s)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// AddSkill
// @Title AddSkill
// @Tag Skill API
// @Description add skill
// @Param body body object.Skill true "The details of the skill"
// @Success 200 {object} controllers.Response The Response object
// @router /add-skill [post]
func (c *ApiController) AddSkill() {
	var s object.Skill
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &s)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	s.Owner = "admin"
	success, err := object.AddSkill(&s)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// DeleteSkill
// @Title DeleteSkill
// @Tag Skill API
// @Description delete skill
// @Param body body object.Skill true "The details of the skill"
// @Success 200 {object} controllers.Response The Response object
// @router /delete-skill [post]
func (c *ApiController) DeleteSkill() {
	var s object.Skill
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &s)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	success, err := object.DeleteSkill(&s)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// LoadSkill
// @Title LoadSkill
// @Tag Skill API
// @Description read a skill folder from the server filesystem and return a parsed Skill object (not yet saved)
// @Param path query string true "Absolute path to the skill folder containing SKILL.md"
// @Success 200 {object} object.Skill The Response object
// @router /load-skill [get]
func (c *ApiController) LoadSkill() {
	path := c.Input().Get("path")
	if path == "" {
		c.ResponseError("path is required")
		return
	}

	s, err := object.LoadSkill(path)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(s)
}
