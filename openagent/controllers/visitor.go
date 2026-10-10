// Copyright 2025 The OpenAgent Authors. All Rights Reserved.
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

	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
)

// GetVisitors
// @Title GetVisitors
// @Tag Visitor API
// @Description get visitors
// @Param days query string true "days count"
// @Success 200 {array} object.Visitor The Response object
// @router /get-visitors [get]
func (c *ApiController) GetVisitors() {
	if !c.RequireGlobalAdmin() {
		return
	}

	days := util.ParseInt(c.Input().Get("days"))
	user := c.Input().Get("selectedUser")
	fieldParam := c.Input().Get("field")
	fields := strings.Split(fieldParam, ",")

	visitors, err := object.GetVisitors(days, user, fields, c.GetAcceptLanguage())
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(visitors)
}
