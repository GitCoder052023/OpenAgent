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

// The live state of a run. The storage layer does the writing and reports back
// here after every entity, and the UI polls this through the API -- so the
// progress view is driven by what actually landed, not by a guess.

package migration

import (
	"fmt"
	"sync"

	"github.com/the-open-agent/openagent/util"
)

// Progress is the live state of a run, polled by the UI.
type Progress struct {
	Id            string           `json:"id"`
	Owner         string           `json:"owner"`
	Source        string           `json:"source"`
	SourceVersion string           `json:"sourceVersion"`
	Status        string           `json:"status"`
	Total         int              `json:"total"`
	Done          int              `json:"done"`
	Current       string           `json:"current"`
	StartedTime   string           `json:"startedTime"`
	EndedTime     string           `json:"endedTime"`
	ErrorText     string           `json:"errorText"`
	Errors        []string         `json:"errors"`
	Applied       []*Item          `json:"applied"`
	Warnings      []*BundleWarning `json:"warnings"`
	Summary       []*Summary       `json:"summary"`
}

var progressMap = struct {
	sync.RWMutex
	items map[string]*Progress
}{items: map[string]*Progress{}}

// snapshot returns a deep-enough copy so a polling reader never races the
// writer goroutine.
func (progress *Progress) snapshot() *Progress {
	copied := *progress
	copied.Errors = append([]string{}, progress.Errors...)
	copied.Applied = append([]*Item{}, progress.Applied...)
	copied.Warnings = append([]*BundleWarning{}, progress.Warnings...)
	copied.Summary = append([]*Summary{}, progress.Summary...)
	return &copied
}

// GetProgress returns a snapshot of a run's state, or nil when the id
// is unknown (server restarted, or the run was never started).
func GetProgress(id string) *Progress {
	progressMap.RLock()
	defer progressMap.RUnlock()

	progress, ok := progressMap.items[id]
	if !ok {
		return nil
	}
	return progress.snapshot()
}

func updateProgress(id string, mutate func(progress *Progress)) {
	progressMap.Lock()
	defer progressMap.Unlock()

	if progress, ok := progressMap.items[id]; ok {
		mutate(progress)
	}
}

// NewProgress registers a run that is about to start and returns its state.
// The id in it is what the UI polls with.
func NewProgress(owner string, bundle *Bundle, plan *Plan) *Progress {
	progress := &Progress{
		Id:            fmt.Sprintf("migration_%s", util.GetRandomString(16)),
		Owner:         owner,
		Source:        bundle.Source,
		SourceVersion: bundle.SourceVersion,
		Status:        StatusRunning,
		Total:         plan.Total,
		StartedTime:   util.GetCurrentTime(),
		Errors:        []string{},
		Applied:       []*Item{},
		Warnings:      plan.Warnings,
		Summary:       plan.Summary,
	}

	progressMap.Lock()
	defer progressMap.Unlock()

	progressMap.items[progress.Id] = progress
	return progress.snapshot()
}

// NoteItemStarted records which entity is being written right now.
func NoteItemStarted(id string, item *Item) {
	updateProgress(id, func(progress *Progress) {
		progress.Current = fmt.Sprintf("%s: %s", item.Category, item.SourceName)
	})
}

// NoteItemDone records an entity that landed.
func NoteItemDone(id string, item *Item) {
	updateProgress(id, func(progress *Progress) {
		progress.Done++
		progress.Applied = append(progress.Applied, item)
		progress.Current = ""
	})
}

// NoteItemFailed records an entity that could not be written. A single failure
// does not stop the run: the rest of the import is still worth having, and the
// failures are shown alongside it.
func NoteItemFailed(id string, item *Item, err error) {
	updateProgress(id, func(progress *Progress) {
		progress.Errors = append(progress.Errors, fmt.Sprintf("%s %q: %s", item.Category, item.SourceName, err.Error()))
	})
}

// FinishProgress closes a run out and returns its final state, which the
// storage layer then persists as the run record.
func FinishProgress(id string, err error) *Progress {
	var final *Progress
	updateProgress(id, func(progress *Progress) {
		progress.EndedTime = util.GetCurrentTime()
		progress.Current = ""
		if err != nil {
			progress.Status = StatusError
			progress.ErrorText = err.Error()
		} else {
			progress.Status = StatusDone
		}
		final = progress.snapshot()
	})
	return final
}
