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

import DOMPurify from "dompurify";

const allowedTags = ["p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "img"];
const allowedAttr = ["href", "target", "rel", "src", "alt", "title"];

function hasHtmlTag(content) {
  return /<\/?[a-z][\s\S]*>/i.test(content || "");
}

function escapePlainText(content) {
  if (typeof document === "undefined") {
    return (content || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/\r?\n/g, "<br>");
  }

  const container = document.createElement("div");
  (content || "").split(/\r?\n/).forEach((line, index) => {
    if (index > 0) {
      container.appendChild(document.createElement("br"));
    }
    container.appendChild(document.createTextNode(line));
  });
  return container.innerHTML;
}

function normalizeSanitizedHtml(html) {
  if (typeof document === "undefined") {
    return html;
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  template.content.querySelectorAll("a[href]").forEach(link => {
    const href = link.getAttribute("href") || "";
    if (/^\s*javascript:/i.test(href)) {
      link.removeAttribute("href");
      return;
    }
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });

  template.content.querySelectorAll("img").forEach(image => {
    if (!image.getAttribute("alt")) {
      image.setAttribute("alt", "image");
    }
  });

  return template.innerHTML;
}

export function sanitizeCommentHtml(content) {
  const rawContent = content || "";
  const html = hasHtmlTag(rawContent) ? rawContent : escapePlainText(rawContent);
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttr,
  });
  return normalizeSanitizedHtml(sanitized);
}

export function getCommentPlainText(content) {
  const html = sanitizeCommentHtml(content);
  if (typeof document === "undefined") {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  return (container.textContent || "").replace(/\s+/g, " ").trim();
}

export function hasCommentImage(content) {
  const html = sanitizeCommentHtml(content);
  if (typeof document === "undefined") {
    return /<img\b/i.test(html);
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  return container.querySelector("img") !== null;
}

export function isCommentContentEmpty(content) {
  return getCommentPlainText(content) === "" && !hasCommentImage(content);
}

export function getCommentTextLength(content) {
  return Array.from(getCommentPlainText(content)).length;
}

export function truncateCommentText(content, maxChars) {
  const text = getCommentPlainText(content);
  const chars = Array.from(text);
  if (chars.length <= maxChars) {
    return text;
  }
  return `${chars.slice(0, maxChars).join("")}...`;
}
