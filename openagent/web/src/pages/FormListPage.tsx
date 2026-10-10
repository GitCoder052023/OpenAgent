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
import * as FormBackend from "@/backend/FormBackend";
import {Badge} from "@/components/ui/badge";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {linkColumn, textColumn, urlColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import {useAccount} from "@/hooks/use-account";
import {getFormTypeOptions} from "@/lib/form-types";
import * as Setting from "@/lib/setting";

export default function FormListPage() {
  const {account} = useAccount();
  const owner = account?.owner ?? "";

  const newForm = () => {
    const randomName = Setting.getRandomName();
    return {
      owner,
      name: `form_${randomName}`,
      createdTime: dayjs().format(),
      displayName: `New Form - ${randomName}`,
      position: "1",
      category: "Table",
      url: "",
      formItems: [],
    };
  };

  const columns: ColumnDef<any>[] = [
    linkColumn({dataIndex: "name", to: (r) => `/forms/${r.name}`, width: 160}),
    textColumn({dataIndex: "displayName", title: i18next.t("general:Display name"), width: 200, searchable: true}),
    textColumn({dataIndex: "position", title: i18next.t("form:Position"), width: 90}),
    textColumn({dataIndex: "category", title: i18next.t("general:Category"), width: 110, searchable: true}),
    {
      dataIndex: "type",
      title: i18next.t("general:Type"),
      width: 120,
      sortable: true,
      searchable: true,
      render: (value) => {
        const option = getFormTypeOptions().find((item) => item.id === value);
        return option ? i18next.t(option.name) : value;
      },
    },
    urlColumn({dataIndex: "url", title: i18next.t("general:URL"), width: 220}),
    {
      dataIndex: "formItems",
      title: i18next.t("form:Form items"),
      searchable: true,
      render: (value: any[]) => {
        const visible = (value ?? []).filter((item) => item.visible !== false);
        if (visible.length === 0) {
          return <span className="text-muted-foreground">({i18next.t("general:empty")})</span>;
        }
        return (
          <div className="flex max-w-[480px] flex-wrap gap-1">
            {visible.map((item, index) => <Badge key={`${item.name}-${index}`} variant="secondary" className="font-normal">{i18next.t(item.label)}</Badge>)}
          </div>
        );
      },
    },
  ];

  return (
    <CrudListPage
      title={i18next.t("general:Forms")}
      columns={columns}
      fetch={(q) => FormBackend.getForms(owner, q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
      deps={[owner]}
      rowKey={(r) => r.name}
      newRecord={newForm}
      add={(r) => FormBackend.addForm(r)}
      editUrl={(r) => `/forms/${r.name}`}
      remove={(r) => FormBackend.deleteForm(r)}
    />
  );
}
