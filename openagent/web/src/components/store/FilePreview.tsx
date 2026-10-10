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

import * as React from "react";
import i18next from "i18next";
import DOMPurify from "dompurify";
import {Download} from "lucide-react";
import {Button} from "@/components/ui/button";
import {MessageText} from "@/components/chat/MessageText";
import {CodeEditor} from "@/components/common/CodeEditor";
import {ImageExtensions, getFileExtension} from "@/components/common/FileTypeIcon";
import {Loading} from "@/components/common/Loading";

const VIDEO = ["mp4", "webm", "mov", "ogv"];
const AUDIO = ["mp3", "wav", "ogg", "m4a", "flac"];
const SHEETS = ["xlsx", "xls", "csv"];
// rendered by Microsoft's viewer, the same one the antd page's doc viewer used for Office files
const OFFICE = ["doc", "docx", "ppt", "pptx"];

const CODE_LANGUAGES: Record<string, string> = {
  js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx", json: "json", html: "html", htm: "html", css: "css",
  go: "go", py: "python", java: "java", c: "c", cpp: "cpp", h: "c", sh: "shell", sql: "sql", yaml: "yaml", yml: "yaml", xml: "xml",
};

function stripFrontMatter(text: string) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

/** fetches the file as text or bytes, dropping a response that arrives after the file changed */
function useFileContent(url: string, kind: "text" | "bytes" | null) {
  const [state, setState] = React.useState<{loading: boolean; text?: string; bytes?: ArrayBuffer; error?: string}>({loading: kind !== null});

  React.useEffect(() => {
    if (kind === null) {
      setState({loading: false});
      return;
    }
    let cancelled = false;
    setState({loading: true});
    // storage URLs are signed; cookies only go along when the file is on this site, so a CDN or bucket elsewhere still answers
    fetch(url, {credentials: "same-origin"})
      .then(async(res) => {
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        const value = kind === "text" ? {text: await res.text()} : {bytes: await res.arrayBuffer()};
        if (!cancelled) {
          setState({loading: false, ...value});
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({loading: false, error: String(error?.message ?? error)});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, kind]);

  return state;
}

function SheetPreview({bytes, csv}: {bytes: ArrayBuffer; csv: boolean}) {
  const [html, setHtml] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    import("xlsx").then((XLSX) => {
      const workbook = csv
        ? XLSX.read(new TextDecoder().decode(bytes), {type: "string"})
        : XLSX.read(bytes, {type: "array"});
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const table = sheet ? XLSX.utils.sheet_to_html(sheet, {header: "", footer: ""}) : "";
      if (!cancelled) {
        setHtml(DOMPurify.sanitize(table));
      }
    }).catch(() => !cancelled && setHtml(""));
    return () => {
      cancelled = true;
    };
  }, [bytes, csv]);

  if (html === null) {
    return <Loading />;
  }
  return (
    <div
      className="h-full overflow-auto text-sm [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_tr:first-child_td]:bg-muted/60 [&_tr:first-child_td]:font-medium"
      dangerouslySetInnerHTML={{__html: html}}
    />
  );
}

function Unpreviewable({url, message}: {url: string; message?: string}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
      <p>{message ?? i18next.t("general:No data")}</p>
      {url ? (
        <Button variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noreferrer"><Download />{i18next.t("general:Download")}</a>
        </Button>
      ) : null}
    </div>
  );
}

/** Shows a store file inline: media natively, Markdown rendered, sheets as a table, and anything else as text. */
export function FilePreview({filename, url}: {filename: string; url: string}) {
  const ext = getFileExtension(filename);
  const isMedia = ImageExtensions.includes(ext) || VIDEO.includes(ext) || AUDIO.includes(ext) || ext === "pdf" || OFFICE.includes(ext);
  const kind = ext === "" || isMedia ? null : SHEETS.includes(ext) ? "bytes" : "text";
  const content = useFileContent(url, kind);

  if (ext === "") {
    return <Unpreviewable url={url} />;
  }
  if (ImageExtensions.includes(ext)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="flex h-full items-center justify-center p-4">
        <img src={url} alt={filename} className="max-h-full max-w-full object-contain" />
      </a>
    );
  }
  if (ext === "pdf") {
    return <iframe title={filename} src={url} className="h-full w-full border-0" />;
  }
  if (VIDEO.includes(ext)) {
    return <div className="flex h-full items-center justify-center bg-black"><video src={url} controls className="max-h-full max-w-full" /></div>;
  }
  if (AUDIO.includes(ext)) {
    return <div className="flex h-full items-center justify-center p-6"><audio src={url} controls className="w-full max-w-md" /></div>;
  }
  if (OFFICE.includes(ext)) {
    // the viewer fetches the file itself, so it only works for a file the internet can reach
    if (!/^https?:\/\//.test(url) || /^https?:\/\/(localhost|127\.|\[::1\])/.test(url)) {
      return <Unpreviewable url={url} />;
    }
    return <iframe title={filename} src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} className="h-full w-full border-0" />;
  }

  if (content.loading) {
    return <Loading />;
  }
  if (content.error) {
    return <Unpreviewable url={url} message={content.error} />;
  }
  if (SHEETS.includes(ext) && content.bytes) {
    return <SheetPreview bytes={content.bytes} csv={ext === "csv"} />;
  }
  if (ext === "md" || ext === "markdown") {
    return <div className="h-full overflow-auto p-4"><MessageText text={stripFrontMatter(content.text ?? "")} /></div>;
  }
  return (
    <CodeEditor value={content.text ?? ""} language={CODE_LANGUAGES[ext]} readOnly height="100%" className="h-full [&>div]:h-full" />
  );
}
