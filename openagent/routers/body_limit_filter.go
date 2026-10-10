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
	"net/http"

	"github.com/beego/beego/context"
	"github.com/the-open-agent/openagent/conf"
)

const defaultMaxRequestBodySizeMb = 100

func getMaxRequestBodySize() int64 {
	sizeMb := conf.GetConfigInt("maxRequestBodySizeMb")
	if sizeMb <= 0 {
		sizeMb = defaultMaxRequestBodySizeMb
	}
	return int64(sizeMb) << 20
}

func BodyLimitFilter(ctx *context.Context) {
	r := ctx.Request
	if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
		return
	}

	maxSize := getMaxRequestBodySize()
	if r.ContentLength > maxSize {
		ctx.ResponseWriter.Header().Set("Connection", "close")
		http.Error(ctx.ResponseWriter, http.StatusText(http.StatusRequestEntityTooLarge), http.StatusRequestEntityTooLarge)
		return
	}

	r.Body = http.MaxBytesReader(ctx.ResponseWriter, r.Body, maxSize)
}
