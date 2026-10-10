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

export function getGlobalPipes() {
  return fetch(`${Setting.ServerUrl}/api/get-global-pipes`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getPipes(owner) {
  return fetch(`${Setting.ServerUrl}/api/get-pipes?owner=${owner}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function getPipe(owner, name) {
  return fetch(`${Setting.ServerUrl}/api/get-pipe?id=${owner}/${encodeURIComponent(name)}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function updatePipe(owner, name, pipe) {
  const newPipe = Setting.deepCopy(pipe);
  return fetch(`${Setting.ServerUrl}/api/update-pipe?id=${owner}/${encodeURIComponent(name)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newPipe),
  }).then(res => Setting.handleFetchResponse(res));
}

export function addPipe(pipe) {
  const newPipe = Setting.deepCopy(pipe);
  return fetch(`${Setting.ServerUrl}/api/add-pipe`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newPipe),
  }).then(res => Setting.handleFetchResponse(res));
}

export function deletePipe(pipe) {
  const newPipe = Setting.deepCopy(pipe);
  return fetch(`${Setting.ServerUrl}/api/delete-pipe`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(newPipe),
  }).then(res => Setting.handleFetchResponse(res));
}

export function setPipeWebhook(id) {
  return fetch(`${Setting.ServerUrl}/api/set-pipe-webhook?id=${encodeURIComponent(id)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function chatTest(id, chatId, message) {
  return fetch(`${Setting.ServerUrl}/api/chat-test?id=${encodeURIComponent(id)}&chatId=${encodeURIComponent(chatId)}&message=${encodeURIComponent(message)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function startWeixinClawLogin(id) {
  return fetch(`${Setting.ServerUrl}/api/weixin-claw-login/start?id=${encodeURIComponent(id)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}

export function waitWeixinClawLogin(id, qrcode) {
  return fetch(`${Setting.ServerUrl}/api/weixin-claw-login/wait?id=${encodeURIComponent(id)}&qrcode=${encodeURIComponent(qrcode)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
  }).then(res => Setting.handleFetchResponse(res));
}
