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
import * as SessionBackend from "@/backend/SessionBackend";
import {Badge} from "@/components/ui/badge";
import {UserLabel} from "@/components/common/UserLabel";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {dateColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import {useAccount} from "@/hooks/use-account";
import * as Setting from "@/lib/setting";

export default function SessionListPage() {
  const {account} = useAccount();
  const profileUrl = Setting.getMyProfileUrl(account);

  const columns: ColumnDef<any>[] = [
    {
      dataIndex: "name",
      title: i18next.t("general:Name"),
      width: 150,
      fixed: "left",
      sortable: true,
      searchable: true,
      render: (value) => <UserLabel user={value} />,
    },
    {
      dataIndex: "owner",
      title: i18next.t("general:Organization"),
      width: 110,
      sortable: true,
      searchable: true,
      render: (value) => (profileUrl ? (
        <a href={profileUrl.replace("/account", `/organizations/${value}`)} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
          {value}
        </a>
      ) : value),
    },
    dateColumn(),
    {
      dataIndex: "sessionId",
      title: i18next.t("general:ID"),
      width: 180,
      sortable: true,
      render: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {(value ?? []).map((item, index) => <Badge key={index} variant="secondary" className="font-mono font-normal">{item}</Badge>)}
        </div>
      ),
    },
  ];

  return (
    <CrudListPage
      title={i18next.t("general:Sessions")}
      columns={columns}
      fetch={(q) => SessionBackend.getSessions(Setting.getRequestOrganization(account), q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
      deps={[account?.owner]}
      remove={(r) => SessionBackend.deleteSession(r)}
      actionColumnWidth={100}
    />
  );
}
