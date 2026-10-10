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

export function getMigrationSources() {
  return fetch(`${Setting.ServerUrl}/api/get-migration-sources`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

// uploadMigrationFile extracts a source installation and returns {bundleId, plan}.
// Pass either a file (config or .zip archive) or a server-side path, not both.
export function uploadMigrationFile(source, file, path) {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  formData.append("source", source || "");
  formData.append("path", path || "");
  return fetch(`${Setting.ServerUrl}/api/upload-migration-file`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: formData,
  }).then(res => Setting.handleFetchResponse(res));
}

export function previewMigration(bundleId, options) {
  return fetch(`${Setting.ServerUrl}/api/preview-migration`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify({bundleId: bundleId, options: options}),
  }).then(res => Setting.handleFetchResponse(res));
}

export function startMigration(bundleId, options) {
  return fetch(`${Setting.ServerUrl}/api/start-migration`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify({bundleId: bundleId, options: options}),
  }).then(res => Setting.handleFetchResponse(res));
}

export function getMigrationProgress(id) {
  return fetch(`${Setting.ServerUrl}/api/get-migration-progress?id=${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getMigrations() {
  return fetch(`${Setting.ServerUrl}/api/get-migrations`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getMigration(owner, name) {
  return fetch(`${Setting.ServerUrl}/api/get-migration?id=${owner}/${encodeURIComponent(name)}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function rollbackMigration(owner, name) {
  return fetch(`${Setting.ServerUrl}/api/rollback-migration?id=${owner}/${encodeURIComponent(name)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}
