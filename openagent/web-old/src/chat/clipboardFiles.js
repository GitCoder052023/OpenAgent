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

export const ChatInputAcceptedFileTypes = "image/*, .txt, .md, .yaml, .csv, .docx, .pdf, .xlsx, .pptx";

const supportedFileExtensions = new Set([
  "txt",
  "md",
  "yaml",
  "csv",
  "docx",
  "pdf",
  "xlsx",
  "pptx",
]);

const supportedFileTypes = new Set([
  "text/plain",
  "text/markdown",
  "text/yaml",
  "text/csv",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export function getClipboardFiles(event, acceptFile) {
  const clipboardData = event.clipboardData;
  const itemFiles = Array.from(clipboardData?.items || [])
    .filter(item => item.kind === "file")
    .map(item => item.getAsFile());
  const dataTransferFiles = Array.from(clipboardData?.files || []);
  const fileMap = new Map();

  [...itemFiles, ...dataTransferFiles]
    .filter(file => file && acceptFile(file))
    .forEach(file => {
      fileMap.set(`${file.name}:${file.type}:${file.size}:${file.lastModified}`, file);
    });

  return Array.from(fileMap.values());
}

export function isSupportedClipboardFile(file) {
  const fileType = (file.type || "").toLowerCase();
  if (fileType.startsWith("image/")) {
    return true;
  }
  if (supportedFileTypes.has(fileType)) {
    return true;
  }

  const extension = file.name?.split(".").pop()?.toLowerCase();
  return supportedFileExtensions.has(extension);
}
