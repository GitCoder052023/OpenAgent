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

package migration

import (
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"
)

// startTestRun registers a run over the standard plan fixture.
func startTestRun(t *testing.T) (*Progress, *Plan) {
	t.Helper()

	bundle := planFixture()
	plan, err := BuildPlan("admin", bundle, GetDefaultOptions(), &fakeLookup{taken: map[string]bool{}, identical: map[string]bool{}})
	if err != nil {
		t.Fatalf("BuildPlan() error: %s", err.Error())
	}
	return NewProgress("admin", bundle, plan), plan
}

func TestProgressLifecycle(t *testing.T) {
	progress, plan := startTestRun(t)

	if progress.Status != StatusRunning {
		t.Errorf("status = %q, want %q", progress.Status, StatusRunning)
	}
	if progress.Total != plan.Total {
		t.Errorf("total = %d, want the plan's %d", progress.Total, plan.Total)
	}

	first, second := plan.Items[0], plan.Items[1]

	NoteItemStarted(progress.Id, first)
	if current := GetProgress(progress.Id).Current; !strings.Contains(current, first.SourceName) {
		t.Errorf("current = %q, want the item being written", current)
	}

	NoteItemDone(progress.Id, first)
	NoteItemFailed(progress.Id, second, fmt.Errorf("disk on fire"))

	running := GetProgress(progress.Id)
	if running.Done != 1 {
		t.Errorf("done = %d, want 1", running.Done)
	}
	if len(running.Applied) != 1 || running.Applied[0].Key != first.Key {
		t.Errorf("applied = %+v, want only the item that landed", running.Applied)
	}
	// A single failure is recorded alongside the run, not raised as one: the
	// rest of the import is still worth having.
	if len(running.Errors) != 1 || !strings.Contains(running.Errors[0], "disk on fire") {
		t.Errorf("errors = %v, want the failure recorded", running.Errors)
	}
	if running.Status != StatusRunning {
		t.Errorf("status = %q, want the run to continue after an item failure", running.Status)
	}
	if running.Current != "" {
		t.Errorf("current = %q, want it cleared once the item is done", running.Current)
	}

	final := FinishProgress(progress.Id, nil)
	if final.Status != StatusDone || final.EndedTime == "" {
		t.Errorf("final = %+v, want a finished run", final)
	}
	if got := GetProgress(progress.Id); got == nil || got.Status != StatusDone {
		t.Errorf("polling after the run = %+v, want the finished state to stay readable", got)
	}
}

func TestProgressFailedRun(t *testing.T) {
	progress, _ := startTestRun(t)

	final := FinishProgress(progress.Id, fmt.Errorf("the source went away"))
	if final.Status != StatusError {
		t.Errorf("status = %q, want %q", final.Status, StatusError)
	}
	if !strings.Contains(final.ErrorText, "the source went away") {
		t.Errorf("errorText = %q, want the cause", final.ErrorText)
	}
}

// The UI polls while the run writes, so a snapshot must not share the slices
// the writer keeps appending to.
func TestProgressSnapshotIsIsolated(t *testing.T) {
	progress, plan := startTestRun(t)

	NoteItemDone(progress.Id, plan.Items[0])
	snapshot := GetProgress(progress.Id)
	NoteItemDone(progress.Id, plan.Items[1])

	if len(snapshot.Applied) != 1 {
		t.Errorf("snapshot grew to %d applied items, want it frozen at 1", len(snapshot.Applied))
	}
	if len(GetProgress(progress.Id).Applied) != 2 {
		t.Error("the live state did not advance")
	}
}

// A run started before a restart is simply unknown, which is what the API
// reports rather than pretending it is still going.
func TestProgressUnknownId(t *testing.T) {
	if got := GetProgress("migration_does_not_exist"); got != nil {
		t.Errorf("GetProgress() = %+v, want nil", got)
	}
}

// Polling happens on the HTTP goroutine while the run writes on its own, so
// the two must not race. Run with -race to make this test mean anything.
func TestProgressConcurrentPolling(t *testing.T) {
	progress, plan := startTestRun(t)

	var group sync.WaitGroup
	group.Add(2)

	go func() {
		defer group.Done()
		for i := 0; i < 200; i++ {
			NoteItemStarted(progress.Id, plan.Items[i%len(plan.Items)])
			NoteItemDone(progress.Id, plan.Items[i%len(plan.Items)])
		}
	}()
	go func() {
		defer group.Done()
		for i := 0; i < 200; i++ {
			GetProgress(progress.Id)
		}
	}()

	group.Wait()
	if done := GetProgress(progress.Id).Done; done != 200 {
		t.Errorf("done = %d, want 200", done)
	}
}

func TestBundleCacheRoundTrip(t *testing.T) {
	bundle := planFixture()
	id := CacheBundle("admin", bundle)

	got, err := GetCachedBundle("admin", id)
	if err != nil {
		t.Fatalf("GetCachedBundle() error: %s", err.Error())
	}
	if got != bundle {
		t.Error("GetCachedBundle() returned a different bundle")
	}

	// A ticket id is not an authorization: it only works for the owner that
	// parked it.
	if _, err = GetCachedBundle("someone-else", id); err == nil {
		t.Error("GetCachedBundle() accepted another owner's ticket")
	}
	if _, err = GetCachedBundle("admin", "bundle_nope"); err == nil {
		t.Error("GetCachedBundle() accepted an unknown ticket")
	}
}

func TestBundleCacheExpiry(t *testing.T) {
	id := CacheBundle("admin", planFixture())

	bundleCache.Lock()
	bundleCache.items[id].expiresAt = time.Now().Add(-time.Minute)
	bundleCache.Unlock()

	_, err := GetCachedBundle("admin", id)
	if err == nil {
		t.Fatal("GetCachedBundle() returned an expired bundle")
	}
	if !strings.Contains(err.Error(), "expired") {
		t.Errorf("error = %q, want it to say the bundle expired", err.Error())
	}
}
