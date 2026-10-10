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
import {Link} from "react-router-dom";
import {Badge} from "@/components/ui/badge";
import {DataTable} from "@/components/crud/DataTable";
import type {ColumnDef, TableQuery} from "@/components/crud/types";
import {queryRows} from "@/lib/client-table";

/** The five categories a bundle can carry, in the order they are applied. */
export const MigrationCategories = ["skill", "provider", "server", "agent", "chat"];

/**
 * Each category maps onto one OpenAgent entity with its own admin page, so an
 * imported row links straight to what it created.
 */
const categoryMeta: Record<string, {label: string; path: (name: string) => string}> = {
  skill: {label: "general:Skills", path: (name) => `/skills/${name}`},
  provider: {label: "general:Providers", path: (name) => `/providers/${name}`},
  server: {label: "general:MCP Servers", path: (name) => `/servers/${name}`},
  agent: {label: "general:Agents", path: (name) => `/stores/admin/${name}`},
  chat: {label: "general:Chats", path: (name) => `/chats/${name}`},
};

export function getCategoryLabel(category: string) {
  const meta = categoryMeta[category];
  return meta ? i18next.t(meta.label) : category;
}

export function getCategoryPath(category: string, name: string) {
  return categoryMeta[category]?.path(name) ?? null;
}

export function CategoryBadge({category}: {category: string}) {
  return <Badge variant="outline" className="font-normal">{getCategoryLabel(category)}</Badge>;
}

export function ActionBadge({action}: {action: string}) {
  if (action === "create") {
    return <Badge variant="success">{i18next.t("migration:Create")}</Badge>;
  }
  if (action === "overwrite") {
    return <Badge variant="warning">{i18next.t("migration:Overwrite")}</Badge>;
  }
  return <Badge variant="secondary">{i18next.t("general:Skip")}</Badge>;
}

/** What a run would actually write: rows the plan is not skipping, minus the ones unticked. */
export function countApplicable(items: any[] | undefined, selectedKeys: string[]) {
  return (items ?? []).filter((item) => item.action !== "skip" && selectedKeys.includes(item.key)).length;
}

export function TargetName({category, name, linked = true}: {category: string; name: string; linked?: boolean}) {
  const path = linked ? getCategoryPath(category, name) : null;
  return path
    ? <Link to={path} className="underline-offset-4 hover:underline">{name}</Link>
    : <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{name}</code>;
}

/** The imported-items table of a run: category, source name, what it became, and how. */
export function MigrationItemsTable({items, linked = true}: {items: any[]; linked?: boolean}) {
  const [query, setQueryState] = React.useState<TableQuery>({page: 1, pageSize: 20, sortField: "", sortOrder: "", searchText: "", searchedColumn: ""});
  const {rows, total} = queryRows(items, query);
  const columns: ColumnDef<any>[] = [
    {dataIndex: "category", title: i18next.t("general:Category"), width: 130, render: (value) => <CategoryBadge category={value} />},
    {dataIndex: "sourceName", title: i18next.t("migration:From")},
    {dataIndex: "targetName", title: i18next.t("migration:To"), render: (value, record) => <TargetName category={record.category} name={value} linked={linked} />},
    {dataIndex: "action", title: i18next.t("general:Action"), width: 120, render: (value) => <ActionBadge action={value} />},
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      total={total}
      query={query}
      onQueryChange={(patch) => setQueryState((prev) => ({...prev, ...patch}))}
      rowKey={(row) => row.key}
    />
  );
}
