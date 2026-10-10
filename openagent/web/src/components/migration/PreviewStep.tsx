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
import {KeyRound, TriangleAlert} from "lucide-react";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Checkbox} from "@/components/ui/checkbox";
import {Label} from "@/components/ui/label";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {DataTable} from "@/components/crud/DataTable";
import type {ColumnDef, TableQuery} from "@/components/crud/types";
import {queryRows} from "@/lib/client-table";
import {ActionBadge, CategoryBadge, countApplicable, getCategoryLabel} from "@/components/migration/MigrationCommon";

export interface MigrationOptions {
  conflictPolicy: string;
  includeSkills: boolean;
  includeProviders: boolean;
  includeMcpServers: boolean;
  includeAgents: boolean;
  includeChats: boolean;
}

export interface PreviewStepProps {
  plan: any;
  options: MigrationOptions;
  setOptions: (options: MigrationOptions) => void;
  selectedKeys: string[];
  setSelectedKeys: (keys: string[]) => void;
  replanning: boolean;
  starting: boolean;
  onBack: () => void;
  onStart: () => void;
}

/** The dry run: every row the migration would write, its name on the OpenAgent side, and why anything is skipped. */
export function PreviewStep({plan, options, setOptions, selectedKeys, setSelectedKeys, replanning, starting, onBack, onStart}: PreviewStepProps) {
  const [query, setQueryState] = React.useState<TableQuery>({page: 1, pageSize: 20, sortField: "", sortOrder: "", searchText: "", searchedColumn: ""});
  const items: any[] = plan.items ?? [];
  const warnings: any[] = plan.warnings ?? [];
  const applicable = countApplicable(items, selectedKeys);
  const skipKeys = new Set(items.filter((item) => item.action === "skip").map((item) => item.key));
  const {rows, total} = queryRows(items, query);

  const setOption = (key: keyof MigrationOptions, value: any) => setOptions({...options, [key]: value});

  const columns: ColumnDef<any>[] = [
    {
      dataIndex: "category",
      title: i18next.t("general:Category"),
      width: 130,
      filters: [...new Set(items.map((item) => item.category))].map((category) => ({value: category, label: getCategoryLabel(category)})),
      render: (value) => <CategoryBadge category={value} />,
    },
    {
      dataIndex: "sourceName",
      title: i18next.t("migration:From"),
      render: (value, record) => (
        <span className="inline-flex items-center gap-2">
          {value}
          {record.displayName && record.displayName !== value ? <span className="text-muted-foreground">{record.displayName}</span> : null}
          {record.secrets ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <KeyRound className="h-3.5 w-3.5 text-warning" />
              </TooltipTrigger>
              <TooltipContent>{i18next.t("migration:This item carries an API key or token, which will be copied into OpenAgent.")}</TooltipContent>
            </Tooltip>
          ) : null}
        </span>
      ),
    },
    {
      dataIndex: "targetName",
      title: i18next.t("migration:To"),
      render: (value) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{value}</code>,
    },
    {
      dataIndex: "action",
      title: i18next.t("general:Action"),
      width: 120,
      render: (value, record) => (selectedKeys.includes(record.key)
        ? <ActionBadge action={value} />
        : <Badge variant="outline" className="font-normal">{i18next.t("migration:Not selected")}</Badge>),
    },
    {
      dataIndex: "count",
      title: i18next.t("general:Size"),
      width: 110,
      render: (value, record) => {
        if (!value) {
          return "-";
        }
        return record.category === "chat" ? i18next.t("migration:{count} messages").replace("{count}", value) : value;
      },
    },
    {
      dataIndex: "reason",
      title: i18next.t("migration:Note"),
      render: (value) => (value ? <span className="text-muted-foreground">{value}</span> : "-"),
    },
  ];

  const includeOptions: [keyof MigrationOptions, string][] = [
    ["includeSkills", i18next.t("general:Skills")],
    ["includeProviders", i18next.t("general:Providers")],
    ["includeMcpServers", i18next.t("general:MCP Servers")],
    ["includeAgents", i18next.t("general:Agents")],
    ["includeChats", i18next.t("migration:Chat history")],
  ];

  const facts: [string, string][] = [
    [i18next.t("migration:Source"), plan.source],
    [i18next.t("migration:Version"), plan.sourceVersion || "-"],
    [i18next.t("general:Path"), plan.sourcePath || "-"],
    [i18next.t("general:Owner"), plan.owner],
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <span className="text-muted-foreground">{label}: </span>
              <span className="break-all">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(plan.summary ?? []).map((summary: any) => (
          <Card key={summary.category}>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{getCategoryLabel(summary.category)}</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tabular-nums">{summary.create + summary.overwrite}</span>
                {summary.skip > 0 ? <span className="text-xs text-muted-foreground">{`+${summary.skip} ${i18next.t("migration:skipped")}`}</span> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className={replanning ? "pointer-events-none opacity-60" : undefined}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{i18next.t("migration:What to import")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {includeOptions.map(([key, label]) => (
              <Label key={key} className="flex cursor-pointer items-center gap-2 font-normal">
                <Checkbox checked={Boolean(options[key])} onCheckedChange={(checked) => setOption(key, checked === true)} />
                {label}
              </Label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">{i18next.t("migration:When a name already exists")}</span>
            <Tabs value={options.conflictPolicy} onValueChange={(value) => setOption("conflictPolicy", value)}>
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="rename">{i18next.t("migration:Import under a new name")}</TabsTrigger>
                <TabsTrigger value="skip">{i18next.t("migration:Keep what OpenAgent has")}</TabsTrigger>
                <TabsTrigger value="overwrite">{i18next.t("migration:Replace it")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {warnings.length > 0 ? (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>{i18next.t("migration:{count} things could not be mapped").replace("{count}", String(warnings.length))}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {warnings.map((warning, index) => (
                <li key={index}>
                  <span className="font-medium">{warning.category}</span>
                  {warning.item ? ` ${warning.item}` : ""}
                  {`: ${warning.reason}`}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        loading={replanning}
        query={query}
        onQueryChange={(patch) => setQueryState((prev) => ({...prev, ...patch, page: patch.page ?? (patch.searchText !== undefined ? 1 : prev.page)}))}
        rowKey={(row) => row.key}
        selection={{
          selected: new Set(selectedKeys),
          // a row the plan skips has nothing to write, so it cannot be ticked
          onChange: (selected) => setSelectedKeys([...selected].filter((key) => !skipKeys.has(key))),
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="lg" onClick={onBack}>{i18next.t("migration:Back")}</Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {i18next.t("migration:{count} items will be imported").replace("{count}", String(applicable))}
          </span>
          <Button size="lg" loading={starting} disabled={applicable === 0} onClick={onStart}>
            {i18next.t("migration:Start migration")}
          </Button>
        </div>
      </div>
    </div>
  );
}
