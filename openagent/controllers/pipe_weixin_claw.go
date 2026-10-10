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
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/beego/beego/logs"
	"github.com/the-open-agent/openagent/object"
	pipepkg "github.com/the-open-agent/openagent/pipe"
	"github.com/the-open-agent/openagent/proxy"
)

const (
	weixinClawRuntimeBufPrefix          = "getUpdatesBuf"
	weixinClawRuntimeBaseURL            = "baseUrl"
	weixinClawRuntimeContextTokenPrefix = "contextToken:"
	weixinClawRuntimeIlinkUserID        = "ilinkUserId"
	weixinClawRuntimeLastError          = "lastError"
	weixinClawDefaultPollTimeoutMs      = 35000
)

var weixinClawMonitors = struct {
	sync.Mutex
	cancel map[string]context.CancelFunc
}{cancel: map[string]context.CancelFunc{}}

func InitWeixinClawPipeMonitors() {
	pipes, err := object.GetPipes("admin")
	if err != nil {
		logs.Warning("failed to load pipes for Weixin Claw monitors: %v", err)
		return
	}
	for _, pipeObj := range pipes {
		startWeixinClawMonitorIfNeeded(pipeObj)
	}
}

func refreshWeixinClawMonitor(pipeObj *object.Pipe) {
	if pipeObj == nil {
		return
	}
	stopWeixinClawMonitor(pipeObj.GetId())
	startWeixinClawMonitorIfNeeded(pipeObj)
}

func stopWeixinClawMonitor(pipeId string) {
	weixinClawMonitors.Lock()
	cancel := weixinClawMonitors.cancel[pipeId]
	delete(weixinClawMonitors.cancel, pipeId)
	weixinClawMonitors.Unlock()
	if cancel != nil {
		cancel()
	}
}

func startWeixinClawMonitorIfNeeded(pipeObj *object.Pipe) {
	if pipeObj == nil || pipeObj.Type != pipepkg.WeixinClawType || pipeObj.State != "Active" || strings.TrimSpace(pipeObj.Token) == "" {
		return
	}
	pipeId := pipeObj.GetId()
	weixinClawMonitors.Lock()
	if _, ok := weixinClawMonitors.cancel[pipeId]; ok {
		weixinClawMonitors.Unlock()
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	weixinClawMonitors.cancel[pipeId] = cancel
	weixinClawMonitors.Unlock()

	go runWeixinClawMonitor(ctx, pipeObj)
}

func runWeixinClawMonitor(ctx context.Context, pipeObj *object.Pipe) {
	baseURL, _ := getWeixinClawBaseURL(pipeObj)
	client := pipepkg.NewWeixinClawClient(baseURL, pipeObj.Token, proxy.ProxyHttpClient)
	buf, _ := object.GetPipeRuntimeValue(pipeObj.Owner, pipeObj.Name, weixinClawRuntimeBufPrefix)

	for ctx.Err() == nil {
		resp, err := client.GetUpdates(ctx, buf, weixinClawDefaultPollTimeoutMs)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			setWeixinClawLastError(pipeObj, err)
			if !sleepWeixinClawRetry(ctx) {
				return
			}
			continue
		}
		if resp.Ret != 0 || resp.ErrCode != 0 {
			setWeixinClawLastError(pipeObj, fmt.Errorf("getupdates error: ret=%d errcode=%d errmsg=%s", resp.Ret, resp.ErrCode, resp.ErrMsg))
			if !sleepWeixinClawRetry(ctx) {
				return
			}
			continue
		}
		if resp.GetUpdatesBuf != "" && resp.GetUpdatesBuf != buf {
			buf = resp.GetUpdatesBuf
			_ = object.SetPipeRuntimeValue(pipeObj.Owner, pipeObj.Name, weixinClawRuntimeBufPrefix, buf)
		}
		for _, msg := range resp.Messages {
			handleWeixinClawMessage(pipeObj, msg)
		}
	}
}

