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
import i18next from "i18next";
import dayjs from "dayjs";
import * as ToolPolicyBackend from "@/backend/ToolPolicyBackend";
import {Badge} from "@/components/ui/badge";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {dateColumn, linkColumn, valueFilters} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import * as Setting from "@/lib/setting";

export const EffectVariants: Record<string, "success" | "warning" | "destructive"> = {
  allow: "success",
  ask: "warning",
  deny: "destructive",
};

function Pattern({value}: {value: string}) {
  return <Badge variant="outline" className="font-mono">{value || "*"}</Badge>;
}

function newToolPolicy() {
  const randomName = Setting.getRandomName();
  return {
    owner: "admin",
    name: `policy_${randomName}`,
    createdTime: dayjs().format(),
    displayName: `New Policy - ${randomName}`,
    store: "*",
    subject: "*",
    tool: "*",
    category: "*",
    resource: "*",
    effect: "deny",
    priority: 100,
    state: "Active",
  };
}

export default function ToolPolicyListPage() {
  const pattern = (dataIndex: string, title: string, width = 140): ColumnDef<any> => ({
    dataIndex,
    title,
    width,
    searchable: true,
    render: (value) => <Pattern value={value} />,
  });

  const columns: ColumnDef<any>[] = [
    linkColumn({dataIndex: "name", to: (r) => `/tool-policies/${r.name}`, width: 180}),
    pattern("store", i18next.t("general:Store")),
    pattern("tool", i18next.t("general:Tool")),
    pattern("category", i18next.t("general:Category"), 120),
    pattern("resource", i18next.t("toolPolicy:Resource"), 200),
    {
      dataIndex: "effect",
      title: i18next.t("toolPolicy:Effect"),
      width: 100,
      sortable: true,
      filters: valueFilters(["allow", "ask", "deny"]),
      render: (value) => <Badge variant={EffectVariants[value] ?? "secondary"}>{value}</Badge>,
    },
    {dataIndex: "priority", title: i18next.t("toolPolicy:Priority"), width: 100, sortable: true},
    {
      dataIndex: "state",
      title: i18next.t("general:State"),
      width: 100,
      sortable: true,
      render: (value) => <Badge variant={value === "Active" ? "success" : "secondary"}>{value}</Badge>,
    },
    // not a column of the antd list, so it starts in the column menu
    {...dateColumn(), defaultHidden: true},
  ];

  return (
    <CrudListPage
      title={i18next.t("toolPolicy:Tool Permissions")}
      columns={columns}
      fetch={(q) => ToolPolicyBackend.getToolPolicies("admin", q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
      newRecord={newToolPolicy}
      editUrl={(r) => `/tool-policies/${r.name}`}
      remove={(r) => ToolPolicyBackend.deleteToolPolicy(r)}
    />
  );
}
