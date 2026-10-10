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

package routers

import (
	"github.com/beego/beego/context"
	"github.com/the-open-agent/openagent/object"
)

// EndpointFilter auto-fills site-built-in's Endpoint field from the request
// host when the field is empty. It is a no-op once the field has been set.
func EndpointFilter(ctx *context.Context) {
	object.AutoFillSiteEndpoint(ctx.Request)
}
