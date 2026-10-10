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

package routers

import (
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/beego/beego/context"
	"github.com/beego/beego/logs"
	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/embedsupport"
	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
)

func getWebBuildFolder() string {
	path := "web/build"
	if util.FileExist(filepath.Join(path, "index.html")) {
		return path
	}

	frontendBaseDir := conf.FrontendBaseDir
	if util.FileExist(filepath.Join(frontendBaseDir, "index.html")) {
		return frontendBaseDir
	}

	path = filepath.Join(frontendBaseDir, "web/build")
	if util.FileExist(filepath.Join(path, "index.html")) {
		return path
	}

	// Fallback: try "../casibase" for backward compatibility.
	casibaseDir := filepath.Join(filepath.Dir(frontendBaseDir), "casibase")
	if util.FileExist(filepath.Join(casibaseDir, "index.html")) {
		return casibaseDir
	}
	if util.FileExist(filepath.Join(casibaseDir, "web/build", "index.html")) {
		return filepath.Join(casibaseDir, "web/build")
	}

	return path
}

func StaticFilter(ctx *context.Context) {
	urlPath := ctx.Request.URL.Path
	if strings.HasPrefix(urlPath, "/api/") {
		return
	}

	if strings.HasPrefix(urlPath, "/swagger") {
		if !util.FileExist(filepath.Join(conf.GetSharedPath("swagger"), "index.html")) {
			target := urlPath
			if target == "/swagger" || target == "/swagger/" {
				target = "/swagger/index.html"
			}
			http.Redirect(ctx.ResponseWriter, ctx.Request, "https://try.openagentai.org"+target, http.StatusFound)
			return
		}
	}

	if strings.HasPrefix(urlPath, "/storage") {
		ctx.Output.Header(headerAllowOrigin, "*")
		ctx.Output.Header(headerAllowMethods, "POST, GET, OPTIONS, DELETE")
		ctx.Output.Header(headerAllowHeaders, "Content-Type, Authorization")
		ctx.Output.Header(headerAllowCredentials, "true")

		if providerName, key, ok := object.ParseStorageObjectUrlPath(urlPath); ok {
			serveStorageObject(ctx, providerName, key)
			return
		}

		// Legacy URLs carry a file path instead of a signed object key, so only signed-in users may use them.
		if GetSessionUser(ctx) == nil {
			http.NotFound(ctx.ResponseWriter, ctx.Request)
			return
		}

		if runtime.GOOS == "windows" {
			urlPath = strings.TrimPrefix(urlPath, "/storage/")
		} else {
			urlPath = strings.TrimPrefix(urlPath, "/storage")
		}

		urlPath = strings.Replace(urlPath, "|", ":", 1)
		if !isServableStorageFile(urlPath) {
			http.NotFound(ctx.ResponseWriter, ctx.Request)
			return
		}
		setStorageFileSecurityHeaders(ctx, urlPath)
		makeGzipResponse(ctx.ResponseWriter, ctx.Request, urlPath)
		return
	}

	webBuildFolder := getWebBuildFolder()
	path := webBuildFolder
	if urlPath == "/" {
		path += "/index.html"
	} else {
		path += urlPath
	}

	if strings.Contains(path, "/../") || !util.FileExist(path) {
		path = webBuildFolder + "/index.html"
	}
	if util.FileExist(path) {
		// index.html hands the per-instance settings (Casdoor issuer, client ID,
		// branding) to the frontend through the jsonWebConfig cookie.
		if strings.HasSuffix(path, "/index.html") {
			err := util.AppendWebConfigCookie(ctx)
			if err != nil {
				logs.Error("AppendWebConfigCookie() error: %s", err.Error())
			}
		}
		makeGzipResponse(ctx.ResponseWriter, ctx.Request, path)
	} else {
		fallback := "web/build/index.html"
		if util.FileExist(fallback) {
			err := util.AppendWebConfigCookie(ctx)
			if err != nil {
				logs.Error("AppendWebConfigCookie() error: %s", err.Error())
			}
			makeGzipResponse(ctx.ResponseWriter, ctx.Request, fallback)
		} else if embedsupport.WebFS() != nil {
			err := util.AppendWebConfigCookie(ctx)
			if err != nil {
				logs.Error("AppendWebConfigCookie() error: %s", err.Error())
			}
			embedsupport.ServeEmbedded(ctx.ResponseWriter, ctx.Request, urlPath)
		} else {
			ctx.ResponseWriter.Header().Set("Content-Type", "text/html; charset=utf-8")
			ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
			_, _ = fmt.Fprint(ctx.ResponseWriter, `<!DOCTYPE html><html><head><title>Frontend Not Built</title></head><body><h2>Frontend not built</h2><p>Please run <code>cd web &amp;&amp; yarn install &amp;&amp; yarn build</code> to build the frontend.</p></body></html>`)
		}
	}
}

// activeStorageFileExts are file types a browser can execute script in when opened directly.
var activeStorageFileExts = map[string]bool{
	".html":  true,
	".htm":   true,
	".xhtml": true,
	".shtml": true,
	".svg":   true,
	".svgz":  true,
	".xml":   true,
	".xsl":   true,
	".js":    true,
	".mjs":   true,
}

// setStorageFileSecurityHeaders stops user-uploaded files from running script on this origin,
// which would otherwise let an uploaded HTML/SVG file act with the viewer's session.
func setStorageFileSecurityHeaders(ctx *context.Context, path string) {
	ctx.Output.Header("X-Content-Type-Options", "nosniff")
	if activeStorageFileExts[strings.ToLower(filepath.Ext(path))] {
		ctx.Output.Header("Content-Security-Policy", "sandbox")
	}
}

func serveStorageObject(ctx *context.Context, providerName string, key string) {
	if !object.IsValidStorageObjectSignature(providerName, key, ctx.Input.Query("sig")) {
		http.NotFound(ctx.ResponseWriter, ctx.Request)
		return
	}

	path, err := object.GetLocalStorageObjectPath(providerName, key)
	if err != nil {
		logs.Error("GetLocalStorageObjectPath() error: %s", err.Error())
	}
	if path == "" || !isServableStorageFile(path) {
		http.NotFound(ctx.ResponseWriter, ctx.Request)
		return
	}

	setStorageFileSecurityHeaders(ctx, path)
	makeGzipResponse(ctx.ResponseWriter, ctx.Request, path)
}

// isServableStorageFile only allows /storage to serve regular files that live inside a
// local storage provider's folder, so the route cannot be used to read arbitrary files.
func isServableStorageFile(path string) bool {
	realPath, err := filepath.EvalSymlinks(filepath.Clean(path))
	if err != nil {
		return false
	}
	info, err := os.Stat(realPath)
	if err != nil || info.IsDir() {
		return false
	}

	ok, err := object.IsLocalStorageFile(realPath)
	if err != nil {
		logs.Error("IsLocalStorageFile() error: %s", err.Error())
		return false
	}
	return ok
}

type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

func makeGzipResponse(w http.ResponseWriter, r *http.Request, path string) {
	if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
		http.ServeFile(w, r, path)
		return
	}
	w.Header().Set("Content-Encoding", "gzip")
	gz := gzip.NewWriter(w)
	defer gz.Close()
	gzw := gzipResponseWriter{Writer: gz, ResponseWriter: w}
	http.ServeFile(gzw, r, path)
}
