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

//go:build !windows

package util

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// IsDoubleClicked reports whether the process was launched by double-clicking
// its executable from a file manager / desktop environment.
func IsDoubleClicked() bool {
	exe, err := os.Executable()
	if err == nil && isGoBuildTemp(exe) {
		return false
	}

	ppid := os.Getppid()

	switch runtime.GOOS {
	case "darwin":
		// Finder-launched processes are reparented to launchd (PID 1) on macOS.
		return ppid == 1
	case "linux":
		return isLinuxFileManager(linuxParentName(ppid))
	}

	return false
}

func isGoBuildTemp(exe string) bool {
	lower := strings.ToLower(filepath.ToSlash(exe))
	return strings.Contains(lower, "go-build")
}

func linuxParentName(ppid int) string {
	data, err := os.ReadFile(fmt.Sprintf("/proc/%d/comm", ppid))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

func isLinuxFileManager(name string) bool {
	switch strings.ToLower(name) {
	case "nautilus", "dolphin", "thunar", "nemo", "caja", "pcmanfm", "konqueror", "ranger":
		return true
	}
	return false
}
