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
import dayjs from "dayjs";
import * as ScaleBackend from "@/backend/ScaleBackend";
import {Badge} from "@/components/ui/badge";
import {UserLabel} from "@/components/common/UserLabel";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {dateColumn, linkColumn, textColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import {useAccount} from "@/hooks/use-account";
import * as Setting from "@/lib/setting";

export default function ScaleListPage() {
  const {account} = useAccount();

  const newScale = () => {
    const randomName = Setting.getRandomName();
    return {
      owner: account?.name ?? "",
      name: `scale_${randomName}`,
      createdTime: dayjs().format(),
      displayName: `New Scale - scale_${randomName}`,
      text: "",
      state: "Public",
    };
  };

  const columns: ColumnDef<any>[] = [
    {dataIndex: "owner", title: i18next.t("general:User"), width: 120, sortable: true, searchable: true, render: (value) => <UserLabel user={value} />},
    linkColumn({dataIndex: "name", to: (r) => `/scales/${r.owner}/${r.name}`, width: 180, fixed: false}),
    textColumn({dataIndex: "displayName", title: i18next.t("general:Display name"), width: 220, searchable: true}),
    dateColumn(),
    {
      dataIndex: "state",
      title: i18next.t("general:State"),
      width: 100,
      sortable: true,
      render: (value) => (value === "Hidden"
        ? <Badge variant="warning">{i18next.t("video:Hidden")}</Badge>
        : <Badge variant="success">{i18next.t("video:Public")}</Badge>),
    },
    {dataIndex: "text", title: i18next.t("general:Text"), width: 240, render: (value) => (value ? Setting.getShortText(value, 80) : null)},
  ];

  return (
    <CrudListPage
      title={i18next.t("general:Scales")}
      columns={columns}
      fetch={(q) => ScaleBackend.getScales(account?.name ?? "", q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
      deps={[account?.name]}
      initialQuery={{pageSize: 100}}
      newRecord={newScale}
      add={(r) => ScaleBackend.addScale(r)}
      editUrl={(r) => `/scales/${r.owner}/${r.name}`}
      remove={(r) => ScaleBackend.deleteScale(r)}
    />
  );
}
