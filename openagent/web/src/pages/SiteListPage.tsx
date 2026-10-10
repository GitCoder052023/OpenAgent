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
import * as SiteBackend from "@/backend/SiteBackend";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {dateColumn, linkColumn, textColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import {clientPaged} from "@/lib/client-table";

export default function SiteListPage() {
  const columns: ColumnDef<any>[] = [
    linkColumn({dataIndex: "name", to: (r) => `/sites/${r.name}`, width: 200}),
    textColumn({dataIndex: "displayName", title: i18next.t("general:Display name"), width: 200, searchable: true}),
    {
      dataIndex: "themeColor",
      title: i18next.t("store:Theme color"),
      width: 140,
      render: (value) => (value ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 rounded-sm border" style={{backgroundColor: value}} />
          <span className="font-mono text-xs">{value}</span>
        </span>
      ) : null),
    },
    dateColumn(),
  ];

  // a site is only ever the built-in one; adding more is not supported yet, as in the antd page
  return (
    <CrudListPage
      title={i18next.t("general:Sites")}
      columns={columns}
      fetch={(q) => clientPaged(SiteBackend.getGlobalSites(), q)}
      editUrl={(r) => `/sites/${r.name}`}
      remove={(r) => SiteBackend.deleteSite(r)}
      deleteDisabled={(r) => r.name === "site-built-in"}
      rowKey={(r) => r.name}
    />
  );
}
