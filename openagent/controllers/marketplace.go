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
	"time"

	"github.com/the-open-agent/openagent/object"
)

// GetMarketplaceSources
// @Title GetMarketplaceSources
// @Tag Marketplace API
// @Description get available marketplace sources
// @Success 200 {array} object.MarketplaceSource The Response object
// @router /get-marketplace-sources [get]
func (c *ApiController) GetMarketplaceSources() {
	c.ResponseOk(object.GetMarketplaceSources())
}

// GetMarketplaceSkills
// @Title GetMarketplaceSkills
// @Tag Marketplace API
// @Description search skills from a marketplace source
// @Param source query string false "Marketplace source ID (empty = all sources)"
// @Param keyword query string false "Search keyword"
// @Success 200 {array} object.MarketplaceSkillItem The Response object
// @router /get-marketplace-skills [get]
func (c *ApiController) GetMarketplaceSkills() {
	source := c.Input().Get("source")
	keyword := c.Input().Get("keyword")

	items, err := object.GetMarketplaceSkills(source, keyword)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(items)
}

// InstallMarketplaceSkill
// @Title InstallMarketplaceSkill
// @Tag Marketplace API
// @Description download a skill from marketplace and save it to the database
// @Param body body object.MarketplaceSkillItem true "The marketplace skill item to install"
// @Success 200 {object} object.Skill The installed Skill object
// @router /install-marketplace-skill [post]
func (c *ApiController) InstallMarketplaceSkill() {
	var item object.MarketplaceSkillItem
	if err := json.Unmarshal(c.Ctx.Input.RequestBody, &item); err != nil {
		c.ResponseError(err.Error())
		return
	}

	skill, err := object.InstallMarketplaceSkill(item)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	// Set ownership and creation time before persisting.
	skill.Owner = "admin"
	skill.CreatedTime = time.Now().Format(time.RFC3339)

	_, err = object.AddSkill(skill)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(skill)
}
