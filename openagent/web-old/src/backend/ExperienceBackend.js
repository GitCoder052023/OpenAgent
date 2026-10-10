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

export function getGlobalExperiences() {
  return fetch(`${Setting.ServerUrl}/api/get-global-experiences`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getExperiences(owner, page = "", pageSize = "", field = "", value = "", sortField = "", sortOrder = "", store = "") {
  return fetch(`${Setting.ServerUrl}/api/get-experiences?owner=${owner}&p=${page}&pageSize=${pageSize}&field=${field}&value=${value}&sortField=${sortField}&sortOrder=${sortOrder}&store=${store}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getExperience(owner, name) {
  return fetch(`${Setting.ServerUrl}/api/get-experience?id=${owner}/${encodeURIComponent(name)}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getMessageExperience(messageName) {
  return fetch(`${Setting.ServerUrl}/api/get-message-experience?message=${encodeURIComponent(messageName)}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function updateExperience(owner, name, experience) {
  const newExperience = Setting.deepCopy(experience);
  return fetch(`${Setting.ServerUrl}/api/update-experience?id=${owner}/${encodeURIComponent(name)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newExperience),
  }).then(res => Setting.handleFetchResponse(res));
}

export function addExperience(experience) {
  const newExperience = Setting.deepCopy(experience);
  return fetch(`${Setting.ServerUrl}/api/add-experience`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newExperience),
  }).then(res => Setting.handleFetchResponse(res));
}

export function deleteExperience(experience) {
  const newExperience = Setting.deepCopy(experience);
  return fetch(`${Setting.ServerUrl}/api/delete-experience`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newExperience),
  }).then(res => Setting.handleFetchResponse(res));
}
