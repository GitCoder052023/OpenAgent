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

	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/proxy"
)

// GetGlobalSites
// @Title GetGlobalSites
// @Tag Site API
// @Description get global sites
// @Success 200 {array} object.Site The Response object
// @router /get-global-sites [get]
func (c *ApiController) GetGlobalSites() {
	if !c.RequireGlobalAdmin() {
		return
	}

	sites, err := object.GetGlobalSites()
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(sites)
}

// GetSites
// @Title GetSites
// @Tag Site API
// @Description get sites
// @Success 200 {array} object.Site The Response object
// @router /get-sites [get]
func (c *ApiController) GetSites() {
	if !c.RequireGlobalAdmin() {
		return
	}

	sites, err := object.GetGlobalSites()
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(sites)
}

// GetSite
// @Title GetSite
// @Tag Site API
// @Description get site
// @Param id query string true "The id (owner/name) of the site"
// @Success 200 {object} object.Site The Response object
// @router /get-site [get]
func (c *ApiController) GetSite() {
	// The site holds the Casdoor client secret, from which the app-level access token is derived.
	if !c.RequireGlobalAdmin() {
		return
	}

	id := c.Input().Get("id")

	site, err := object.GetSite(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(site)
}

// GetBuiltInSite
// @Title GetBuiltInSite
// @Tag Site API
// @Description get the built-in site (public endpoint for theme/branding)
// @Success 200 {object} object.Site The Response object
// @router /get-built-in-site [get]
func (c *ApiController) GetBuiltInSite() {
	site, err := object.GetBuiltInSite()
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	if site != nil && !c.IsGlobalAdmin() {
		site.ParentDbName = ""
		site.HubDbNames = ""
		site.Socks5Proxy = ""
		site.LogConfig = ""
		site.IpParsingMode = ""
	}

	c.ResponseOk(site)
}

// UpdateSite
// @Title UpdateSite
// @Tag Site API
// @Description update site
// @Param id   query string      true "The id (owner/name) of the site"
// @Param body body  object.Site true "The details of the site"
// @Success 200 {object} controllers.Response The Response object
// @router /update-site [post]
func (c *ApiController) UpdateSite() {
	if !c.RequireGlobalAdmin() {
		return
	}

	id := c.Input().Get("id")

	var site object.Site
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &site)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	success, err := object.UpdateSite(id, &site)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	if success && site.Name == "site-built-in" {
		object.SyncSiteToConf(&site)
		object.RefreshProviderAdapter()
		InitAuthConfig()
		proxy.InitHttpClient()
	}

	c.ResponseOk(success)
}

// AddSite
// @Title AddSite
// @Tag Site API
// @Description add site
// @Param body body object.Site true "The details of the site"
// @Success 200 {object} controllers.Response The Response object
// @router /add-site [post]
func (c *ApiController) AddSite() {
	if !c.RequireGlobalAdmin() {
		return
	}

	var site object.Site
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &site)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	if site.Owner == "" || site.Name == "" {
		c.ResponseError(c.T("application:Missing required parameters"))
		return
	}

	success, err := object.AddSite(&site)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// DeleteSite
// @Title DeleteSite
// @Tag Site API
// @Description delete site
// @Param body body object.Site true "The details of the site"
// @Success 200 {object} controllers.Response The Response object
// @router /delete-site [post]
func (c *ApiController) DeleteSite() {
	if !c.RequireGlobalAdmin() {
		return
	}

	var site object.Site
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &site)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	if site.Name == "site-built-in" {
		c.ResponseError("the built-in site cannot be deleted")
		return
	}

	success, err := object.DeleteSite(&site)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}
