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
import * as VectorBackend from "@/backend/VectorBackend";
import {Badge} from "@/components/ui/badge";
import {Sheet, SheetContent, SheetHeader, SheetTitle} from "@/components/ui/sheet";
import {FileTypeIcon} from "@/components/common/FileTypeIcon";
import {Loading} from "@/components/common/Loading";
import * as Setting from "@/lib/setting";

function hostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function IndexDot({children}: {children: React.ReactNode}) {
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{children}</span>;
}

function SiteIcon({result, index}: {result: any; index: number}) {
  const [failed, setFailed] = React.useState(false);
  if (result.icon && !failed) {
    return <img src={result.icon} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" onError={() => setFailed(true)} />;
  }
  return <IndexDot>{result.index || index + 1}</IndexDot>;
}

/** The web pages an answer was built from: its search results and the pages it fetched. */
export function WebSourcesSheet({open, onClose, results}: {open: boolean; onClose: () => void; results: any[]}) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>{i18next.t("chat:Web sources")}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3">
          {results.map((result, index) => (
            <a
              key={index}
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="block space-y-1.5 rounded-lg border p-3 transition-colors hover:border-primary hover:bg-accent/40"
            >
              <div className="flex items-center gap-2">
                <SiteIcon result={result} index={index} />
                <span className="text-xs font-medium text-primary">{result.site_name || hostname(result.url)}</span>
              </div>
              <div className="text-sm font-medium leading-snug">{result.title}</div>
              <div className="truncate text-xs text-muted-foreground">{result.url}</div>
            </a>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The knowledge-base fragments an answer was grounded in, with how relevant each was. */
export function KnowledgeSourcesSheet({open, onClose, vectorScores, account}: {open: boolean; onClose: () => void; vectorScores: any[]; account: any}) {
  const [vectors, setVectors] = React.useState<Record<string, any> | null>(null);

  React.useEffect(() => {
    if (!open || vectorScores.length === 0) {
      return;
    }
    let cancelled = false;
    setVectors(null);
    Promise.all(vectorScores
      .filter((score) => typeof score.vector === "string" && score.vector)
      .map((score) => VectorBackend.getVector("admin", score.vector).then((res: any) => [score.vector, res.status === "ok" ? res.data : null] as const).catch(() => [score.vector, null] as const)))
      .then((entries) => !cancelled && setVectors(Object.fromEntries(entries.filter(([, data]) => data))))
      .catch(() => {
        Setting.showMessage("error", i18next.t("chat:Unable to load knowledge base sources. Please try again."));
        if (!cancelled) {
          setVectors({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, vectorScores]);

  const openVector = (name: string) => {
    if (window.getSelection()?.toString()) {
      return;
    }
    Setting.openLink(`/vectors/${name}${Setting.isLocalAdminUser(account) ? "" : "?mode=view"}`);
  };

  const openFile = (vector: any) => {
    if (vector.store && vector.file) {
      Setting.openLink(`/stores/${vector.owner || "admin"}/${vector.store}/view?fileKey=${encodeURIComponent(vector.file.replace(/^\/+/, ""))}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader><SheetTitle>{i18next.t("chat:Knowledge sources")}</SheetTitle></SheetHeader>
        {vectors === null ? <Loading /> : (
          <div className="mt-4 space-y-4">
            {vectorScores.map((score, index) => {
              const vector = vectors[score.vector];
              if (!vector) {
                return null;
              }
              return (
                <div key={score.vector} className="space-y-3 rounded-lg border p-3 transition-colors hover:border-primary">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => openVector(score.vector)}><IndexDot>{index + 1}</IndexDot></button>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[13px] font-medium text-primary underline-offset-4 hover:underline" onClick={() => openFile(vector)}>
                      <FileTypeIcon filename={vector.file || ""} />
                      <span className="truncate">{vector.file || i18next.t("chat:Knowledge Fragment")}</span>
                    </button>
                    <Badge variant="secondary" className="shrink-0 font-normal">{i18next.t("chat:Relevance")}: {(score.score * 100).toFixed(1)}%</Badge>
                  </div>
                  <div className="max-h-[50vh] cursor-pointer overflow-auto whitespace-pre-line break-words text-[13px] leading-relaxed text-muted-foreground" onClick={() => openVector(score.vector)}>
                    {vector.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
