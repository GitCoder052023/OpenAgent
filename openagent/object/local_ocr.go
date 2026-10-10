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

package object

import (
	"strings"

	"github.com/the-open-agent/openagent/util"
)

const (
	activeState       = "Active"
	allToolsSelection = "All"
	localFileToolType = "local_file"
)

func isManagedLocalFileTool(t *Tool) bool {
	return t != nil &&
		t.Type == localFileToolType &&
		t.State == activeState &&
		strings.TrimSpace(t.ProviderUrl) == ""
}

func storeEnablesManagedLocalFileTool(store *Store, managedLocalFileTools map[string]*Tool) bool {
	if len(store.Tools) == 1 && store.Tools[0] == allToolsSelection {
		for _, t := range managedLocalFileTools {
			if t.Owner == store.Owner {
				return true
			}
		}
		return false
	}

	for _, toolName := range store.Tools {
		toolName = strings.TrimSpace(toolName)
		if toolName == "" {
			continue
		}

		if _, ok := managedLocalFileTools[toolIdForStoreTool(store.Owner, toolName)]; ok {
			return true
		}
	}

	return false
}

func toolIdForStoreTool(storeOwner string, toolName string) string {
	if owner, name, err := util.GetOwnerAndNameFromIdWithError(toolName); err == nil {
		return util.GetIdFromOwnerAndName(owner, name)
	}
	return util.GetIdFromOwnerAndName(storeOwner, toolName)
}
