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

//go:build !skipCi
// +build !skipCi

package object

import (
	"encoding/json"
	"fmt"
	"testing"

	"xorm.io/core"
)

func TestMigrateStoreOwners(t *testing.T) {
	InitConfig()

	// Step 1: collect all "update-store" records ordered earliest first
	var records []*Record
	err := adapter.engine.Where("action = ?", "update-store").Asc("id").Find(&records)
	if err != nil {
		panic(err)
	}

	// Step 2: build storeName -> ordered unique non-"admin" users,
	// with "test1" deprioritized to the end of the list.
	storeOwners := map[string][]string{}
	seen := map[string]map[string]bool{}

	for _, r := range records {
		if r.User == "" || r.User == "admin" || r.Object == "" {
			continue
		}
		var storeData struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal([]byte(r.Object), &storeData); err != nil || storeData.Name == "" {
			continue
		}
		storeName := storeData.Name
		if seen[storeName] == nil {
			seen[storeName] = map[string]bool{}
		}
		if !seen[storeName][r.User] {
			seen[storeName][r.User] = true
			storeOwners[storeName] = append(storeOwners[storeName], r.User)
		}
	}

	// Move "test1" entries to the end, preserving relative order within each group.
	for storeName, owners := range storeOwners {
		var primary, secondary []string
		for _, u := range owners {
			if u == "test1" {
				secondary = append(secondary, u)
			} else {
				primary = append(primary, u)
			}
		}
		storeOwners[storeName] = append(primary, secondary...)
	}

	// Step 3: migrate ALL stores (re-entrant: matches by Name regardless of current Owner).
	var stores []*Store
	err = adapter.engine.Find(&stores)
	if err != nil {
		panic(err)
	}

	for _, store := range stores {
		owners := storeOwners[store.Name]
		if len(owners) == 0 {
			continue
		}

		oldOwner := store.Owner
		store.Owner = owners[0]
		store.Owners = owners

		_, err = adapter.engine.ID(core.PK{oldOwner, store.Name}).AllCols().Update(store)
		if err != nil {
			t.Logf("Failed to migrate store %q: %v", store.Name, err)
			continue
		}
		fmt.Printf("Migrated store %q: owner %q -> %q, owners: %v\n", store.Name, oldOwner, store.Owner, owners)
	}

	fmt.Println("Store owner migration completed")
}
