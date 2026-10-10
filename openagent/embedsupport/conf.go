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

package embedsupport

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/beego/beego"
)

// usingEmbeddedConf is true when the embedded conf/app.conf was loaded because
// no on-disk conf/app.conf was found. Used by other packages to detect
// single-binary deployment mode.
var usingEmbeddedConf bool

// IsEmbeddedConf reports whether the binary is running in single-binary mode,
// i.e. the embedded conf/app.conf was loaded because no on-disk one was found.
func IsEmbeddedConf() bool { return usingEmbeddedConf }

// setupConf reloads Beego's app config from the embedded conf/app.conf when
// no on-disk conf/app.conf can be found next to the executable or in the cwd.
// If confFS is nil (non-embed build), this is a no-op.
func setupConf(confFS fs.FS) {
	if confFS == nil {
		return
	}

	// On-disk conf takes priority.
	for _, candidate := range confSearchPaths() {
		if _, err := os.Stat(candidate); err == nil {
			return
		}
	}

	data, err := fs.ReadFile(confFS, "app.conf")
	if err != nil {
		fmt.Printf("embedsupport: cannot read embedded app.conf: %v\n", err)
		return
	}

	tmpDir, err := os.MkdirTemp("", "openagent-conf-*")
	if err != nil {
		fmt.Printf("embedsupport: cannot create temp dir for conf: %v\n", err)
		return
	}

	tmpConf := filepath.Join(tmpDir, "app.conf")
	if err = os.WriteFile(tmpConf, data, 0o600); err != nil {
		fmt.Printf("embedsupport: cannot write temp conf: %v\n", err)
		return
	}

	if err = beego.LoadAppConfig("ini", tmpConf); err != nil {
		fmt.Printf("embedsupport: cannot load embedded conf: %v\n", err)
		return
	}

	usingEmbeddedConf = true
	fmt.Println("embedsupport: loaded conf/app.conf from embedded binary")
}

// confSearchPaths returns candidate on-disk paths for conf/app.conf, in
// priority order: executable directory first, then cwd.
func confSearchPaths() []string {
	var paths []string
	if exePath, err := os.Executable(); err == nil {
		paths = append(paths, filepath.Join(filepath.Dir(exePath), "conf", "app.conf"))
	}
	if cwd, err := os.Getwd(); err == nil {
		paths = append(paths, filepath.Join(cwd, "conf", "app.conf"))
	}
	return paths
}

// AppDir returns the directory of conf/app.conf (the executable's one if none),
// so a binary shared by several sites uses each site's own directory.
func AppDir() (dir string, isExeDir bool) {
	exeDir := ""
	if exePath, err := os.Executable(); err == nil {
		exeDir = filepath.Dir(exePath)
		if _, err = os.Stat(filepath.Join(exeDir, "conf", "app.conf")); err == nil {
			return exeDir, true
		}
	}
	cwd, err := os.Getwd()
	if err == nil {
		if _, err = os.Stat(filepath.Join(cwd, "conf", "app.conf")); err == nil {
			return cwd, false
		}
	}
	if exeDir != "" {
		return exeDir, true
	}
	return cwd, false
}
