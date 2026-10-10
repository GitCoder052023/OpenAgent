// Copyright 2025 The OpenAgent Authors. All Rights Reserved.
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

package controllers

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/beego/beego/utils/pagination"
	"github.com/the-open-agent/openagent/i18n"
	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
)

// GetGlobalFiles
// @Title GetGlobalFiles
// @Tag File API
// @Description get global file objects
// @Success 200 {array} object.File The Response object
// @router /get-global-files [get]
func (c *ApiController) GetGlobalFiles() {
	limit := c.Input().Get("pageSize")
	page := c.Input().Get("p")
	store := c.Input().Get("store")
	field := c.Input().Get("field")
	value := c.Input().Get("value")
	sortField := c.Input().Get("sortField")
	sortOrder := c.Input().Get("sortOrder")

	if limit == "" || page == "" {
		var files []*object.File
		var err error
		if c.IsGlobalAdmin() {
			if store != "" {
				files, err = object.GetFilesByStore("", store)
			} else {
				files, err = object.GetGlobalFiles()
			}
		} else {
			username := c.GetSessionUsername()
			files, err = object.GetFiles(username)
		}
		if err != nil {
			c.ResponseError(err.Error())
			return
		}

		c.ResponseOk(files)
	} else {
		if !c.RequireAdmin() {
			return
		}

		username := c.GetSessionUsername()
		limit := util.ParseInt(limit)

		var count int64
		var files []*object.File
		var err error

		if c.IsGlobalAdmin() {
			count, err = object.GetFileCount("", store, field, value)
			if err != nil {
				c.ResponseError(err.Error())
				return
			}
			paginator := pagination.SetPaginator(c.Ctx, limit, count)
			files, err = object.GetPaginationFiles("", store, paginator.Offset(), limit, field, value, sortField, sortOrder)
		} else {
			count, err = object.GetFileCount(username, store, field, value)
			if err != nil {
				c.ResponseError(err.Error())
				return
			}
			paginator := pagination.SetPaginator(c.Ctx, limit, count)
			files, err = object.GetPaginationFiles(username, store, paginator.Offset(), limit, field, value, sortField, sortOrder)
		}
		if err != nil {
			c.ResponseError(err.Error())
			return
		}

		c.ResponseOk(files, count)
	}
}

// GetFiles
// @Title GetFiles
// @Tag File API
// @Description get file objects
// @Param owner query string true "The owner of the file object"
// @Success 200 {array} object.File The Response object
// @router /get-files [get]
func (c *ApiController) GetFiles() {
	owner := c.Input().Get("owner")
	store := c.Input().Get("store")

	var files []*object.File
	var err error
	if store != "" {
		files, err = object.GetFilesByStore(owner, store)
	} else {
		files, err = object.GetFiles(owner)
	}
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(files)
}

// GetFileMy
// @Title GetFileMy
// @Tag File API
// @Description get file object
// @Param id query string true "The id (owner/name) of the file object"
// @Success 200 {object} object.File The Response object
// @router /get-file [get]
func (c *ApiController) GetFileMy() {
	id := c.Input().Get("id")

	file, err := object.GetFile(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(file)
}

// UpdateFile
// @Title UpdateFile
// @Tag File API
// @Description update file object
// @Param id   query string       true "The id (owner/name) of the file object"
// @Param body body  object.File true "The details of the file object"
// @Success 200 {object} controllers.Response The Response object
// @router /update-file [post]
func (c *ApiController) UpdateFile() {
	id := c.Input().Get("id")

	var file object.File
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &file)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	success, err := object.UpdateFile(id, &file)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// AddFile
// @Title AddFile
// @Tag File API
// @Description add file object
// @Param body body object.File true "The details of the file object"
// @Success 200 {object} controllers.Response The Response object
// @router /add-file [post]
func (c *ApiController) AddFile() {
	var file object.File
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &file)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	success, err := object.AddFile(&file)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// DeleteFile
// @Title DeleteFile
// @Tag File API
// @Description delete file object
// @Param body body object.File true "The details of the file object"
// @Success 200 {object} controllers.Response The Response object
// @router /delete-file [post]
func (c *ApiController) DeleteFile() {
	var file object.File
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &file)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	success, err := object.DeleteFile(&file, c.GetAcceptLanguage())
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// RefreshFileVectors
// @Title RefreshFileVectors
// @Tag File API
// @Description refresh file vectors
// @Param body body object.File true "The details of the file object"
// @Success 200 {object} controllers.Response The Response object
// @router /refresh-file-vectors [post]
func (c *ApiController) RefreshFileVectors() {
	var file object.File
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &file)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	ok, err := object.RefreshFileVectors(&file, c.GetAcceptLanguage())
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(ok)
}

// UploadFile
// @Title UploadFile
// @Tag File API
// @Description upload a file via the default storage provider and persist it in the file DB
// @Param file formData file true "The file to upload"
// @Success 200 {object} controllers.Response The Response object
// @router /upload-file [post]
func (c *ApiController) UploadFile() {
	userName, ok := c.RequireSignedIn()
	if !ok {
		return
	}

	filename := c.Input().Get("filename")
	store := c.Input().Get("store")
	if !c.requireStoreNameOwnership(store) {
		return
	}

	fileData, header, err := c.GetFile("file")
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	defer fileData.Close()

	if filename == "" {
		filename = header.Filename
	}

	if err = validateFileExtension(filename, c.GetAcceptLanguage()); err != nil {
		c.ResponseError(err.Error())
		return
	}

	origin := getOriginFromHost(c.Ctx.Request.Host)
	fileRecord, err := object.UploadFile(userName, userName, filename, store, fileData, c.GetAcceptLanguage(), origin)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(fileRecord)
}

var legacyOfficeExtensions = map[string]bool{
	".doc": true,
	".ppt": true,
	".xls": true,
	".dot": true,
	".pot": true,
	".xlt": true,
	".pps": true,
}

func validateFileExtension(filename string, lang string) error {
	ext := strings.ToLower(filepath.Ext(filename))
	if legacyOfficeExtensions[ext] {
		tmpl := i18n.Translate(lang, "resource:Unsupported legacy file format %s, please convert to a modern format (e.g. .docx, .pptx, .xlsx) before uploading")
		return fmt.Errorf("%s", fmt.Sprintf(tmpl, ext))
	}
	return nil
}
