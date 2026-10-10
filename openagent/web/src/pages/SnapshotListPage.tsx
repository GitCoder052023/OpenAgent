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
import * as SnapshotBackend from "@/backend/SnapshotBackend";
import {Badge} from "@/components/ui/badge";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Loading} from "@/components/common/Loading";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {dateColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import * as Setting from "@/lib/setting";

function getSnapshotPath(record: any) {
  return record.action === "move" ? `${record.source} -> ${record.target}` : record.path;
}

function getActionText(action: string) {
  if (action === "write") {
    return i18next.t("store:Write");
  }
  if (action === "move") {
    return i18next.t("store:Move");
  }
  return action;
}

function getChangeTypeText(changeType: string) {
  if (changeType === "created") {
    return i18next.t("general:Created");
  }
  if (changeType === "deleted") {
    return i18next.t("general:Deleted");
  }
  if (changeType === "modified") {
    return i18next.t("general:Modified");
  }
  return changeType;
}

function StateBadge({state}: {state: string}) {
  const value = state || "Active";
  const text = value === "Active" || value === "RolledBack" ? i18next.t(`general:${value}`) : value;
  return <Badge variant={value === "RolledBack" ? "info" : "success"}>{text}</Badge>;
}

function describeSide(exists: boolean, hash: string, mode: number, size: number) {
  if (!exists) {
    return i18next.t("general:Missing");
  }
  return `${hash.slice(0, 12)} ${mode.toString(8)} ${Setting.getFriendlyFileSize(size)}`;
}

function SnapshotDetailsDialog({record, onClose}: {record: any | null; onClose: () => void}) {
  const [snapshot, setSnapshot] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!record) {
      return;
    }
    let cancelled = false;
    setSnapshot(null);
    setLoading(true);
    SnapshotBackend.getSnapshot(record.owner, record.name)
      .then((res: any) => {
        if (cancelled) {
          return;
        }
        if (res.status === "ok") {
          setSnapshot(res.data);
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        }
      })
      .catch((error: any) => {
        if (!cancelled) {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${error}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [record]);

  return (
    <Dialog open={record !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{i18next.t("general:Snapshot details")}</DialogTitle>
        </DialogHeader>
        {loading ? <Loading /> : (
          <div className="min-w-0 space-y-3">
            <div className="max-h-[50vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{i18next.t("general:Path")}</TableHead>
                    <TableHead className="w-[110px]">{i18next.t("general:Change")}</TableHead>
                    <TableHead>{i18next.t("general:Before")}</TableHead>
                    <TableHead>{i18next.t("general:After")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(snapshot?.files ?? []).map((file: any) => (
                    <TableRow key={file.path}>
                      <TableCell className="break-all font-mono text-xs">{file.path}</TableCell>
                      <TableCell><Badge variant="secondary">{getChangeTypeText(file.changeType)}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {describeSide(file.beforeExists, file.beforeHash, file.beforeMode, file.beforeSize)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {describeSide(file.afterExists, file.afterHash, file.afterMode, file.afterSize)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {snapshot?.diff ? (
              <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{snapshot.diff}</pre>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function SnapshotListPage() {
  const [detailRecord, setDetailRecord] = React.useState<any | null>(null);
  const [rollingBack, setRollingBack] = React.useState("");

  const rollback = async(record: any, refresh: () => void) => {
    setRollingBack(record.name);
    try {
      const res: any = await SnapshotBackend.rollbackSnapshot(record.owner, record.name);
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Snapshot rolled back"));
        refresh();
      } else {
        Setting.showMessage("error", `${i18next.t("general:Rollback failed")}: ${res.msg}`);
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Rollback failed")}: ${error}`);
    }
    setRollingBack("");
  };

  const columns: ColumnDef<any>[] = [
    dateColumn(),
    {
      dataIndex: "action",
      title: i18next.t("general:Action"),
      width: 100,
      filters: [
        {value: "write", label: i18next.t("store:Write")},
        {value: "move", label: i18next.t("store:Move")},
      ],
      render: (value) => <Badge variant="secondary">{getActionText(value)}</Badge>,
    },
    {
      dataIndex: "path",
      title: i18next.t("general:Path"),
      searchable: true,
      render: (_value, record) => {
        const path = getSnapshotPath(record);
        return <span className="break-all font-mono text-xs" title={path}>{Setting.getShortText(path, 96)}</span>;
      },
    },
    {dataIndex: "fileCount", title: i18next.t("general:Files"), width: 90, render: (value) => value || 0},
    {dataIndex: "state", title: i18next.t("general:State"), width: 120, render: (value) => <StateBadge state={value} />},
    {
      dataIndex: "errorText",
      title: i18next.t("message:Error text"),
      width: 220,
      render: (value) => (value ? <span className="text-destructive" title={value}>{Setting.getShortText(value, 80)}</span> : null),
    },
  ];

  return (
    <>
      <CrudListPage
        title={i18next.t("general:Snapshots")}
        columns={columns}
        fetch={(q) => SnapshotBackend.getSnapshots("admin", q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
        rowKey={(r) => r.name}
        actionColumnWidth={200}
        rowActions={(record, _index, {refresh}) => [
          {key: "details", label: i18next.t("login:Details"), onSelect: () => setDetailRecord(record)},
          record.state === "Active" ? {
            key: "rollback",
            label: i18next.t("general:Rollback"),
            loading: rollingBack === record.name,
            confirm: {title: `${i18next.t("general:Rollback snapshot")}: ${record.name}?`, confirmText: i18next.t("general:OK")},
            onSelect: () => rollback(record, refresh),
          } : null,
        ]}
      />
      <SnapshotDetailsDialog record={detailRecord} onClose={() => setDetailRecord(null)} />
    </>
  );
}
