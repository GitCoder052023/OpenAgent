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

import * as Setting from "../Setting";

export function getGlobalResources(owner = "", page = "", pageSize = "", field = "", value = "", sortField = "", sortOrder = "") {
  return fetch(`${Setting.ServerUrl}/api/get-global-resources?owner=${owner}&p=${page}&pageSize=${pageSize}&field=${field}&value=${value}&sortField=${sortField}&sortOrder=${sortOrder}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getResource(owner, name) {
  return fetch(`${Setting.ServerUrl}/api/get-resource?id=${owner}/${encodeURIComponent(name)}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function updateResource(owner, name, resource) {
  const newResource = Setting.deepCopy(resource);
  return fetch(`${Setting.ServerUrl}/api/update-resource?id=${owner}/${encodeURIComponent(name)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newResource),
  }).then(res => Setting.handleFetchResponse(res));
}

export function addResource(resource) {
  const newResource = Setting.deepCopy(resource);
  return fetch(`${Setting.ServerUrl}/api/add-resource`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newResource),
  }).then(res => Setting.handleFetchResponse(res));
}

export function deleteResource(resource) {
  const newResource = Setting.deepCopy(resource);
  return fetch(`${Setting.ServerUrl}/api/delete-resource`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newResource),
  }).then(res => Setting.handleFetchResponse(res));
}

// uploadResource sends a file as multipart/form-data and creates a Resource record.
// category: "avatar" | "chat" | "document"
export function uploadResource(user, category, objectType, objectId, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);
  formData.append("objectType", objectType || "");
  formData.append("objectId", objectId || "");
  return fetch(`${Setting.ServerUrl}/api/upload-resource`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: formData,
  }).then(res => Setting.handleFetchResponse(res));
}
