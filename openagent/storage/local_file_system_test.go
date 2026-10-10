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

package storage

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestIsPathWithinRoot(t *testing.T) {
	root := t.TempDir()

	cases := []struct {
		path string
		want bool
	}{
		{root, true},
		{filepath.Join(root, "a.txt"), true},
		{filepath.Join(root, "sub", "a.txt"), true},
		{filepath.Join(root, "sub", "..", "a.txt"), true},
		{filepath.Join(root, "..", "a.txt"), false},
		{filepath.Join(root, "..", filepath.Base(root)+"-sibling", "a.txt"), false},
		{filepath.Dir(root), false},
		{"", false},
	}

	for _, c := range cases {
		if got := IsPathWithinRoot(root, c.path); got != c.want {
			t.Errorf("IsPathWithinRoot(%q, %q) = %v, want %v", root, c.path, got, c.want)
		}
	}
}

func TestLocalFileSystemRejectsTraversal(t *testing.T) {
	parent := t.TempDir()
	root := filepath.Join(parent, "files")
	p, err := NewLocalFileSystemStorageProvider(root)
	if err != nil {
		t.Fatal(err)
	}

	if _, err = p.PutObject("", "", "org/user/chat/ok.png", bytes.NewBufferString("ok")); err != nil {
		t.Fatalf("PutObject() for a normal key failed: %v", err)
	}

	for _, key := range []string{"../escape.txt", "org/../../escape.txt", "", "."} {
		if _, err = p.PutObject("", "", key, bytes.NewBufferString("x")); err == nil {
			t.Errorf("PutObject(%q) should be rejected", key)
		}
	}
	if _, err = os.Stat(filepath.Join(parent, "escape.txt")); !os.IsNotExist(err) {
		t.Fatalf("file was written outside the storage root")
	}

	for _, key := range []string{"../", "_hidden.ini", ""} {
		if err = p.DeleteObject(key); err == nil {
			t.Errorf("DeleteObject(%q) should be rejected", key)
		}
	}
	if _, err = os.Stat(root); err != nil {
		t.Fatalf("storage root was removed: %v", err)
	}

	if _, err = p.ListObjects("../"); err == nil {
		t.Errorf("ListObjects(\"../\") should be rejected")
	}
}
