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
import {Link, useSearchParams} from "react-router-dom";
import * as VectorBackend from "@/backend/VectorBackend";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {CodeEditor} from "@/components/common/CodeEditor";
import {ConfirmButton} from "@/components/common/ConfirmButton";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {linkColumn, textColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import {useAccount} from "@/hooks/use-account";
import {useRequestStore} from "@/hooks/use-request-store";
import * as Setting from "@/lib/setting";

function TextCell({text}: {text: string}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="max-w-[200px] text-left underline-offset-4 hover:underline">
          {Setting.getShortText(text, 60)}
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" className="w-[800px] max-w-[90vw] p-2">
        <CodeEditor value={text ?? ""} height={300} readOnly />
      </PopoverContent>
    </Popover>
  );
}

/** `formItems` is how the Form editor previews the columns it is editing. */
export default function VectorListPage({formItems}: {formItems?: any[]} = {}) {
  const {account} = useAccount();
  const store = useRequestStore();
  const [searchParams] = useSearchParams();
  // the file tree links here with ?file= to show one file's chunks
  const fileFilter = searchParams.get("file") ?? "";

  const newVector = () => {
    const randomName = Setting.getRandomName();
    return {
      owner: "admin",
      name: `vector_${randomName}`,
      createdTime: dayjs().format(),
      displayName: `New Vector - ${randomName}`,
      store: store || (Setting.isDefaultStoreSelected(account) ? "store-built-in" : ""),
      file: "/aaa/openagent.txt",
      text: "The text of vector",
      data: [0.1, 0.2, 0.3],
    };
  };

  const columns: ColumnDef<any>[] = [
    {
      dataIndex: "store",
      title: i18next.t("general:Store"),
      width: 130,
      sortable: true,
      searchable: true,
      link: (value, record) => (value ? `/stores/${record.owner}/${value}` : undefined),
    },
    linkColumn({dataIndex: "name", to: (r) => `/vectors/${r.name}`, width: 140, fixed: false}),
    {
      dataIndex: "provider",
      title: i18next.t("general:Provider"),
      width: 200,
      sortable: true,
      searchable: true,
      render: (value) => (value ? <Link to={`/providers/${value}`} className="underline-offset-4 hover:underline">{value}</Link> : null),
    },
    textColumn({dataIndex: "file", title: i18next.t("store:File"), width: 200, searchable: true}),
    {dataIndex: "index", title: i18next.t("vector:Index"), width: 80, sortable: true, className: "tabular-nums"},
    {dataIndex: "text", title: i18next.t("general:Text"), width: 200, sortable: true, searchable: true, render: (value) => <TextCell text={value} />},
    {dataIndex: "size", title: i18next.t("general:Size"), width: 80, sortable: true, className: "tabular-nums"},
    {
      dataIndex: "data",
      title: i18next.t("general:Data"),
      width: 200,
      render: (value) => {
        const json = JSON.stringify(value);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block max-w-[200px] truncate font-mono text-xs">{Setting.getShortText(json, 50)}</span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xl break-all font-mono text-xs">{Setting.getShortText(json, 1000)}</TooltipContent>
          </Tooltip>
        );
      },
    },
    {dataIndex: "dimension", title: i18next.t("vector:Dimension"), width: 90, sortable: true, className: "tabular-nums"},
  ];

  const deleteAll = async(refresh: () => void) => {
    try {
      const res: any = await VectorBackend.deleteAllVectors();
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Successfully deleted"));
        refresh();
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to delete")}: ${res.msg}`);
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to delete")}: ${error}`);
    }
  };

  return (
    <CrudListPage
      formType="vectors"
      title={i18next.t("general:Vectors")}
      description={fileFilter ? fileFilter : undefined}
      columns={columns}
      formItems={formItems}
      fetch={(q) => VectorBackend.getVectors("admin", store, q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
      deps={[store]}
      initialQuery={fileFilter ? {searchedColumn: "file", searchText: fileFilter} : undefined}
      rowKey={(r) => r.name}
      newRecord={newVector}
      add={(r) => VectorBackend.addVector(r)}
      editUrl={(r) => `/vectors/${r.name}`}
      remove={(r) => VectorBackend.deleteVector(r)}
      toolbar={({refresh}) => (
        <ConfirmButton
          variant="outline"
          className="text-destructive hover:text-destructive"
          title={`${i18next.t("general:Sure to delete all")} ${i18next.t("general:Vectors")}?`}
          confirmText={i18next.t("general:OK")}
          onConfirm={() => deleteAll(refresh)}
        >
          {i18next.t("general:Delete All")}
        </ConfirmButton>
      )}
    />
  );
}
