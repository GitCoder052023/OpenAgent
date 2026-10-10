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
import dayjs from "dayjs";
import {FileText} from "lucide-react";
import {Link} from "react-router-dom";
import * as ScaleBackend from "@/backend/ScaleBackend";
import * as TaskBackend from "@/backend/TaskBackend";
import {Badge} from "@/components/ui/badge";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {UserLabel} from "@/components/common/UserLabel";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {dateColumn, linkColumn, textColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import {TaskAnalysisReport} from "@/components/task/TaskAnalysisReport";
import * as Conf from "@/Conf";
import {useAccount} from "@/hooks/use-account";
import {formatScore, getScoreVariant, parseTaskReport} from "@/lib/task-report";
import * as Setting from "@/lib/setting";

function DocumentLink({url}: {url: string}) {
  const fileName = url.split("/").filter(Boolean).pop() || url;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" download className="inline-flex max-w-[260px] items-center gap-1.5 underline-offset-4 hover:underline">
      <FileText className={url.endsWith(".pdf") ? "h-5 w-5 shrink-0 text-red-600 dark:text-red-400" : "h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"} />
      <span className="truncate" title={fileName}>{fileName}</span>
    </a>
  );
}

export default function TaskListPage({formItems}: {formItems?: any[]} = {}) {
  const {account} = useAccount();
  const isAdmin = Setting.isAdminUser(account);
  const [publicScales, setPublicScales] = React.useState<any[]>([]);
  const [report, setReport] = React.useState<any | null>(null);

  React.useEffect(() => {
    ScaleBackend.getPublicScales().then((res: any) => {
      if (res.status === "ok" && res.data) {
        setPublicScales(res.data);
      }
    });
  }, []);

  const newTask = () => {
    const taskName = `task_${Setting.getRandomName()}`;
    return {
      owner: account?.name ?? "",
      name: taskName,
      createdTime: dayjs().format(),
      displayName: `New Task - ${taskName}`,
      provider: "provider_model_azure_gpt4",
      type: Conf.TaskMode === "Labeling" ? "Labeling" : "PBL",
      path: "F:/github_repos/casdoor-website",
      scale: "",
      example: "",
      labels: [],
      log: "",
    };
  };

  const scaleText = (scale: string) => publicScales.find((item) => `${item.owner}/${item.name}` === scale)?.text ?? "";

  let columns: ColumnDef<any>[] = [
    {dataIndex: "owner", title: i18next.t("general:User"), width: 120, sortable: true, searchable: true, render: (value) => <UserLabel user={value} />},
    linkColumn({dataIndex: "name", to: (r) => `/tasks/${r.owner}/${r.name}`, width: 180, fixed: false}),
    textColumn({dataIndex: "displayName", title: i18next.t("general:Display name"), width: 220, searchable: true}),
    dateColumn(),
    {
      dataIndex: "scale",
      title: i18next.t("task:Scale"),
      width: 160,
      sortable: true,
      searchable: true,
      render: (value) => {
        if (!value) {
          return null;
        }
        const link = <Link to={`/scales/${value}`} className="underline-offset-4 hover:underline">{value.includes("/") ? value.split("/").slice(1).join("/") : value}</Link>;
        const text = scaleText(value);
        if (!text) {
          return link;
        }
        return (
          <span className="inline-flex items-center gap-1">
            {link}
            <Popover>
              <PopoverTrigger className="text-xs text-muted-foreground underline-offset-2 hover:underline">{i18next.t("general:Preview")}</PopoverTrigger>
              <PopoverContent side="left" className="max-h-[50vh] w-[50vw] overflow-auto whitespace-pre-wrap text-sm">{text}</PopoverContent>
            </Popover>
          </span>
        );
      },
    },
    {
      dataIndex: "documentUrl",
      title: i18next.t("store:File"),
      sortable: true,
      searchable: true,
      render: (value) => (value ? <DocumentLink url={value} /> : null),
    },
    {
      dataIndex: "result",
      title: i18next.t("task:Report"),
      width: 110,
      // the report sorts by its score, which the list API knows as "score"
      sortable: true,
      render: (_value, record) => {
        const parsed = parseTaskReport(record.result);
        if (!parsed) {
          return null;
        }
        const label = formatScore(record.score);
        return (
          <button type="button" onClick={() => setReport({record, parsed})}>
            {label ? (
              <Badge variant={getScoreVariant(record.score)} className="min-w-10 justify-center px-2.5 py-1 text-base tabular-nums">{label}</Badge>
            ) : (
              <span className="font-semibold underline-offset-4 hover:underline">
                {parsed.score !== null && parsed.score !== undefined ? `${parsed.score}${i18next.t("task:Score Unit")}` : i18next.t("task:Report")}
              </span>
            )}
          </button>
        );
      },
    },
    {dataIndex: "example", title: i18next.t("task:Example"), width: 160, sortable: true, searchable: true, render: (value) => (value ? Setting.getShortText(value, 40) : null)},
    {
      dataIndex: "labels",
      title: i18next.t("task:Labels"),
      width: 200,
      render: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {(value ?? []).map((label) => <Badge key={label} variant="info">{label}</Badge>)}
        </div>
      ),
    },
  ];

  // the model and the scale are an admin's business; labels only mean something in labeling mode
  if (!isAdmin) {
    columns = columns.filter((column) => !["provider", "type", "scale"].includes(column.dataIndex));
  }
  if (Conf.TaskMode !== "Labeling") {
    columns = columns.filter((column) => !["displayName", "example", "labels"].includes(column.dataIndex));
  }

  return (
    <>
      <CrudListPage
        title={i18next.t("general:Tasks")}
        columns={columns}
        formItems={formItems}
        fetch={(q) => TaskBackend.getTasks(account?.name ?? "", q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField === "result" ? "score" : q.sortField, q.sortOrder)}
        deps={[account?.name]}
        initialQuery={{pageSize: 100}}
        rowKey={(r) => `${r.owner}/${r.name}`}
        newRecord={newTask}
        add={(r) => TaskBackend.addTask(r)}
        editUrl={(r) => `/tasks/${r.owner}/${r.name}`}
        remove={(r) => TaskBackend.deleteTask(r)}
      />
      <Dialog open={report !== null} onOpenChange={(open) => !open && setReport(null)}>
        <DialogContent className="max-h-[90vh] max-w-[90vw] overflow-auto">
          <DialogHeader>
            <DialogTitle>{report ? `${i18next.t("task:Report")} - ${report.record.displayName || report.record.name}` : ""}</DialogTitle>
          </DialogHeader>
          {report ? <TaskAnalysisReport result={report.parsed} downloadFileName={`${report.record.owner}_${report.record.name}_report.docx`} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
