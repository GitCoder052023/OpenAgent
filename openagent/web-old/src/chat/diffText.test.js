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

/* eslint-env jest */
import {diffText, getDiffStats} from "./diffText";

const render = (parts, type) => parts.filter(part => part.type === type).map(part => part.text).join("");

describe("diffText", () => {
  test("rebuilds both versions from the parts", () => {
    const oldText = "Refunds are accepted within 7 days of delivery.";
    const newText = "Refunds are accepted within 30 days of delivery.";
    const {parts} = diffText(oldText, newText);

    expect(render(parts, "equal") + "").toBeTruthy();
    expect(parts.filter(p => p.type !== "insert").map(p => p.text).join("")).toBe(oldText);
    expect(parts.filter(p => p.type !== "remove").map(p => p.text).join("")).toBe(newText);
  });

  test("keeps the untouched text as a single equal run", () => {
    const {parts} = diffText("the answer is 7 days", "the answer is 30 days");

    expect(render(parts, "remove")).toBe("7");
    expect(render(parts, "insert")).toBe("30");
  });

  test("diffs Chinese character by character", () => {
    const {parts} = diffText("退货期限是七天。", "退货期限是三十天。");

    expect(parts.filter(p => p.type !== "insert").map(p => p.text).join("")).toBe("退货期限是七天。");
    expect(parts.filter(p => p.type !== "remove").map(p => p.text).join("")).toBe("退货期限是三十天。");
    expect(render(parts, "equal")).toContain("退货期限是");
  });

  test("marks a wholly rewritten answer as one removal and one insertion", () => {
    const {parts, truncated} = diffText("alpha beta", "gamma delta");

    expect(truncated).toBe(false);
    expect(render(parts, "equal").trim()).toBe("");
    expect(render(parts, "remove")).toContain("alpha");
    expect(render(parts, "insert")).toContain("gamma");
  });

  test("handles an empty original", () => {
    const {parts} = diffText("", "a new answer");

    expect(render(parts, "remove")).toBe("");
    expect(render(parts, "insert")).toBe("a new answer");
  });

  test("falls back instead of aligning two very long, very different texts", () => {
    const oldText = Array.from({length: 1200}, (_, i) => `old${i}`).join(" ");
    const newText = Array.from({length: 1200}, (_, i) => `new${i}`).join(" ");
    const {parts, truncated} = diffText(oldText, newText);

    expect(truncated).toBe(true);
    expect(parts.filter(p => p.type !== "insert").map(p => p.text).join("")).toBe(oldText);
    expect(parts.filter(p => p.type !== "remove").map(p => p.text).join("")).toBe(newText);
  });

  test("counts inserted and removed characters", () => {
    const {parts} = diffText("7 days", "30 days");

    expect(getDiffStats(parts)).toEqual({removed: 1, inserted: 2});
  });
});
