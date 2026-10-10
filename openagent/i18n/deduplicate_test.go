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

package i18n

import (
	"testing"
)

// TestDeduplicateFrontendI18n checks for duplicate i18n keys in the frontend en.json file
func TestDeduplicateFrontendI18n(t *testing.T) {
	filePath := "../web/src/locales/en/data.json"

	// Find duplicate keys
	duplicates, err := findDuplicateKeysInJSON(filePath)
	if err != nil {
		t.Fatalf("Failed to check for duplicates in frontend i18n file: %v", err)
	}

	// Print all duplicates and fail the test if any are found
	if len(duplicates) > 0 {
		t.Errorf("Found duplicate i18n keys in frontend file (%s):", filePath)
		for _, dup := range duplicates {
			t.Errorf("  i18next.t(\"%s\") duplicates with i18next.t(\"%s\")", dup.NewPrefixKey, dup.OldPrefixKey)
		}
		t.Fail()
	}
}

// TestDeduplicateBackendI18n checks for duplicate i18n keys in the backend en.json file
func TestDeduplicateBackendI18n(t *testing.T) {
	filePath := "../i18n/locales/en/data.json"

	// Find duplicate keys
	duplicates, err := findDuplicateKeysInJSON(filePath)
	if err != nil {
		t.Fatalf("Failed to check for duplicates in backend i18n file: %v", err)
	}

	// Print all duplicates and fail the test if any are found
	if len(duplicates) > 0 {
		t.Errorf("Found duplicate i18n keys in backend file (%s):", filePath)
		for _, dup := range duplicates {
			t.Errorf("  i18n.Translate(\"%s\") duplicates with i18n.Translate(\"%s\")", dup.NewPrefixKey, dup.OldPrefixKey)
		}
		t.Fail()
	}
}
