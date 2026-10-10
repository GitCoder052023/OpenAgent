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

package storage

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/the-open-agent/openagent/util"
)

type LocalFileSystemStorageProvider struct {
	path string
}

func NewLocalFileSystemStorageProvider(path string) (*LocalFileSystemStorageProvider, error) {
	path = strings.ReplaceAll(path, "\\", "/")
	return &LocalFileSystemStorageProvider{path: path}, nil
}

// IsPathWithinRoot reports whether path, after cleaning and resolving to an absolute path,
// is root itself or lies inside root. It is used to stop "../" sequences in object keys or
// request URLs from escaping a local storage folder.
func IsPathWithinRoot(root string, path string) bool {
	if root == "" || path == "" {
		return false
	}

	absRoot, err := filepath.Abs(root)
	if err != nil {
		return false
	}
	absPath, err := filepath.Abs(path)
	if err != nil {
		return false
	}

	rel, err := filepath.Rel(absRoot, absPath)
	if err != nil {
		return false
	}
	if runtime.GOOS == "windows" && !strings.EqualFold(filepath.VolumeName(absRoot), filepath.VolumeName(absPath)) {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && !filepath.IsAbs(rel))
}

// resolvePath joins key onto the provider root and rejects keys that would escape the root.
func (p *LocalFileSystemStorageProvider) resolvePath(key string) (string, error) {
	fullPath := filepath.Join(p.path, key)
	if !IsPathWithinRoot(p.path, fullPath) {
		return "", fmt.Errorf("invalid object key: %s", key)
	}
	return fullPath, nil
}

func (p *LocalFileSystemStorageProvider) ListObjects(prefix string) ([]*Object, error) {
	objects := []*Object{}
	fullPath, err := p.resolvePath(prefix)
	if err != nil {
		return nil, err
	}
	fullPath = strings.ReplaceAll(fullPath, "\\", "/")
	if err := util.EnsureFolderExists(fullPath); err != nil {
		return nil, err
	}

	filepath.Walk(fullPath, func(path string, info os.FileInfo, err error) error {
		if path == fullPath {
			return nil
		}

		base := filepath.Base(path)
		if info.IsDir() && (strings.HasPrefix(base, ".") || base == "node_modules") {
			return filepath.SkipDir
		}

		if err == nil && !info.IsDir() {
			modTime := info.ModTime()
			path = strings.ReplaceAll(path, "\\", "/")
			relativePath := strings.TrimPrefix(path, p.path)
			relativePath = strings.TrimPrefix(relativePath, "/")

			objects = append(objects, &Object{
				Key:          relativePath,
				LastModified: modTime.Format(time.RFC3339),
				Size:         info.Size(),
				Url:          path,
			})
		}
		return nil
	})

	return objects, nil
}

func (p *LocalFileSystemStorageProvider) PutObject(user string, parent string, key string, fileBuffer *bytes.Buffer) (string, error) {
	fullPath, err := p.resolvePath(key)
	if err != nil {
		return "", err
	}
	if IsPathWithinRoot(fullPath, p.path) {
		return "", fmt.Errorf("invalid object key: %s", key)
	}
	err = os.MkdirAll(filepath.Dir(fullPath), os.ModePerm)
	if err != nil {
		return "", err
	}

	dst, err := os.Create(filepath.Clean(fullPath))
	if err != nil {
		return "", err
	}
	defer dst.Close()

	_, err = io.Copy(dst, fileBuffer)
	return fullPath, err
}

func (p *LocalFileSystemStorageProvider) DeleteObject(key string) error {
	fullPath, err := p.resolvePath(key)
	if err != nil {
		return err
	}
	if strings.HasSuffix(key, "_hidden.ini") {
		fullPath = filepath.Dir(fullPath)
	}
	// Never allow a key to remove the storage root itself.
	if IsPathWithinRoot(fullPath, p.path) {
		return fmt.Errorf("invalid object key: %s", key)
	}
	return os.RemoveAll(fullPath)
}
