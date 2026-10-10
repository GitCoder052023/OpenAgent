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

import i18next from "i18next";
import {CircleCheck, CircleX, TriangleAlert} from "lucide-react";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Progress} from "@/components/ui/progress";
import {MigrationItemsTable} from "@/components/migration/MigrationCommon";
import {cn} from "@/lib/utils";

export interface ProgressStepProps {
  progress: any;
  onRestart: () => void;
  onViewHistory: () => void;
}

/** A run as it happens: how far along, which item is being written, and every row landed so far. */
export function ProgressStep({progress, onRestart, onViewHistory}: ProgressStepProps) {
  const applied: any[] = progress.applied ?? [];
  const errors: string[] = progress.errors ?? [];
  const percent = progress.total > 0 ? Math.round(progress.done / progress.total * 100) : 0;
  const isRunning = progress.status === "Running";
  const isError = progress.status === "Error";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-3">
            <Progress value={percent} className={cn("flex-1", isError && "[&>div]:bg-destructive", !isRunning && !isError && "[&>div]:bg-success")} />
            <span className="w-10 text-right text-sm tabular-nums">{percent}%</span>
            {!isRunning ? (isError ? <CircleX className="h-4 w-4 text-destructive" /> : <CircleCheck className="h-4 w-4 text-success" />) : null}
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="font-semibold tabular-nums">{`${progress.done} / ${progress.total}`}</span>
            {isRunning && progress.current ? <span className="text-muted-foreground">{`${i18next.t("migration:Importing")} ${progress.current}`}</span> : null}
            {!isRunning ? <span className="text-muted-foreground">{`${i18next.t("migration:Finished at")} ${progress.endedTime}`}</span> : null}
          </div>
        </CardContent>
      </Card>

      {isError ? (
        <Alert variant="destructive">
          <CircleX />
          <AlertTitle>{i18next.t("migration:The migration stopped early")}</AlertTitle>
          <AlertDescription>{progress.errorText}</AlertDescription>
        </Alert>
      ) : null}

      {errors.length > 0 ? (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>{i18next.t("migration:{count} items failed and were left out").replace("{count}", String(errors.length))}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {errors.map((error, index) => <li key={index}>{error}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {!isRunning && !isError ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <CircleCheck className="h-12 w-12 text-success" />
          <div className="text-lg font-semibold">{i18next.t("migration:Migration finished")}</div>
          <div className="text-sm text-muted-foreground">
            {i18next.t("migration:{count} items were imported. You can undo this run from the history tab.").replace("{count}", String(applied.length))}
          </div>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" onClick={onRestart}>{i18next.t("migration:Migrate something else")}</Button>
            <Button onClick={onViewHistory}>{i18next.t("migration:View history")}</Button>
          </div>
        </div>
      ) : null}

      <MigrationItemsTable items={applied} />
    </div>
  );
}
