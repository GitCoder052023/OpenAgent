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
import * as PipeBackend from "@/backend/PipeBackend";
import {Badge} from "@/components/ui/badge";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {boolColumn, dateColumn, linkColumn, textColumn, valueFilters} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import {clientPaged} from "@/lib/client-table";
import * as ProviderSetting from "@/lib/provider-setting";
import * as Setting from "@/lib/setting";

export const PipeTypes = [
  "Telegram", "Discord", "WhatsApp", "Slack", "Facebook Messenger", "Threads", "WeChat", "Weixin Claw", "Snapchat", "X Direct Messages",
];

export function PipeTypeLabel({type}: {type: string}) {
  const logo = ProviderSetting.getProviderLogoURL({category: "Chat", type});
  return (
    <span className="inline-flex items-center gap-1.5">
      {logo ? <img src={logo} alt={type} className="h-5 w-5" /> : null}
      {type}
    </span>
  );
}

function newPipe() {
  const randomName = Setting.getRandomName();
  return {
    owner: "admin",
    name: `pipe_${randomName}`,
    createdTime: dayjs().format(),
    displayName: `New Pipe - ${randomName}`,
    type: "Telegram",
    token: "",
    secretKey: "",
    store: "",
    domain: "",
    isDefault: false,
    state: "Active",
  };
}

export default function PipeListPage() {
  const columns: ColumnDef<any>[] = [
    linkColumn({dataIndex: "name", to: (r) => `/pipes/${r.name}`, width: 180}),
    textColumn({dataIndex: "displayName", title: i18next.t("general:Display name"), searchable: true, width: 200}),
    {
      dataIndex: "type",
      title: i18next.t("general:Type"),
      width: 180,
      sortable: true,
      filters: valueFilters(PipeTypes),
      render: (value) => (value ? <PipeTypeLabel type={value} /> : null),
    },
    textColumn({dataIndex: "domain", title: i18next.t("provider:Domain"), width: 220}),
    boolColumn({dataIndex: "isDefault", title: i18next.t("store:Is default")}),
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
      title={i18next.t("general:Pipes")}
      columns={columns}
      fetch={(q) => clientPaged(PipeBackend.getPipes("admin"), q)}
      newRecord={newPipe}
      editUrl={(r) => `/pipes/${r.name}`}
      remove={(r) => PipeBackend.deletePipe(r)}
    />
  );
}
