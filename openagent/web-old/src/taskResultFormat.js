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

/**
 * True if the category title already starts with an ordered index (e.g. "1." or "2）").
 * In that case the UI should not prepend another "1.".
 */
export function categoryNameHasLeadingIndex(name) {
  const s = (name ?? "").trim();
  return /^\d+[.)、]/.test(s);
}

/**
 * @param {{ name?: string }} cat
 * @param {number} index 0-based category index
 */
export function formatCategoryHeading(cat, index) {
  const name = (cat?.name ?? "").trim();
  if (!name) {
    return `${index + 1}.`;
  }
  if (categoryNameHasLeadingIndex(name)) {
    return name;
  }
  return `${index + 1}. ${name}`;
}

/**
 * @param {boolean} zh
 */
export function formatCategoryTitleForDocx(cat, index, zh) {
  const name = (cat?.name ?? "").trim();
  if (!name) {
    return zh ? `${index + 1}、` : `${index + 1}.`;
  }
  if (categoryNameHasLeadingIndex(name)) {
    return name;
  }
  return zh ? `${index + 1}、${name}` : `${index + 1}. ${name}`;
}
