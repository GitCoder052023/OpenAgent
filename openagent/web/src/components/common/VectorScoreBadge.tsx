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

import * as React from "react";
import i18next from "i18next";
import * as VectorBackend from "@/backend/VectorBackend";
import {Badge} from "@/components/ui/badge";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";

/**
 * A retrieved knowledge chunk's score. Hovering shows which file it came from
 * and the text the answer was given, fetched the first time it opens.
 */
export function VectorScoreBadge({vectorScore}: {vectorScore: {vector: string; score: number}}) {
  const [open, setOpen] = React.useState(false);
  const [vector, setVector] = React.useState<any>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    if (!open || vector) {
      return;
    }
    VectorBackend.getVector("admin", vectorScore.vector).then((res: any) => {
      if (res.status === "ok") {
        setVector(res.data);
      }
    });
  }, [open, vector, vectorScore.vector]);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const hover = (next: boolean, delay: number) => () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), delay);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onMouseEnter={hover(true, 200)} onMouseLeave={hover(false, 150)}>
        <a href={`/vectors/${vectorScore.vector}`} target="_blank" rel="noreferrer">
          <Badge variant="info" className="tabular-nums">{vectorScore.score}</Badge>
        </a>
      </PopoverTrigger>
      <PopoverContent side="left" className="w-[900px] max-w-[calc(100vw-80px)] space-y-2 text-sm" onMouseEnter={hover(true, 0)} onMouseLeave={hover(false, 150)}>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span><span className="font-semibold">{i18next.t("general:Name")}:</span> {vectorScore.vector}</span>
          <span><span className="font-semibold">{i18next.t("task:Score")}:</span> {vectorScore.score}</span>
          <span><span className="font-semibold">{i18next.t("store:File")}:</span> {vector?.file}</span>
        </div>
        <div className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-2 text-[13px]">{vector?.text}</div>
      </PopoverContent>
    </Popover>
  );
}
