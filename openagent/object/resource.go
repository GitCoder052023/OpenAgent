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

package object

import (
	"bytes"
	"fmt"

	"github.com/the-open-agent/openagent/util"
	"xorm.io/core"
)

// Resource records every file uploaded through the system (avatars, chat images, task documents, etc.).
type Resource struct {
	Owner       string `xorm:"varchar(100) notnull pk" json:"owner"`
	Name        string `xorm:"varchar(100) notnull pk" json:"name"`
	CreatedTime string `xorm:"varchar(100)" json:"createdTime"`

	DisplayName string `xorm:"varchar(200)" json:"displayName"`
	User        string `xorm:"varchar(100) index" json:"user"`
	Category    string `xorm:"varchar(100)" json:"category"`    // "avatar", "chat", "document"
	FileType    string `xorm:"varchar(100)" json:"fileType"`    // "image", "video", "application", etc.
	FileFormat  string `xorm:"varchar(100)" json:"fileFormat"`  // ".png", ".jpg", ".pdf", ".docx", etc.
	FileName    string `xorm:"varchar(500)" json:"fileName"`    // original filename
	FileSize    int    `json:"fileSize"`                        // size in bytes
	Url         string `xorm:"varchar(500)" json:"url"`         // public accessible URL
	StorageName string `xorm:"varchar(500)" json:"storageName"` // Casdoor object key (used for deletion)
	ObjectType  string `xorm:"varchar(100)" json:"objectType"`  // "store", "task", "message", "chat"
	ObjectId    string `xorm:"varchar(200)" json:"objectId"`    // owner/name of the associated object
}

func (resource *Resource) GetId() string {
	return fmt.Sprintf("%s/%s", resource.Owner, resource.Name)
}

func GetGlobalResources(owner string) ([]*Resource, error) {
	resources := []*Resource{}
	session := adapter.engine.Asc("owner").Desc("created_time")
	if owner != "" {
		session = session.Where("owner = ?", owner)
	}
	err := session.Find(&resources)
	if err != nil {
		return resources, err
	}
	return resources, nil
}

func GetResources(owner, user string) ([]*Resource, error) {
	resources := []*Resource{}
	session := adapter.engine.Desc("created_time")
	if owner != "" {
		session = session.Where("owner = ?", owner)
	}
	if user != "" {
		session = session.And("user = ?", user)
	}
	err := session.Find(&resources)
	if err != nil {
		return resources, err
	}
	return resources, nil
}

func getResource(owner, name string) (*Resource, error) {
	resource := Resource{Owner: owner, Name: name}
	existed, err := adapter.engine.Get(&resource)
	if err != nil {
		return &resource, err
	}
	if existed {
		return &resource, nil
	}
	return nil, nil
}

func GetResource(id string) (*Resource, error) {
	owner, name, err := util.GetOwnerAndNameFromIdWithError(id)
	if err != nil {
		return nil, err
	}
	return getResource(owner, name)
}

func UpdateResource(id string, resource *Resource) (bool, error) {
	owner, name, err := util.GetOwnerAndNameFromIdWithError(id)
	if err != nil {
		return false, err
	}
	_, err = getResource(owner, name)
	if err != nil {
		return false, err
	}
	if resource == nil {
		return false, nil
	}
	_, err = adapter.engine.ID(core.PK{owner, name}).AllCols().Update(resource)
	if err != nil {
		return false, err
	}
	return true, nil
}

func AddResource(resource *Resource) (bool, error) {
	affected, err := adapter.engine.Insert(resource)
	if err != nil {
		return false, err
	}
	return affected != 0, nil
}

// DeleteResourceFile deletes the actual file from the default storage provider using the stored object key.
func DeleteResourceFile(resource *Resource, lang string) error {
	if resource.StorageName == "" {
		return nil
	}
	provider, err := GetDefaultStorageProvider()
	if err != nil {
		return err
	}
	if provider == nil {
		return nil
	}
	storageProvider, err := provider.GetStorageProviderObj("", lang)
	if err != nil {
		return err
	}
	return storageProvider.DeleteObject(resource.StorageName)
}

func DeleteResource(resource *Resource) (bool, error) {
	affected, err := adapter.engine.ID(core.PK{resource.Owner, resource.Name}).Delete(&Resource{})
	if err != nil {
		return false, err
	}
	return affected != 0, nil
}

func GetResourceCount(owner, user, field, value string) (int64, error) {
	session := GetDbSession(owner, -1, -1, field, value, "", "")
	if user != "" {
		session = session.And("user = ?", user)
	}
	return session.Count(&Resource{})
}

func GetUserResourceSize(user string) (int64, error) {
	total, err := adapter.engine.Where("user = ?", user).SumInt(&Resource{}, "file_size")
	return total, err
}

func GetPaginationResources(owner, user string, offset, limit int, field, value, sortField, sortOrder string) ([]*Resource, error) {
	resources := []*Resource{}
	session := GetDbSession(owner, offset, limit, field, value, sortField, sortOrder)
	if user != "" {
		session = session.And("user = ?", user)
	}
	err := session.Find(&resources)
	if err != nil {
		return resources, err
	}
	return resources, nil
}

// NewResourceFromUpload builds a Resource record for a just-uploaded file.
func NewResourceFromUpload(owner, user, category, fileName, fileType, fileFormat, url, storageName string, fileSize int, objectType, objectId string) *Resource {
	name := fmt.Sprintf("resource_%s_%s", util.GetCurrentTime(), util.GetRandomName())
	return &Resource{
		Owner:       owner,
		Name:        name,
		CreatedTime: util.GetCurrentTime(),
		DisplayName: fileName,
		User:        user,
		Category:    category,
		FileType:    fileType,
		FileFormat:  fileFormat,
		FileName:    fileName,
		FileSize:    fileSize,
		Url:         url,
		StorageName: storageName,
		ObjectType:  objectType,
		ObjectId:    objectId,
	}
}

// UploadFileToStorageSafe uploads fileBytes to the default storage provider and returns a public URL.
// objectKey is the storage path used for PutObject (e.g. "openagent/resources/avatar/user/file.png");
// callers should store it as StorageName for later deletion via DeleteResourceFile.
func UploadFileToStorageSafe(objectKey string, fileBytes []byte, origin string, lang string) (fileUrl string, err error) {
	provider, err := GetDefaultStorageProvider()
	if err != nil {
		return "", err
	}
	if provider == nil {
		return "", fmt.Errorf("no default storage provider configured")
	}
	storageProvider, err := provider.GetStorageProviderObj("", lang)
	if err != nil {
		return "", err
	}
	rawUrl, err := storageProvider.PutObject("", "", objectKey, bytes.NewBuffer(fileBytes))
	if err != nil {
		return "", err
	}
	return getUrlFromPath(rawUrl, origin)
}