func handleWeixinClawMessage(pipeObj *object.Pipe, msg *pipepkg.WeixinClawMessage) {
	text := strings.TrimSpace(msg.Text())
	if text == "" || msg.FromUserId == "" {
		return
	}
	if msg.ContextToken != "" {
		_ = object.SetPipeRuntimeValue(pipeObj.Owner, pipeObj.Name, weixinClawRuntimeContextTokenPrefix+msg.FromUserId, msg.ContextToken)
	}
	baseURL, err := getWeixinClawBaseURL(pipeObj)
	if err != nil {
		setWeixinClawLastError(pipeObj, err)
		return
	}
	provider, err := pipepkg.NewWeixinClawPipe(baseURL, pipeObj.Token, proxy.ProxyHttpClient)
	if err != nil {
		setWeixinClawLastError(pipeObj, err)
		return
	}
	incoming := &pipepkg.IncomingMessage{
		ChatId:   msg.FromUserId,
		UserId:   msg.FromUserId,
		Text:     text,
		Username: msg.FromUserId,
		Metadata: map[string]string{
			"contextToken": msg.ContextToken,
		},
	}
	host := strings.TrimPrefix(strings.TrimPrefix(pipeObj.Domain, "https://"), "http://")
	sendPipeAnswer(provider, pipeObj, incoming, host, "", true)
}

func setWeixinClawLastError(pipeObj *object.Pipe, err error) {
	if pipeObj == nil || err == nil {
		return
	}
	logs.Warning("Weixin Claw pipe %s error: %v", pipeObj.GetId(), err)
	_ = object.SetPipeRuntimeValue(pipeObj.Owner, pipeObj.Name, weixinClawRuntimeLastError, err.Error())
}

func sleepWeixinClawRetry(ctx context.Context) bool {
	timer := time.NewTimer(2 * time.Second)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func getWeixinClawBaseURL(pipeObj *object.Pipe) (string, error) {
	if pipeObj == nil {
		return "", nil
	}
	return object.GetPipeRuntimeValue(pipeObj.Owner, pipeObj.Name, weixinClawRuntimeBaseURL)
}

func (c *ApiController) StartWeixinClawLogin() {
	id := c.Input().Get("id")
	pipeObj, err := object.GetPipe(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if pipeObj == nil {
		c.ResponseError("pipe not found")
		return
	}
	baseURL, err := getWeixinClawBaseURL(pipeObj)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	client := pipepkg.NewWeixinClawClient(baseURL, "", proxy.ProxyHttpClient)
	resp, err := client.StartQRCodeLogin()
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	c.ResponseOk(resp)
}

func (c *ApiController) WaitWeixinClawLogin() {
	id := c.Input().Get("id")
	qrcode := c.Input().Get("qrcode")
	pipeObj, err := object.GetPipe(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if pipeObj == nil {
		c.ResponseError("pipe not found")
		return
	}
	baseURL, err := getWeixinClawBaseURL(pipeObj)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	client := pipepkg.NewWeixinClawClient(baseURL, "", proxy.ProxyHttpClient)
	status, err := client.PollQRCodeStatus(qrcode)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if status.Status == "confirmed" {
		if status.BotToken == "" || status.IlinkBotId == "" {
			c.ResponseError("login confirmed but token or account id is empty")
			return
		}
		pipeObj.Token = status.BotToken
		if status.BaseUrl != "" {
			if err = object.SetPipeRuntimeValue(pipeObj.Owner, pipeObj.Name, weixinClawRuntimeBaseURL, status.BaseUrl); err != nil {
				c.ResponseError(err.Error())
				return
			}
		}
		if status.IlinkUserId != "" {
			if err = object.SetPipeRuntimeValue(pipeObj.Owner, pipeObj.Name, weixinClawRuntimeIlinkUserID, status.IlinkUserId); err != nil {
				c.ResponseError(err.Error())
				return
			}
		}
		pipeObj.State = "Active"
		if _, err = object.UpdatePipe(pipeObj.GetId(), pipeObj); err != nil {
			c.ResponseError(err.Error())
			return
		}
		refreshWeixinClawMonitor(pipeObj)
	} else if status.Status == "scaned_but_redirect" && status.RedirectHost != "" {
		if err = object.SetPipeRuntimeValue(pipeObj.Owner, pipeObj.Name, weixinClawRuntimeBaseURL, fmt.Sprintf("https://%s", status.RedirectHost)); err != nil {
			c.ResponseError(err.Error())
			return
		}
	}
	c.ResponseOk(status)
}
