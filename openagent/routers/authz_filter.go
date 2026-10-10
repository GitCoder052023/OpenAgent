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

package routers

import (
	"strings"

	"github.com/beego/beego/context"
	"github.com/beego/beego/logs"
	"github.com/the-open-agent/openagent/authz"
	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/controllers"
	"github.com/the-open-agent/openagent/util"
)

func AuthzFilter(ctx *context.Context) {
	method := ctx.Request.Method
	urlPath := ctx.Request.URL.Path

	checkSessionBinding(ctx)

	if conf.IsDemoMode() {
		if !isAllowedInDemoMode(method, urlPath) {
			controllers.DenyRequest(ctx)
		}
	}
	permissionFilter(ctx)
}

func isAllowedInDemoMode(method string, urlPath string) bool {
	if method != "POST" {
		return true
	}

	if strings.HasPrefix(urlPath, "/api/signin") || urlPath == "/api/signout" || urlPath == "/api/add-chat" || urlPath == "/api/add-message" || urlPath == "/api/update-message" || urlPath == "/api/delete-welcome-message" || urlPath == "/api/cancel-message-answer" || urlPath == "/api/generate-text-to-speech-audio" || urlPath == "/api/add-node-tunnel" || urlPath == "/api/start-connection" || urlPath == "/api/stop-connection" || urlPath == "/api/commit-record" || urlPath == "/api/commit-record-second" || urlPath == "/api/update-chat" || urlPath == "/api/delete-chat" {
		return true
	}

	return false
}

func permissionFilter(ctx *context.Context) {
	urlPath := ctx.Request.URL.Path
	method := ctx.Request.Method

	if !strings.HasPrefix(urlPath, "/api/") {
		return
	}

	controllerName := strings.TrimPrefix(urlPath, "/api/")

	// OpenAI-compatible endpoint uses Bearer token auth
	if controllerName == "chat/completions" || controllerName == "v1/chat/completions" {
		return
	}

	user := GetSessionUser(ctx)

	var role string
	switch {
	case util.IsGlobalAdmin(user):
		role = "admin"
	case util.IsStoreAdmin(user):
		role = "store-admin"
	case user != nil:
		role = "user"
	default:
		role = "anonymous"
	}

	if !authz.IsAllowed(role, method, urlPath) {
		responseError(ctx, "auth:this operation requires admin privilege")
	}
}

func checkSessionBinding(ctx *context.Context) {
	if ctx.Input.CruSession == nil {
		return
	}
	userAgent, ok := ctx.Input.Session("userAgent").(string)
	if !ok || userAgent == ctx.Request.UserAgent() {
		return
	}

	err := ctx.Input.CruSession.Delete("user")
	if err != nil {
		logs.Error("checkSessionBinding() error: %s", err.Error())
	}
}
