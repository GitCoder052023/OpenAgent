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

// Word-level diff used to show what a human changed in an AI answer. CJK text has no
// word boundaries, so each CJK character is its own token while Latin runs stay whole.
const TOKEN_REGEX = /[㐀-䶿一-鿿豈-﫿぀-ヿ]|[A-Za-z0-9]+|\s+|[\s\S]/g;

// Guard for the O(n*m) table: past this the diff stops being readable anyway, so the
// panel falls back to showing the two versions whole instead of freezing the tab.
const MAX_DIFF_CELLS = 1000000;

export function tokenize(text) {
  if (!text) {
    return [];
  }
  return text.match(TOKEN_REGEX) || [];
}

function pushPart(parts, type, text) {
  if (text === "") {
    return;
  }
  const last = parts[parts.length - 1];
  if (last && last.type === type) {
    last.text += text;
    return;
  }
  parts.push({type, text});
}

function lcsParts(oldTokens, newTokens) {
  const n = oldTokens.length;
  const m = newTokens.length;
  // lengths[i][j] = LCS length of oldTokens[i:] and newTokens[j:], stored flat.
  const width = m + 1;
  const lengths = new Uint32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (oldTokens[i] === newTokens[j]) {
        lengths[i * width + j] = lengths[(i + 1) * width + (j + 1)] + 1;
      } else {
        const skipOld = lengths[(i + 1) * width + j];
        const skipNew = lengths[i * width + (j + 1)];
        lengths[i * width + j] = skipOld >= skipNew ? skipOld : skipNew;
      }
    }
  }

  const parts = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldTokens[i] === newTokens[j]) {
      pushPart(parts, "equal", oldTokens[i]);
      i++;
      j++;
    } else if (lengths[(i + 1) * width + j] >= lengths[i * width + (j + 1)]) {
      pushPart(parts, "remove", oldTokens[i]);
      i++;
    } else {
      pushPart(parts, "insert", newTokens[j]);
      j++;
    }
  }
  while (i < n) {
    pushPart(parts, "remove", oldTokens[i]);
    i++;
  }
  while (j < m) {
    pushPart(parts, "insert", newTokens[j]);
    j++;
  }
  return parts;
}

// diffText returns a flat list of {type: "equal" | "remove" | "insert", text} parts.
// truncated is true when the texts were too large to align token by token.
export function diffText(oldText, newText) {
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  // Corrections usually touch a small part of a long answer, so peeling the shared
  // head and tail first keeps the alignment table small in the common case.
  let prefix = 0;
  const maxPrefix = Math.min(oldTokens.length, newTokens.length);
  while (prefix < maxPrefix && oldTokens[prefix] === newTokens[prefix]) {
    prefix++;
  }

  let suffix = 0;
  const maxSuffix = Math.min(oldTokens.length, newTokens.length) - prefix;
  while (
    suffix < maxSuffix &&
    oldTokens[oldTokens.length - 1 - suffix] === newTokens[newTokens.length - 1 - suffix]
  ) {
    suffix++;
  }

  const oldMiddle = oldTokens.slice(prefix, oldTokens.length - suffix);
  const newMiddle = newTokens.slice(prefix, newTokens.length - suffix);

  const parts = [];
  pushPart(parts, "equal", oldTokens.slice(0, prefix).join(""));

  let truncated = false;
  if ((oldMiddle.length + 1) * (newMiddle.length + 1) > MAX_DIFF_CELLS) {
    truncated = true;
    pushPart(parts, "remove", oldMiddle.join(""));
    pushPart(parts, "insert", newMiddle.join(""));
  } else {
    lcsParts(oldMiddle, newMiddle).forEach(part => pushPart(parts, part.type, part.text));
  }

  pushPart(parts, "equal", oldTokens.slice(oldTokens.length - suffix).join(""));

  return {parts, truncated};
}

export function getDiffStats(parts) {
  let removed = 0;
  let inserted = 0;
  parts.forEach(part => {
    if (part.type === "remove") {
      removed += part.text.length;
    } else if (part.type === "insert") {
      inserted += part.text.length;
    }
  });
  return {removed, inserted};
}
