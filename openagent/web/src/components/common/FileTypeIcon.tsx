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

import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import {cn} from "@/lib/utils";

export const ImageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif"];

const iconsByExtension: [string[], LucideIcon, string][] = [
  [["pdf"], FileText, "text-red-600 dark:text-red-400"],
  [["doc", "docx", "md", "txt", "rtf"], FileText, "text-blue-600 dark:text-blue-400"],
  [["ppt", "pptx"], Presentation, "text-orange-600 dark:text-orange-400"],
  [["xls", "xlsx", "csv"], FileSpreadsheet, "text-green-600 dark:text-green-400"],
  [ImageExtensions, FileImage, "text-violet-600 dark:text-violet-400"],
  [["mp4", "mov", "avi", "mkv", "webm"], FileVideo, "text-pink-600 dark:text-pink-400"],
  [["mp3", "wav", "ogg", "flac", "m4a"], FileAudio, "text-teal-600 dark:text-teal-400"],
  [["zip", "rar", "7z", "tar", "gz"], FileArchive, "text-amber-600 dark:text-amber-400"],
  [["html", "htm", "js", "ts", "tsx", "jsx", "css", "json", "go", "py", "java", "c", "cpp", "sh", "yaml", "yml", "xml"], FileCode, "text-sky-600 dark:text-sky-400"],
];

export function getFileExtension(filename: string | undefined | null) {
  const name = filename ?? "";
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** A document-type icon picked from the file's extension, replacing the antd iconfont set. */
export function FileTypeIcon({filename, className}: {filename: string; className?: string}) {
  const ext = getFileExtension(filename);
  const match = iconsByExtension.find(([extensions]) => extensions.includes(ext));
  const [, Icon, color] = match ?? [[], File, "text-muted-foreground"];
  return <Icon className={cn("h-[18px] w-[18px] shrink-0", color, className)} />;
}
