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

import * as Setting from "../Setting";

export function addFile(storeId, key, isLeaf, filename, file) {
  const formData = new FormData();
  formData.append("file", file);
  return fetch(`${Setting.ServerUrl}/api/add-tree-file?store=${storeId}&key=${key}&isLeaf=${isLeaf ? 1 : 0}&filename=${encodeURIComponent(filename)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: formData,
  }).then(res => Setting.handleFetchResponse(res));
}

export function deleteFile(storeId, key, isLeaf) {
  return fetch(`${Setting.ServerUrl}/api/delete-tree-file?store=${storeId}&key=${key}&isLeaf=${isLeaf ? 1 : 0}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}
