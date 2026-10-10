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
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/beego/beego/utils/pagination"
	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
)

const maxResourceUploadSize = 10 << 20

const defaultResourceQuotaMb = 200

var resourceCategories = map[string]bool{
	"avatar":   true,
	"chat":     true,
	"document": true,
}

var resourceImageMimeTypes = map[string][]string{
	".png":  {"image/png"},
	".jpg":  {"image/jpeg"},
	".jpeg": {"image/jpeg"},
	".gif":  {"image/gif"},
	".webp": {"image/webp"},
	".bmp":  {"image/bmp"},
	".ico":  {"image/x-icon", "image/vnd.microsoft.icon"},
}

func getResourceImageMimeType(ext string, fileBytes []byte) (string, bool) {
	allowed, ok := resourceImageMimeTypes[ext]
	if !ok {
		return "", false
	}
	detected := http.DetectContentType(fileBytes)
	for _, mimeType := range allowed {
		if detected == mimeType {
			return mimeType, true
		}
	}
	return "", false
}

// GetGlobalResources
// @Title GetGlobalResources
// @Tag Resource API
// @Description get global resources with pagination
// @Success 200 {array} object.Resource The Response object
// @router /get-global-resources [get]
func (c *ApiController) GetGlobalResources() {
	owner := c.Input().Get("owner")
	limit := c.Input().Get("pageSize")
	page := c.Input().Get("p")
	field := c.Input().Get("field")
	value := c.Input().Get("value")
	sortField := c.Input().Get("sortField")
	sortOrder := c.Input().Get("sortOrder")

	userName, ok := c.RequireSignedIn()
	if !ok {
		return
	}

	filterUser := ""
	if !c.IsGlobalAdmin() {
		filterUser = userName
	}

	if limit == "" || page == "" {
		var resources []*object.Resource
		var err error
		if filterUser == "" {
			resources, err = object.GetGlobalResources(owner)
		} else {
			resources, err = object.GetResources(owner, filterUser)
		}
		if err != nil {
			c.ResponseError(err.Error())
			return
		}
		c.ResponseOk(resources)
	} else {
		limitInt := util.ParseInt(limit)
		count, err := object.GetResourceCount(owner, filterUser, field, value)
		if err != nil {
			c.ResponseError(err.Error())
			return
		}

		paginator := pagination.SetPaginator(c.Ctx, limitInt, count)
		resources, err := object.GetPaginationResources(owner, filterUser, paginator.Offset(), limitInt, field, value, sortField, sortOrder)
		if err != nil {
			c.ResponseError(err.Error())
			return
		}

		c.ResponseOk(resources, count)
	}
}

