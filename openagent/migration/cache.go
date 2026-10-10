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

// The bundle cache, which keeps an extracted bundle alive across the steps of
// the wizard.

package migration

import (
	"fmt"
	"sync"
	"time"

	"github.com/the-open-agent/openagent/util"
)

// The UI extracts once (an upload or a directory scan), then previews the plan,
// tweaks the selection, and only later starts the run. Re-parsing the source on
// every step would mean re-uploading the archive each time, so an extracted
// bundle is parked here under a ticket id until it is used or expires.
const bundleTtl = 30 * time.Minute

type cachedBundle struct {
	bundle    *Bundle
	owner     string
	expiresAt time.Time
}

var bundleCache = struct {
	sync.RWMutex
	items map[string]*cachedBundle
}{items: map[string]*cachedBundle{}}

// CacheBundle parks an extracted bundle and returns its ticket id.
func CacheBundle(owner string, bundle *Bundle) string {
	id := fmt.Sprintf("bundle_%s", util.GetRandomString(16))

	bundleCache.Lock()
	defer bundleCache.Unlock()

	now := time.Now()
	for key, cached := range bundleCache.items {
		if now.After(cached.expiresAt) {
			delete(bundleCache.items, key)
		}
	}
	bundleCache.items[id] = &cachedBundle{bundle: bundle, owner: owner, expiresAt: now.Add(bundleTtl)}
	return id
}

// GetCachedBundle returns a parked bundle. The owner must match the
// one that cached it, so a ticket id leaking between users grants nothing.
func GetCachedBundle(owner string, id string) (*Bundle, error) {
	bundleCache.RLock()
	cached, ok := bundleCache.items[id]
	bundleCache.RUnlock()

	if !ok {
		return nil, fmt.Errorf("the migration bundle: %s is not found, please upload the source again", id)
	}
	if time.Now().After(cached.expiresAt) {
		bundleCache.Lock()
		delete(bundleCache.items, id)
		bundleCache.Unlock()
		return nil, fmt.Errorf("the migration bundle: %s has expired, please upload the source again", id)
	}
	if cached.owner != owner {
		return nil, fmt.Errorf("the migration bundle: %s does not belong to the current user", id)
	}
	return cached.bundle, nil
}
