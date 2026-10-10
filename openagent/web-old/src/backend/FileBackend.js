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

import * as Setting from "../Setting";

export function getGlobalFiles(store = "", page = "", pageSize = "", field = "", value = "", sortField = "", sortOrder = "") {
  return fetch(`${Setting.ServerUrl}/api/get-global-files?store=${store}&p=${page}&pageSize=${pageSize}&field=${field}&value=${value}&sortField=${sortField}&sortOrder=${sortOrder}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getFiles(owner, store = "") {
  return fetch(`${Setting.ServerUrl}/api/get-files?owner=${owner}&store=${store}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getFile(owner, name) {
  return fetch(`${Setting.ServerUrl}/api/get-file?id=${owner}/${encodeURIComponent(name)}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function updateFile(owner, name, file) {
  const newFile = Setting.deepCopy(file);
  return fetch(`${Setting.ServerUrl}/api/update-file?id=${owner}/${encodeURIComponent(name)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newFile),
  }).then(res => Setting.handleFetchResponse(res));
}

export function uploadFile(filename, file, store = "") {
  const formData = new FormData();
  formData.append("file", file);
  return fetch(`${Setting.ServerUrl}/api/upload-file?filename=${encodeURIComponent(filename)}&store=${encodeURIComponent(store)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: formData,
  }).then(res => Setting.handleFetchResponse(res));
}

export function addFile(file) {
  const newFile = Setting.deepCopy(file);
  return fetch(`${Setting.ServerUrl}/api/add-file`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newFile),
  }).then(res => Setting.handleFetchResponse(res));
}

export function deleteFile(file) {
  const newFile = Setting.deepCopy(file);
  return fetch(`${Setting.ServerUrl}/api/delete-file`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newFile),
  }).then(res => Setting.handleFetchResponse(res));
}

export function refreshFileVectors(file) {
  const newFile = Setting.deepCopy(file);
  return fetch(`${Setting.ServerUrl}/api/refresh-file-vectors`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newFile),
  }).then(res => Setting.handleFetchResponse(res));
}
