// Copyright 2025 The OpenAgent Authors. All Rights Reserved.
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
import {CircleAlert, CircleCheck, CircleX} from "lucide-react";
import {cn} from "@/lib/utils";

interface Difference {
  path: string;
  chainValue: any;
  localValue: any;
}

type ComparisonResult =
  | {status: "matched"; blockId: string; data: string}
  | {status: "mismatched"; blockId: string; chainData: string; localData: string; differences: Difference[]}
  | {status: "unknown"; rawData: string};

function tryParseJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** The record's `value` field is itself a JSON string; compare what is inside it. */
function unwrapValue(data: any) {
  if (data?.value && typeof data.value === "string") {
    return tryParseJson(data.value) ?? data;
  }
  return data;
}

function detectDifferences(chainData: any, localData: any): Difference[] {
  const differences: Difference[] = [];
  const compare = (chainObj: any, localObj: any, path: string) => {
    for (const key in chainObj) {
      const currentPath = path ? `${path}.${key}` : key;
      if (!(key in localObj)) {
        differences.push({path: currentPath, chainValue: chainObj[key], localValue: i18next.t("general:Error")});
      } else if (typeof chainObj[key] !== typeof localObj[key]) {
        differences.push({path: currentPath, chainValue: chainObj[key], localValue: localObj[key]});
      } else if (typeof chainObj[key] === "object" && chainObj[key] !== null && !Array.isArray(chainObj[key])) {
        compare(chainObj[key], localObj[key], currentPath);
      } else if (chainObj[key] !== localObj[key]) {
        differences.push({path: currentPath, chainValue: chainObj[key], localValue: localObj[key]});
      }
    }
  };
  if (chainData && localData) {
    compare(unwrapValue(chainData), unwrapValue(localData), "");
  }
  return differences;
}

/**
 * The query API answers with text: a first line naming the block and saying
 * "Matched" or not, followed by the data, or by the chain and local data.
 */
function parseQueryResult(queryResult: string): ComparisonResult {
  const lines = queryResult.split("\n");
  const blockId = lines[0].match(/block \[(\d+)\]/)?.[1] ?? "Unknown";

  if (lines[0].includes("Matched")) {
    const dataStart = lines.findIndex((line) => line.includes("Data:"));
    if (dataStart !== -1) {
      return {status: "matched", blockId, data: lines.slice(dataStart + 2).join("\n").trim()};
    }
  } else {
    const chainStart = lines.findIndex((line) => line.includes("Chain data:"));
    const localStart = lines.findIndex((line) => line.includes("Local data:"));
    if (chainStart !== -1 && localStart !== -1) {
      const chainData = lines.slice(chainStart + 2, localStart - 1).join("\n").trim();
      const localData = lines.slice(localStart + 2).join("\n").trim();
      return {
        status: "mismatched",
        blockId,
        chainData,
        localData,
        differences: detectDifferences(tryParseJson(chainData), tryParseJson(localData)),
      };
    }
  }
  return {status: "unknown", rawData: queryResult};
}

function formatFieldValue(value: any) {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return value.length > 50 ? `${value.substring(0, 50)}...` : value;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function JsonBlock({children}: {children: string}) {
  return (
    <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-900 p-3 font-mono text-xs text-zinc-100">
      {children}
    </pre>
  );
}

function Header({tone, title, subtitle, blockId}: {tone: "success" | "destructive" | "warning"; title: string; subtitle: string; blockId?: string}) {
  const Icon = tone === "success" ? CircleCheck : tone === "destructive" ? CircleX : CircleAlert;
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-md border p-3",
      tone === "success" && "border-success/40 bg-success/10 text-success",
      tone === "destructive" && "border-destructive/40 bg-destructive/10 text-destructive",
      tone === "warning" && "border-warning/40 bg-warning/10 text-warning",
    )}>
      <Icon className="h-7 w-7 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-foreground">{title}</div>
        <div className="text-sm">{subtitle}</div>
      </div>
      {blockId ? (
        <div className="text-right text-sm">
          <div className="text-muted-foreground">{i18next.t("general:Block")}</div>
          <div className="font-mono text-foreground">{blockId}</div>
        </div>
      ) : null}
    </div>
  );
}

/** The outcome of querying a committed record back from the chain. */
export function CommitResult({queryResult}: {queryResult: string}) {
  if (!queryResult) {
    return null;
  }
  const result = parseQueryResult(queryResult);

  if (result.status === "matched") {
    return (
      <div className="space-y-3">
        <Header tone="success" title={i18next.t("record:Data Verification")} subtitle={i18next.t("general:Success")} blockId={result.blockId} />
        <div className="space-y-1.5">
          <h4 className="text-sm font-semibold">{i18next.t("general:Data")}</h4>
          <JsonBlock>{result.data}</JsonBlock>
        </div>
      </div>
    );
  }

  if (result.status === "mismatched") {
    return (
      <div className="space-y-3">
        <Header tone="destructive" title={i18next.t("record:Data Verification")} subtitle={i18next.t("general:Error")} blockId={result.blockId} />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <h4 className="text-sm font-semibold">{i18next.t("provider:Chain")}</h4>
            <JsonBlock>{result.chainData}</JsonBlock>
          </div>
          <div className="min-w-0 space-y-1.5">
            <h4 className="text-sm font-semibold">{i18next.t("general:Local")}</h4>
            <JsonBlock>{result.localData}</JsonBlock>
          </div>
        </div>
        {result.differences.length > 0 ? (
          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold">{i18next.t("general:Result")}</h4>
            <ul className="space-y-2">
              {result.differences.map((diff, index) => (
                <li key={index} className="rounded-md border-l-4 border-destructive bg-destructive/5 p-2.5 text-sm">
                  <div className="mb-1.5 font-medium text-destructive">
                    {i18next.t("general:Data")} &quot;{diff.path.startsWith("value.") ? diff.path.substring(6) : diff.path}&quot;
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="rounded border border-success/40 bg-success/10 px-2 py-1">
                      {i18next.t("provider:Chain")}: {formatFieldValue(diff.chainValue)}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1">
                      {i18next.t("general:Local")}: {formatFieldValue(diff.localValue)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Header tone="warning" title={i18next.t("general:Error")} subtitle={i18next.t("general:Error")} />
      <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">
        {result.rawData || i18next.t("general:Data")}
      </pre>
    </div>
  );
}
