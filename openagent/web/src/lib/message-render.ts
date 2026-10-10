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

import {marked} from "marked";
import DOMPurify from "dompurify";
import katex from "katex";
// the common languages only; the full set is most of a megabyte
import hljs from "highlight.js/lib/common";

marked.setOptions({gfm: true, breaks: true, pedantic: false});

const CodePlaceholder = "___CODE_BLOCK___";

/**
 * Renders $$…$$, \[…\], $…$ and \(…\) with KaTeX before markdown sees them, so
 * markdown does not eat the backslashes and underscores. Fenced code is left alone.
 */
function renderLatex(text: string) {
  const codeBlocks: string[] = [];
  let result = text.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `${CodePlaceholder}${codeBlocks.length - 1}${CodePlaceholder}`;
  });

  const render = (formula: string, displayMode: boolean, original: string) => {
    try {
      return katex.renderToString(formula, {throwOnError: false, displayMode});
    } catch {
      return original;
    }
  };
  // display math first, so a $$ pair is not read as two inline $ pairs
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => render(formula, true, match));
  result = result.replace(/\\\[([\s\S]+?)\\\]/g, (match, formula) => render(formula, true, match));
  result = result.replace(/\$([^$\n]+?)\$/g, (match, formula) => render(formula, false, match));
  result = result.replace(/\\\((.+?)\\\)/g, (match, formula) => render(formula, false, match));

  return result.replace(new RegExp(`${CodePlaceholder}(\\d+)${CodePlaceholder}`, "g"), (_match, index) => codeBlocks[Number(index)]);
}

function renderMarkdown(text: string) {
  const html = DOMPurify.sanitize(marked.parse(text, {async: false}) as string);
  const template = document.createElement("template");
  template.innerHTML = html;
  // links in an answer leave the console
  template.content.querySelectorAll("a").forEach((link) => {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noreferrer noopener");
  });
  template.content.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightElement(block as HTMLElement);
  });
  return template.innerHTML;
}

/** A chat message's text as safe HTML: math, markdown and highlighted code. */
export function renderMessageHtml(text: string | undefined | null) {
  if (!text) {
    return "";
  }
  return renderMarkdown(renderLatex(text));
}
