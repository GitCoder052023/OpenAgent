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

export function generateTextToSpeechAudio(storeId, providerId, messageId, text) {
  const payload = {
    storeId: storeId,
    providerId: providerId,
    messageId: messageId,
    text: text,
  };

  return fetch(`${Setting.ServerUrl}/api/generate-text-to-speech-audio`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept-Language": Setting.getAcceptLanguage(),
    },
    body: JSON.stringify(payload),
  }).then(async response => {
    const contentType = response.headers.get("Content-Type") || "";
    const treatAsError = !response.ok || contentType.includes("application/json");
    if (!treatAsError) {
      return response.blob();
    }
    const data = await Setting.handleFetchResponse(response);
    throw new Error((data && data.msg) || "TTS request failed");
  });
}

export function generateTextToSpeechAudioStream(storeId, messageId) {
  const url = `${Setting.ServerUrl}/api/generate-text-to-speech-audio-stream?storeId=${encodeURIComponent(storeId)}&messageId=${encodeURIComponent(messageId)}`;

  return new EventSource(url, {
    withCredentials: true,
  });
}
