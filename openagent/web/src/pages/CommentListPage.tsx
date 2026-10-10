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
import * as CommentBackend from "@/backend/CommentBackend";
import {UserLabel} from "@/components/common/UserLabel";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {dateColumn, linkColumn, textColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import {truncateCommentText} from "@/lib/comment-content";

export default function CommentListPage() {
  const columns: ColumnDef<any>[] = [
    {
      dataIndex: "owner",
      title: i18next.t("general:Owner"),
      width: 120,
      fixed: "left",
      sortable: true,
      searchable: true,
      render: (value) => <UserLabel user={value} />,
    },
    linkColumn({dataIndex: "name", to: (r) => `/comments/${r.owner}/${r.name}`, width: 120, fixed: false}),
    dateColumn(),
    textColumn({dataIndex: "targetType", title: i18next.t("comment:Target type"), width: 110, searchable: true}),
    {
      dataIndex: "targetKey",
      title: i18next.t("comment:Target key"),
      width: 180,
      sortable: true,
      searchable: true,
      render: (value, record) => (record.targetType === "agenthub" ? (
        <Link to={`/agents/${value}`} className="underline-offset-4 hover:underline">{value}</Link>
      ) : value),
    },
    {
      dataIndex: "content",
      title: i18next.t("general:Content"),
      searchable: true,
      render: (value) => truncateCommentText(value, 80),
    },
  ];

  return (
    <CrudListPage
      title={i18next.t("general:Comments")}
      columns={columns}
      fetch={(q) => CommentBackend.getGlobalComments(q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
      editUrl={(r) => `/comments/${r.owner}/${r.name}`}
      remove={(r) => CommentBackend.deleteComment(r.owner, r.name)}
    />
  );
}
