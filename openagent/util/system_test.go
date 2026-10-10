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

package util

import (
	"testing"

	"github.com/the-open-agent/openagent/internal/cli"
)

func TestGetVersionInfoFromBuildSkipsDefaultMetadata(t *testing.T) {
	oldVersion, oldCommit := cli.Version, cli.Commit
	defer func() {
		cli.Version, cli.Commit = oldVersion, oldCommit
	}()

	cli.Version = "dev"
	cli.Commit = "unknown"

	versionInfo, ok := GetVersionInfoFromBuild()
	if ok {
		t.Fatal("expected default build metadata to be ignored")
	}
	if versionInfo.Version != "" || versionInfo.CommitId != "" || versionInfo.CommitOffset != -1 {
		t.Fatalf("unexpected fallback version info: %+v", versionInfo)
	}
}

func TestGetVersionInfoFromBuildUsesInjectedMetadata(t *testing.T) {
	oldVersion, oldCommit := cli.Version, cli.Commit
	defer func() {
		cli.Version, cli.Commit = oldVersion, oldCommit
	}()

	cli.Version = "2.18.3"
	cli.Commit = "abc123"

	versionInfo, ok := GetVersionInfoFromBuild()
	if !ok {
		t.Fatal("expected injected build metadata to be used")
	}
	if versionInfo.Version != "2.18.3" {
		t.Fatalf("expected version %q, got %q", "2.18.3", versionInfo.Version)
	}
	if versionInfo.CommitId != "abc123" {
		t.Fatalf("expected commit %q, got %q", "abc123", versionInfo.CommitId)
	}
	if versionInfo.CommitOffset != -1 {
		t.Fatalf("expected unknown commit offset -1, got %d", versionInfo.CommitOffset)
	}
}

func TestGetVersionInfoFromBuildUsesCommitWhenVersionIsDefault(t *testing.T) {
	oldVersion, oldCommit := cli.Version, cli.Commit
	defer func() {
		cli.Version, cli.Commit = oldVersion, oldCommit
	}()

	cli.Version = "dev"
	cli.Commit = "21c2b6283e3c0b716c4d711723b83aaedcfbf32b"

	versionInfo, ok := GetVersionInfoFromBuild()
	if !ok {
		t.Fatal("expected injected commit metadata to be used")
	}
	if versionInfo.Version != "21c2b628" {
		t.Fatalf("expected version to fall back to short commit %q, got %q", "21c2b628", versionInfo.Version)
	}
	if versionInfo.CommitId != "21c2b6283e3c0b716c4d711723b83aaedcfbf32b" {
		t.Fatalf("expected full commit ID, got %q", versionInfo.CommitId)
	}
}

func TestNormalizeVersionInfoVersionFallsBackToShortCommit(t *testing.T) {
	version := normalizeVersionInfoVersion("", "abcdef1234567890")
	if version != "abcdef12" {
		t.Fatalf("expected short commit version %q, got %q", "abcdef12", version)
	}
}

func TestGetVersionInfoReturnsDisplayVersionWhenGitIsAvailable(t *testing.T) {
	versionInfo, err := GetVersionInfo()
	if err != nil {
		t.Skipf("git metadata is not available in this test checkout: %v", err)
	}
	if versionInfo.CommitId == "" {
		t.Fatal("expected git commit ID")
	}
	if versionInfo.Version == "" {
		t.Fatalf("expected display version to fall back to commit ID: %+v", versionInfo)
	}
}
