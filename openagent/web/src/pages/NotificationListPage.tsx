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
import {Link} from "react-router-dom";
import * as NotificationBackend from "@/backend/NotificationBackend";
import {Badge} from "@/components/ui/badge";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {dateColumn, textColumn, valueFilters} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";

const StatusVariants: Record<string, "info" | "warning" | "success" | "destructive"> = {
  Pending: "info",
  Sending: "warning",
  Sent: "success",
  Failed: "destructive",
};

export default function NotificationListPage() {
  const columns: ColumnDef<any>[] = [
    dateColumn(),
    textColumn({dataIndex: "recipient", title: i18next.t("general:Recipient"), width: 130, searchable: true}),
    textColumn({dataIndex: "actor", title: i18next.t("general:Actor"), width: 130, searchable: true}),
    {
      dataIndex: "storeName",
      title: i18next.t("general:Store"),
      width: 180,
      sortable: true,
      render: (_value, record) => (
        <Link to={`/agents/${record.storeOwner}/${record.storeName}`} className="underline-offset-4 hover:underline">
          {record.storeOwner}/{record.storeName}
        </Link>
      ),
    },
    textColumn({dataIndex: "event", title: i18next.t("general:Event"), width: 150, searchable: true}),
    textColumn({dataIndex: "title", title: i18next.t("general:Title"), width: 260, sortable: false, searchable: true}),
    {
      dataIndex: "status",
      title: i18next.t("general:Status"),
      width: 110,
      sortable: true,
      searchable: true,
      filters: valueFilters(Object.keys(StatusVariants)),
      render: (value) => <Badge variant={StatusVariants[value] ?? "secondary"}>{value}</Badge>,
    },
    {dataIndex: "retryCount", title: i18next.t("general:Retry count"), width: 110, sortable: true},
    dateColumn("sentTime", i18next.t("general:Sent time")),
    {
      dataIndex: "url",
      title: i18next.t("general:Url"),
      width: 220,
      render: (value) => (value ? (
        <Link to={value.replace(window.location.origin, "")} className="break-all underline-offset-4 hover:underline">{value}</Link>
      ) : null),
    },
    {
      dataIndex: "errorText",
      title: i18next.t("general:Error"),
      width: 260,
      render: (value) => (value ? <div className="line-clamp-2 max-w-[260px] text-destructive" title={value}>{value}</div> : null),
    },
  ];

  return (
    <CrudListPage
      title={i18next.t("general:Notifications")}
      columns={columns}
      fetch={(q) => NotificationBackend.getNotifications(q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
      showActionColumn={false}
    />
  );
}
