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
	"bytes"
	"compress/gzip"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"
)

// ServeEmbedded serves a frontend asset from the embedded web/build FS.
// urlPath is the raw request URL path (e.g. "/", "/assets/index-abc123.js").
// Must only be called when WebFS() != nil.
func ServeEmbedded(w http.ResponseWriter, r *http.Request, urlPath string) {
	embedPath := strings.TrimPrefix(urlPath, "/")
	if embedPath == "" {
		embedPath = "index.html"
	}

	// Fall back to index.html for any path not in the embedded FS (SPA routing).
	if _, err := webFS.Open(embedPath); err != nil {
		embedPath = "index.html"
	}

	if strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
		w.Header().Set("Content-Encoding", "gzip")
		gz := gzip.NewWriter(w)
		defer gz.Close()
		serveEmbeddedFile(gzipWriter{Writer: gz, ResponseWriter: w}, r, embedPath)
	} else {
		serveEmbeddedFile(w, r, embedPath)
	}
}

// serveEmbeddedFile writes a single embedded asset to w. The frontend reads the
// per-instance settings (Casdoor issuer, client ID, branding) from the
// jsonWebConfig cookie that StaticFilter sets, so no asset needs patching here.
func serveEmbeddedFile(w http.ResponseWriter, r *http.Request, embedPath string) {
	data, err := fs.ReadFile(webFS, embedPath)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	if ct := mime.TypeByExtension(filepath.Ext(embedPath)); ct != "" {
		w.Header().Set("Content-Type", ct)
	}

	http.ServeContent(w, r, filepath.Base(embedPath), time.Time{}, bytes.NewReader(data))
}

type gzipWriter struct {
	io.Writer
	http.ResponseWriter
}

func (g gzipWriter) Write(b []byte) (int, error) {
	return g.Writer.Write(b)
}
