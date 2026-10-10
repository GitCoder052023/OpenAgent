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
	"sync"
	"time"

	"github.com/beego/beego/context"
	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/util"
)

const defaultUploadRateLimitPerMinute = 60

var uploadPaths = map[string]bool{
	"/api/upload-resource":       true,
	"/api/upload-file":           true,
	"/api/upload-task-document":  true,
	"/api/upload-migration-file": true,
	"/api/add-tree-file":         true,
}

type uploadRateLimiter struct {
	mu      sync.Mutex
	windows map[string][]time.Time
}

var globalUploadRateLimiter = &uploadRateLimiter{windows: map[string][]time.Time{}}

func (l *uploadRateLimiter) allow(key string, limit int) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	since := now.Add(-time.Minute)
	times := l.windows[key]
	i := 0
	for i < len(times) && times[i].Before(since) {
		i++
	}
	times = times[i:]
	if len(times) >= limit {
		l.windows[key] = times
		return false
	}
	l.windows[key] = append(times, now)

	if len(l.windows) > 10000 {
		for k, v := range l.windows {
			if len(v) == 0 || v[len(v)-1].Before(since) {
				delete(l.windows, k)
			}
		}
	}
	return true
}

func UploadRateLimitFilter(ctx *context.Context) {
	if ctx.Request.Method != http.MethodPost || !uploadPaths[ctx.Request.URL.Path] {
		return
	}

	limit := conf.GetConfigInt("uploadRateLimitPerMinute")
	if limit <= 0 {
		limit = defaultUploadRateLimitPerMinute
	}

	key := getUsername(ctx)
	if key == "" {
		key = util.GetIPFromRequest(ctx.Request)
	}
	if !globalUploadRateLimiter.allow(key, limit) {
		ctx.ResponseWriter.WriteHeader(http.StatusTooManyRequests)
		responseError(ctx, "auth:Too many uploads, please try again later")
	}
}
