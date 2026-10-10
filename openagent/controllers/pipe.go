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

	"github.com/the-open-agent/openagent/object"
	pipepkg "github.com/the-open-agent/openagent/pipe"
)

// GetGlobalPipes
// @Title GetGlobalPipes
// @Tag Pipe API
// @Description get global pipes
// @Success 200 {array} object.Pipe The Response object
// @router /get-global-pipes [get]
func (c *ApiController) GetGlobalPipes() {
	user := c.GetSessionUser()
	pipes, err := object.GetGlobalPipes()
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(object.GetMaskedPipes(pipes, true, user))
}

// GetPipes
// @Title GetPipes
// @Tag Pipe API
// @Description get pipes
// @Success 200 {array} object.Pipe The Response object
// @router /get-pipes [get]
func (c *ApiController) GetPipes() {
	owner := "admin"
	user := c.GetSessionUser()

	pipes, err := object.GetPipes(owner)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(object.GetMaskedPipes(pipes, true, user))
}

// GetPipe
// @Title GetPipe
// @Tag Pipe API
// @Description get pipe
// @Param id query string true "The id of the pipe"
// @Success 200 {object} object.Pipe The Response object
// @router /get-pipe [get]
func (c *ApiController) GetPipe() {
	id := c.Input().Get("id")
	user := c.GetSessionUser()

	pipe, err := object.GetPipe(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(object.GetMaskedPipe(pipe, true, user))
}

// UpdatePipe
// @Title UpdatePipe
// @Tag Pipe API
// @Description update pipe
// @Param id query string true "The id (owner/name) of the pipe"
// @Param body body object.Pipe true "The details of the pipe"
// @Success 200 {object} controllers.Response The Response object
// @router /update-pipe [post]
func (c *ApiController) UpdatePipe() {
	id := c.Input().Get("id")

	var pipe object.Pipe
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &pipe)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	success, err := object.UpdatePipe(id, &pipe)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	stopWeixinClawMonitor(id)
	refreshWeixinClawMonitor(&pipe)

	c.ResponseOk(success)
}

// AddPipe
// @Title AddPipe
// @Tag Pipe API
// @Description add pipe
// @Param body body object.Pipe true "The details of the pipe"
// @Success 200 {object} controllers.Response The Response object
// @router /add-pipe [post]
func (c *ApiController) AddPipe() {
	var pipe object.Pipe
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &pipe)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	pipe.Owner = "admin"
	success, err := object.AddPipe(&pipe)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	startWeixinClawMonitorIfNeeded(&pipe)

	c.ResponseOk(success)
}

// DeletePipe
// @Title DeletePipe
// @Tag Pipe API
// @Description delete pipe
// @Param body body object.Pipe true "The details of the pipe"
// @Success 200 {object} controllers.Response The Response object
// @router /delete-pipe [post]
func (c *ApiController) DeletePipe() {
	var pipe object.Pipe
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &pipe)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	success, err := object.DeletePipe(&pipe)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	stopWeixinClawMonitor(pipe.GetId())
	_ = object.DeletePipeRuntime(pipe.Owner, pipe.Name)

	c.ResponseOk(success)
}

// SetPipeWebhook calls the pipe's chat platform API to register the webhook URL.
// @Title SetPipeWebhook
// @Tag Pipe API
// @Description set webhook for a pipe
// @Param id query string true "The id of the pipe (owner/name)"
// @Success 200 {object} controllers.Response The Response object
// @router /api/set-pipe-webhook [post]
func (c *ApiController) SetPipeWebhook() {
	id := c.Input().Get("id")

	pipe, err := object.GetPipe(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if pipe == nil {
		c.ResponseError("pipe not found")
		return
	}

	pipeObj, err := pipe.GetProvider(c.GetAcceptLanguage())
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	if pipe.Domain == "" {
		c.ResponseError("Domain is not set on this pipe")
		return
	}

	webhookUrl := fmt.Sprintf("%s/api/chat-webhook/%s/%s", pipe.Domain, pipepkg.NormalizeType(pipe.Type), pipe.Name)
	if err = pipeObj.SetWebhook(webhookUrl); err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(webhookUrl)
}

// ChatTest sends a test message through the pipe to verify the full pipeline.
// @Title ChatTest
// @Tag Pipe API
// @Description send a test chat message through a pipe
// @Param id query string true "The id of the pipe (owner/name)"
// @Param chatId query string true "The chat/channel ID to send the message to"
// @Param message query string true "The test message to send"
// @Success 200 {object} controllers.Response The Response object
// @router /api/chat-test [post]
func (c *ApiController) ChatTest() {
	id := c.Input().Get("id")
	chatId := c.Input().Get("chatId")
	message := c.Input().Get("message")

	pipe, err := object.GetPipe(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if pipe == nil {
		c.ResponseError("pipe not found")
		return
	}

	pipeObj, err := pipe.GetProvider(c.GetAcceptLanguage())
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	if err = pipeObj.SendMessage(chatId, message); err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk("message sent")
}
