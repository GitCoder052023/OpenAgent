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
import {useParams} from "react-router-dom";
import * as FormBackend from "@/backend/FormBackend";
import * as FormDataBackend from "@/backend/FormDataBackend";
import {Loading} from "@/components/common/Loading";
import {CrudListPage} from "@/components/crud/CrudListPage";
import type {ColumnDef} from "@/components/crud/types";
import {useAccount} from "@/hooks/use-account";
import * as Setting from "@/lib/setting";

/** A "Table" Form's rows, in the columns the Form defines. */
function FormDataTable({form}: {form: any}) {
  const {account} = useAccount();
  const columns: ColumnDef<any>[] = (form.formItems ?? []).map((item: any) => ({
    dataIndex: item.name,
    title: item.label,
    width: item.width ? Number(item.width) || item.width : undefined,
    sortable: true,
  }));

  return (
    <CrudListPage
      title={form.displayName || form.name}
      columns={columns}
      fetch={(q) => FormDataBackend.getFormData(account?.name ?? "", form.name, q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
      deps={[form.name]}
      rowKey={(row, index) => row.name ?? String(index)}
      // the form's own columns are the whole table; no saved Form customizes this one
      formItems={[]}
      showActionColumn={false}
    />
  );
}

/** What a Form shows its users: its data table, or the page it embeds. */
export default function FormDataPage() {
  const {formName = ""} = useParams();
  const {account} = useAccount();
  const [form, setForm] = React.useState<any>(null);

  React.useEffect(() => {
    if (!account) {
      return;
    }
    FormBackend.getForm(account.owner, formName).then((res: any) => {
      if (res.status === "ok") {
        setForm(res.data);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    });
  }, [account, formName]);

  if (!form) {
    return <Loading className="min-h-[60vh]" />;
  }
  if (form.category === "Table" || form.category === "") {
    return <FormDataTable form={form} />;
  }
  if (form.category === "iFrame") {
    return <iframe title="formData" src={form.url} className="h-[calc(100vh-134px)] w-full border-0" />;
  }
  return <div className="text-sm text-muted-foreground">{`Unsupported form category: ${form.category}`}</div>;
}
