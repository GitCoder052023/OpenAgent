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

package routers

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/beego/beego/context"
	"github.com/the-open-agent/openagent/auth"
	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/object"
)

const (
	headerOrigin           = "Origin"
	headerAllowOrigin      = "Access-Control-Allow-Origin"
	headerAllowMethods     = "Access-Control-Allow-Methods"
	headerAllowHeaders     = "Access-Control-Allow-Headers"
	headerAllowCredentials = "Access-Control-Allow-Credentials"
	headerExposeHeaders    = "Access-Control-Expose-Headers"
)

// setCorsHeaders lets origin read the response. Credentials (the session cookie) are only
// allowed for trusted origins, otherwise any website could act with the visitor's session.
func setCorsHeaders(ctx *context.Context, origin string, allowCredentials bool) {
	ctx.Output.Header(headerAllowOrigin, origin)
	ctx.Output.Header(headerAllowMethods, "GET, POST, DELETE, PUT, PATCH, OPTIONS")
	ctx.Output.Header(headerAllowHeaders, "Origin, X-Requested-With, Content-Type, Accept, Authorization")
	ctx.Output.Header(headerExposeHeaders, "Content-Length")
	if allowCredentials {
		ctx.Output.Header(headerAllowCredentials, "true")
	}

	if ctx.Input.Method() == "OPTIONS" {
		ctx.ResponseWriter.WriteHeader(http.StatusOK)
	}
}

func CorsFilter(ctx *context.Context) {
	// The Chrome extension bridge is exempt from Casdoor-based CORS validation.
	// WebSocket upgrade requests from Chrome extensions carry a chrome-extension://
	// Origin that is not registered in Casdoor's redirect URIs and would be rejected
	// by the standard CORS check. The bridge handler performs its own access control:
	// loopback-only connections and chrome-extension:// origin validation via the
	// WebSocket Upgrader's CheckOrigin callback.
	if ctx.Request.URL.Path == "/api/chrome-connect" {
		return
	}

	origin := ctx.Input.Header(headerOrigin)

	if origin == "" || origin == "null" {
		return
	}

	// The server's own origin (browsers send Origin on same-origin POSTs too) is always trusted.
	if isSameHostOrigin(origin, ctx.Request.Host) {
		setCorsHeaders(ctx, origin, true)
		if object.OpenAgentHost == "" {
			object.OpenAgentHost = origin
		}
		return
	}

	// Check if origin is allowed based on Casdoor application's RedirectUris
	ok, err := isOriginAllowed(origin)
	if err != nil {
		// Without a Casdoor application there is no list of trusted origins: allow the origin for
		// backwards compatibility, but without credentials so it cannot act with the visitor's session.
		if conf.GetIssuer() == "" || conf.GetConfigString("casdoorApplication") == "" {
			setCorsHeaders(ctx, origin, false)
			return
		}
		// Otherwise, reject the request
		setCorsHeaders(ctx, origin, false)
		ctx.ResponseWriter.WriteHeader(http.StatusForbidden)
		responseError(ctx, fmt.Sprintf("CORS error: %s, path: %s", err.Error(), ctx.Request.URL.Path))
		return
	}

	if !ok {
		setCorsHeaders(ctx, origin, false)
		ctx.ResponseWriter.WriteHeader(http.StatusForbidden)
		responseError(ctx, fmt.Sprintf("CORS error: origin [%s] is not allowed, path: %s", origin, ctx.Request.URL.Path))
		return
	}

	setCorsHeaders(ctx, origin, true)
	if object.OpenAgentHost == "" {
		object.OpenAgentHost = origin
	}
}

func isSameHostOrigin(origin string, host string) bool {
	parsedOrigin, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return host != "" && strings.EqualFold(parsedOrigin.Host, host)
}

func isOriginAllowed(origin string) (bool, error) {
	casdoorEndpoint := conf.GetIssuer()
	casdoorApplication := conf.GetConfigString("casdoorApplication")

	// If Casdoor is not configured, return error to trigger backwards compatibility
	if casdoorEndpoint == "" || casdoorApplication == "" {
		return false, fmt.Errorf("casdoorEndpoint or casdoorApplication is empty")
	}

	application, err := auth.GetApplication(casdoorApplication)
	if err != nil {
		return false, err
	}
	if application == nil {
		return false, fmt.Errorf("The application: %s does not exist", casdoorApplication)
	}

	// Check if origin matches any RedirectUri
	for _, redirectUri := range application.RedirectUris {
		parsedUrl, err := url.Parse(redirectUri)
		if err != nil {
			continue
		}
		allowedOrigin := parsedUrl.Scheme + "://" + parsedUrl.Host
		// Exact match only: a substring check would accept e.g. "https://app.com.evil.com".
		if strings.EqualFold(origin, allowedOrigin) {
			return true, nil
		}
	}

	return false, nil
}