// GetResource
// @Title GetResource
// @Tag Resource API
// @Description get resource by id
// @Param id query string true "The id (owner/name) of the resource"
// @Success 200 {object} object.Resource The Response object
// @router /get-resource [get]
func (c *ApiController) GetResource() {
	id := c.Input().Get("id")

	userName, ok := c.RequireSignedIn()
	if !ok {
		return
	}

	resource, err := object.GetResource(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	if resource != nil && !c.IsGlobalAdmin() && resource.User != userName {
		c.ResponseError(c.T("auth:Unauthorized operation"))
		return
	}

	c.ResponseOk(resource)
}

// UpdateResource
// @Title UpdateResource
// @Tag Resource API
// @Description update resource metadata
// @Param id query string true "The id (owner/name) of the resource"
// @Param body body object.Resource true "The resource object"
// @Success 200 {object} controllers.Response The Response object
// @router /update-resource [post]
func (c *ApiController) UpdateResource() {
	if !c.RequireGlobalAdmin() {
		return
	}

	id := c.Input().Get("id")

	var resource object.Resource
	err := json.NewDecoder(c.Ctx.Request.Body).Decode(&resource)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	success, err := object.UpdateResource(id, &resource)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// AddResource
// @Title AddResource
// @Tag Resource API
// @Description add resource record
// @Param body body object.Resource true "The resource object"
// @Success 200 {object} controllers.Response The Response object
// @router /add-resource [post]
func (c *ApiController) AddResource() {
	if !c.RequireGlobalAdmin() {
		return
	}

	var resource object.Resource
	err := json.NewDecoder(c.Ctx.Request.Body).Decode(&resource)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	success, err := object.AddResource(&resource)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// DeleteResource
// @Title DeleteResource
// @Tag Resource API
// @Description delete resource record and its file from storage
// @Param body body object.Resource true "The resource object"
// @Success 200 {object} controllers.Response The Response object
// @router /delete-resource [post]
func (c *ApiController) DeleteResource() {
	userName, ok := c.RequireSignedIn()
	if !ok {
		return
	}

	var form object.Resource
	err := json.NewDecoder(c.Ctx.Request.Body).Decode(&form)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	// Act on the stored resource: the request body could otherwise name any storage object to delete.
	if form.Owner == "" || form.Name == "" {
		c.ResponseError(c.T("application:Missing required parameters"))
		return
	}
	resource, err := object.GetResource(util.GetIdFromOwnerAndName(form.Owner, form.Name))
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if resource == nil {
		c.ResponseError(fmt.Sprintf(c.T("resource:The resource: %s is not found"), util.GetIdFromOwnerAndName(form.Owner, form.Name)))
		return
	}

	if !c.IsGlobalAdmin() && resource.User != userName {
		c.ResponseError(c.T("auth:Unauthorized operation"))
		return
	}

	err = object.DeleteResourceFile(resource, c.GetAcceptLanguage())
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	success, err := object.DeleteResource(resource)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(success)
}

// UploadResource
// @Title UploadResource
// @Tag Resource API
// @Description upload a file (multipart/form-data) and record it as a resource
// @Param file formData file true "The file to upload"
// @Param category formData string false "Resource category: avatar (default), chat, document"
// @Param objectType formData string false "Associated object type: store, task, message, chat"
// @Param objectId formData string false "Associated object id (owner/name)"
// @Success 200 {object} controllers.Response The Response object (returns fileUrl)
// @router /upload-resource [post]
func (c *ApiController) UploadResource() {
	userName, ok := c.RequireSignedIn()
	if !ok {
		return
	}

	category := c.GetString("category")
	objectType := c.GetString("objectType")
	objectId := c.GetString("objectId")
	if category == "" {
		category = "avatar"
	}
	if !resourceCategories[category] {
		c.ResponseError(fmt.Sprintf(c.T("resource:Unsupported resource category: %s"), category))
		return
	}

	file, header, err := c.GetFile("file")
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	defer file.Close()

	fileName := filepath.Base(header.Filename)
	if header.Size > maxResourceUploadSize {
		c.ResponseError(fmt.Sprintf(c.T("resource:The file is too large, the maximum size is %d MB"), maxResourceUploadSize>>20))
		return
	}

	fileBytes, err := io.ReadAll(io.LimitReader(file, maxResourceUploadSize+1))
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if len(fileBytes) > maxResourceUploadSize {
		c.ResponseError(fmt.Sprintf(c.T("resource:The file is too large, the maximum size is %d MB"), maxResourceUploadSize>>20))
		return
	}
	fileSize := len(fileBytes)

	quotaMb := conf.GetConfigInt("resourceQuotaMb")
	if quotaMb <= 0 {
		quotaMb = defaultResourceQuotaMb
	}
	usedSize, err := object.GetUserResourceSize(userName)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if usedSize+int64(fileSize) > int64(quotaMb)<<20 {
		c.ResponseError(fmt.Sprintf(c.T("resource:Your uploaded files exceed the quota of %d MB, please delete some files first"), quotaMb))
		return
	}

	ext := strings.ToLower(filepath.Ext(fileName))
	mimeType, ok := getResourceImageMimeType(ext, fileBytes)
	if !ok {
		c.ResponseError(c.T("resource:Only image files (PNG, JPEG, GIF, WebP, BMP, ICO) can be uploaded"))
		return
	}
	fileType := strings.SplitN(mimeType, "/", 2)[0]

	storedFileName := fmt.Sprintf("%s%s", util.GetRandomName(), ext)
	fullFilePath := fmt.Sprintf("openagent/resources/%s/%s/%s", category, userName, storedFileName)

	host := c.Ctx.Request.Host
	origin := getOriginFromHost(host)
	fileUrl, err := object.UploadFileToStorageSafe(fullFilePath, fileBytes, origin, c.GetAcceptLanguage())
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	resource := object.NewResourceFromUpload("admin", userName, category, fileName, fileType, ext, fileUrl, fullFilePath, fileSize, objectType, objectId)
	_, err = object.AddResource(resource)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(fileUrl, fullFilePath)
}
