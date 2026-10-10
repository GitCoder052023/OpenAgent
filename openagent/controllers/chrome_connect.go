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

import "github.com/the-open-agent/openagent/tool"

// ChromeConnect upgrades a local OpenAgent Chrome extension connection to the
// in-process WebSocket bridge used by the browser_use tool in extension mode.
func (c *ApiController) ChromeConnect() {
	c.EnableRender = false
	tool.HandleChromeConnectWebSocket(c.Ctx.ResponseWriter, c.Ctx.Request)
}
