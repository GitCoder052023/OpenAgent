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

export function getGlobalSkills() {
  return fetch(`${Setting.ServerUrl}/api/get-global-skills`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getSkills(owner, page = "", pageSize = "", field = "", value = "", sortField = "", sortOrder = "") {
  return fetch(`${Setting.ServerUrl}/api/get-skills?owner=${owner}&p=${page}&pageSize=${pageSize}&field=${field}&value=${value}&sortField=${sortField}&sortOrder=${sortOrder}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getSkill(owner, name) {
  return fetch(`${Setting.ServerUrl}/api/get-skill?id=${owner}/${encodeURIComponent(name)}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function updateSkill(owner, name, skill) {
  const newSkill = Setting.deepCopy(skill);
  return fetch(`${Setting.ServerUrl}/api/update-skill?id=${owner}/${encodeURIComponent(name)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newSkill),
  }).then(res => Setting.handleFetchResponse(res));
}

export function addSkill(skill) {
  const newSkill = Setting.deepCopy(skill);
  return fetch(`${Setting.ServerUrl}/api/add-skill`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newSkill),
  }).then(res => Setting.handleFetchResponse(res));
}

export function deleteSkill(skill) {
  const newSkill = Setting.deepCopy(skill);
  return fetch(`${Setting.ServerUrl}/api/delete-skill`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newSkill),
  }).then(res => Setting.handleFetchResponse(res));
}

export function loadSkill(path) {
  return fetch(`${Setting.ServerUrl}/api/load-skill?path=${encodeURIComponent(path)}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getMarketplaceSources() {
  return fetch(`${Setting.ServerUrl}/api/get-marketplace-sources`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getMarketplaceSkills(source = "", keyword = "") {
  return fetch(`${Setting.ServerUrl}/api/get-marketplace-skills?source=${encodeURIComponent(source)}&keyword=${encodeURIComponent(keyword)}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function installMarketplaceSkill(item) {
  return fetch(`${Setting.ServerUrl}/api/install-marketplace-skill`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(item),
  }).then(res => Setting.handleFetchResponse(res));
}
