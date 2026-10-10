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

export function getGlobalComments(page = "", pageSize = "", field = "", value = "", sortField = "", sortOrder = "") {
  return fetch(`${Setting.ServerUrl}/api/get-global-comments?p=${page}&pageSize=${pageSize}&field=${field}&value=${value}&sortField=${sortField}&sortOrder=${sortOrder}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getComments(targetType, targetKey, page, pageSize) {
  return fetch(`${Setting.ServerUrl}/api/get-comments?targetType=${encodeURIComponent(targetType)}&targetKey=${encodeURIComponent(targetKey)}&p=${page}&pageSize=${pageSize}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getComment(owner, name) {
  return fetch(`${Setting.ServerUrl}/api/get-comment?id=${owner}/${encodeURIComponent(name)}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function updateComment(owner, name, comment) {
  const newComment = Setting.deepCopy(comment);
  return fetch(`${Setting.ServerUrl}/api/update-comment?id=${owner}/${encodeURIComponent(name)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(newComment),
  }).then(res => Setting.handleFetchResponse(res));
}

export function addComment(comment) {
  return fetch(`${Setting.ServerUrl}/api/add-comment`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(comment),
  }).then(res => Setting.handleFetchResponse(res));
}

export function deleteComment(owner, name) {
  return fetch(`${Setting.ServerUrl}/api/delete-comment`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({owner, name}),
  }).then(res => Setting.handleFetchResponse(res));
}
