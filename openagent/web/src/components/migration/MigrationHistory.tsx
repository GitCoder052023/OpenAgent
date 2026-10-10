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
import * as MigrationBackend from "@/backend/MigrationBackend";
import {Badge} from "@/components/ui/badge";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {DataTable} from "@/components/crud/DataTable";
import {RowActions} from "@/components/crud/RowActions";
import type {ColumnDef, TableQuery} from "@/components/crud/types";
import {MigrationItemsTable} from "@/components/migration/MigrationCommon";
import {queryRows} from "@/lib/client-table";
import * as Setting from "@/lib/setting";

function StatusBadge({record}: {record: any}) {
  if (record.isRolledBack) {
    return <Badge variant="secondary">{i18next.t("migration:Rolled back")}</Badge>;
  }
  if (record.status === "Error") {
    return <Badge variant="destructive">{i18next.t("application:Failed")}</Badge>;
  }
  if (record.status === "Running") {
    return <Badge variant="info">{i18next.t("application:Running")}</Badge>;
  }
  return <Badge variant="success">{i18next.t("chat:Done")}</Badge>;
}

/**
 * Past runs, each of which can be undone. Rolling back deletes what the run
 * created; what it overwrote is gone for good, which the server reports back as notes.
 */
export function MigrationHistory({refreshKey}: {refreshKey: number}) {
  const [migrations, setMigrations] = React.useState<any[] | null>(null);
  const [rollingBack, setRollingBack] = React.useState("");
  const [detail, setDetail] = React.useState<any | null>(null);
  const [query, setQueryState] = React.useState<TableQuery>({page: 1, pageSize: 10, sortField: "", sortOrder: "", searchText: "", searchedColumn: ""});

  const fetchMigrations = React.useCallback(() => {
    MigrationBackend.getMigrations().then((res: any) => {
      if (res.status === "ok") {
        setMigrations(res.data ?? []);
      } else {
        setMigrations([]);
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    });
  }, []);

  React.useEffect(() => {
    fetchMigrations();
  }, [fetchMigrations, refreshKey]);

  const rollback = async(migration: any) => {
    setRollingBack(migration.name);
    try {
      const res: any = await MigrationBackend.rollbackMigration(migration.owner, migration.name);
      const notes: string[] = res.data ?? [];
      if (res.status !== "ok") {
        Setting.showMessage("error", `${i18next.t("migration:Failed to roll back")}: ${res.msg}`);
      } else if (notes.length > 0) {
        Setting.showMessage("warning", `${i18next.t("migration:Rolled back, with some items left behind")}: ${notes.join("; ")}`);
      } else {
        Setting.showMessage("success", i18next.t("migration:Rolled back"));
      }
      fetchMigrations();
    } finally {
      setRollingBack("");
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      dataIndex: "source",
      title: i18next.t("migration:Source"),
      width: 160,
      render: (value, record) => (
        <span className="inline-flex items-center gap-2">
          {value}
          {record.sourceVersion ? <Badge variant="outline" className="font-normal">{record.sourceVersion}</Badge> : null}
        </span>
      ),
    },
    {dataIndex: "startedTime", title: i18next.t("migration:Started"), width: 200, render: (value) => <span className="tabular-nums">{value}</span>},
    {dataIndex: "status", title: i18next.t("general:Status"), width: 130, render: (_value, record) => <StatusBadge record={record} />},
    {dataIndex: "items", title: i18next.t("migration:Imported"), width: 110, render: (value) => <span className="tabular-nums">{(value ?? []).length}</span>},
    {dataIndex: "sourcePath", title: i18next.t("general:Path"), render: (value) => (value ? <span className="break-all text-muted-foreground">{value}</span> : "-")},
    {
      dataIndex: "op",
      title: i18next.t("general:Action"),
      width: 220,
      align: "right",
      render: (_value, record) => (
        <RowActions
          actions={[
            (record.items ?? []).length > 0 ? {key: "details", label: i18next.t("login:Details"), onSelect: () => setDetail(record)} : null,
            {
              key: "rollback",
              label: i18next.t("migration:Roll back"),
              destructive: true,
              disabled: record.isRolledBack,
              loading: rollingBack === record.name,
              confirm: {
                title: i18next.t("migration:Undo this migration?"),
                description: i18next.t("migration:Entities this run created will be deleted. Entities it replaced cannot be restored."),
                confirmText: i18next.t("general:OK"),
              },
              onSelect: () => rollback(record),
            },
          ]}
        />
      ),
    },
  ];

  const {rows, total} = queryRows(migrations ?? [], query);

  return (
    <>
      <DataTable
        columns={columns}
        rows={migrations === null ? null : rows}
        total={total}
        loading={migrations === null}
        query={query}
        onQueryChange={(patch) => setQueryState((prev) => ({...prev, ...patch}))}
        rowKey={(row) => row.name}
      />
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detail ? `${detail.source} · ${detail.startedTime}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] min-w-0 overflow-auto">
            {/* a rolled-back run's entities are gone, so its names no longer link anywhere */}
            {detail ? <MigrationItemsTable items={detail.items ?? []} linked={!detail.isRolledBack} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
