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

// The adapter registry: how a third-party installation is recognized and read.
//
// Adding support for another agent -- Hermes, or whatever comes next -- is one
// new file in this package and nothing anywhere else:
//
//  1. Write source_<name>.go with a type implementing Adapter, and register it
//     from an init() in that file.
//  2. Detect() sniffs the input and must stay quiet on a non-match: it is
//     called on every adapter in turn, so a false positive hijacks somebody
//     else's import. Return an error only for input it recognizes but cannot
//     read.
//  3. Extract() fills a Bundle. Anything the source has that OpenAgent cannot
//     represent goes through Bundle.addWarning rather than being dropped: the
//     wizard shows those, and a migration that quietly loses configuration is
//     not a painless one.
//  4. That is all. Planning, conflict handling, progress, history and rollback
//     are shared, and the UI picks the new source up from GetSources().
//
// Nothing else in the codebase needs to learn the new name -- and a user whose
// agent has no adapter yet can still get the whole wizard by emitting the
// Bundle JSON that source_bundle.go reads.

package migration

import (
	"fmt"
	"sort"
)

// Input is the raw material handed to an adapter: either an uploaded
// file (config or archive) or a server-side directory to scan.
type Input struct {
	// Owner is the OpenAgent owner the imported entities will belong to.
	Owner string
	// FileName is the uploaded file's original name, used for format sniffing.
	FileName string
	// Data is the uploaded file's bytes. Empty when Path is used.
	Data []byte
	// Path is a server-side directory (e.g. ~/.openclaw). Empty when Data is used.
	Path string
}

// Adapter converts one third-party agent installation into a bundle.
// Adapters never write to the database; ApplyMigration does that for all of them.
type Adapter interface {
	// Id is the stable key used by the API (e.g. "openclaw").
	Id() string
	// DisplayName is the human-readable label shown in the UI.
	DisplayName() string
	// DefaultPath is the conventional install location, pre-filled in the UI.
	DefaultPath() string
	// FileHint describes what to upload when scanning a path is not possible.
	FileHint() string
	// Detect reports whether this adapter recognizes the input, and which
	// version it looks like. It must not error out on a non-match, only on a
	// match it cannot read.
	Detect(in *Input) (bool, string, error)
	// Extract parses the input into a neutral bundle.
	Extract(in *Input) (*Bundle, error)
}

// Source is the adapter description exposed to the frontend.
type Source struct {
	Id          string `json:"id"`
	DisplayName string `json:"displayName"`
	DefaultPath string `json:"defaultPath"`
	FileHint    string `json:"fileHint"`
}

var adapters = map[string]Adapter{}

// RegisterAdapter makes an adapter available to the migration APIs.
// Adapters register themselves from an init() in their own file.
func RegisterAdapter(adapter Adapter) {
	adapters[adapter.Id()] = adapter
}

// GetAdapter returns the adapter with the given id, or nil.
func GetAdapter(id string) Adapter {
	return adapters[id]
}

// sortedAdapterIds keeps adapter iteration deterministic.
func sortedAdapterIds() []string {
	ids := make([]string, 0, len(adapters))
	for id := range adapters {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

// GetSources lists every registered adapter.
func GetSources() []*Source {
	sources := []*Source{}
	for _, id := range sortedAdapterIds() {
		adapter := adapters[id]
		sources = append(sources, &Source{
			Id:          adapter.Id(),
			DisplayName: adapter.DisplayName(),
			DefaultPath: adapter.DefaultPath(),
			FileHint:    adapter.FileHint(),
		})
	}
	return sources
}

// Detect asks every adapter whether it recognizes the input and
// returns the first match.
func Detect(in *Input) (*Source, string, error) {
	for _, id := range sortedAdapterIds() {
		adapter := adapters[id]
		matched, version, err := adapter.Detect(in)
		if err != nil {
			return nil, "", err
		}
		if matched {
			return &Source{
				Id:          adapter.Id(),
				DisplayName: adapter.DisplayName(),
				DefaultPath: adapter.DefaultPath(),
				FileHint:    adapter.FileHint(),
			}, version, nil
		}
	}
	return nil, "", nil
}

// Extract runs the named adapter, or auto-detects one when sourceId is empty.
func Extract(sourceId string, in *Input) (*Bundle, error) {
	if sourceId == "" {
		source, _, err := Detect(in)
		if err != nil {
			return nil, err
		}
		if source == nil {
			return nil, fmt.Errorf("cannot recognize the input as any supported agent installation")
		}
		sourceId = source.Id
	}

	adapter := GetAdapter(sourceId)
	if adapter == nil {
		return nil, fmt.Errorf("unknown migration source: %s", sourceId)
	}

	bundle, err := adapter.Extract(in)
	if err != nil {
		return nil, err
	}
	if bundle.Source == "" {
		bundle.Source = sourceId
	}
	return bundle, nil
}
