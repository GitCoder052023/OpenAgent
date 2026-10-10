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

package controllers

import (
	"github.com/the-open-agent/openagent/auth"
	"github.com/the-open-agent/openagent/conf"
)

func getStorageProviders() ([]*auth.Provider, error) {
	providers, err := auth.GetProviders()
	if err != nil {
		return providers, err
	}

	res := []*auth.Provider{}
	for _, provider := range providers {
		if provider.Category == "Storage" {
			res = append(res, getPublicStorageProvider(provider))
		}
	}
	return res, nil
}

func getPublicStorageProvider(provider *auth.Provider) *auth.Provider {
	return &auth.Provider{
		Owner:       provider.Owner,
		Name:        provider.Name,
		CreatedTime: provider.CreatedTime,
		DisplayName: provider.DisplayName,
		Category:    provider.Category,
		Type:        provider.Type,
		SubType:     provider.SubType,
		Domain:      provider.Domain,
	}
}

// GetStorageProviders
// @Title GetStorageProviders
// @Tag Storage Provider API
// @Description get storage providers
// @Success 200 {array} object.Provider The Response object
// @router /get-storage-providers [get]
func (c *ApiController) GetStorageProviders() {
	// owner := c.Input().Get("owner")

	if !conf.IsCasdoorAvailable() {
		c.ResponseOk([]*auth.Provider{})
		return
	}

	providers, err := getStorageProviders()
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(providers)
}
