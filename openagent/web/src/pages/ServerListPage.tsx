// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
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
import {Radar, Store} from "lucide-react";
import {Link} from "react-router-dom";
import * as ServerBackend from "@/backend/ServerBackend";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {dateColumn, linkColumn, textColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import * as Setting from "@/lib/setting";

export function newServer(patch: Record<string, any> = {}) {
  const randomName = Setting.getRandomName();
  return {
    owner: "admin",
    name: `server_${randomName}`,
    createdTime: dayjs().format(),
    displayName: `New MCP Server - ${randomName}`,
    transport: "streamablehttp",
    url: "",
    testContent: "",
    isDefault: false,
    ...patch,
  };
}

interface ScanResult {
  scannedHosts?: number;
  onlineHosts?: string[];
  servers?: {host: string; port: number | string; path: string; url: string}[];
}

/** Probes an intranet range for MCP servers and adds the ones found. */
function ScanServerDialog({open, onOpenChange, onAdded}: {open: boolean; onOpenChange: (open: boolean) => void; onAdded: () => void}) {
  const [cidr, setCidr] = React.useState("");
  const [scanning, setScanning] = React.useState(false);
  const [result, setResult] = React.useState<ScanResult | null>(null);
  const [added, setAdded] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (open) {
      setCidr("");
      setResult(null);
      setAdded(new Set());
    }
  }, [open]);

  const scan = () => {
    const range = cidr.trim();
    if (!range) {
      Setting.showMessage("error", i18next.t("server:Please enter a CIDR"));
      return;
    }
    setScanning(true);
    ServerBackend.syncIntranetServers([range]).then((res: any) => {
      if (res.status === "ok") {
        const data: ScanResult = res.data ?? {};
        setResult(data);
        Setting.showMessage("success", `${i18next.t("general:Successfully got")}: ${(data.servers ?? []).length} server(s)`);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    }).catch((error: any) => {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
    }).finally(() => setScanning(false));
  };

  const add = (found: {host: string; port: number | string; url: string}) => {
    const server = newServer({displayName: `Scanned MCP ${found.host}:${found.port}`, url: found.url});
    ServerBackend.addServer(server).then((res: any) => {
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Successfully added"));
        setAdded((prev) => new Set(prev).add(found.url));
        onAdded();
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
      }
    }).catch((error: any) => {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
    });
  };

  const servers = result?.servers ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => !scanning && onOpenChange(next)}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{i18next.t("server:Scan server")}</DialogTitle>
          {result ? (
            <DialogDescription>
              {i18next.t("server:Scanned hosts")}: {result.scannedHosts ?? 0}, {i18next.t("server:Online hosts")}: {result.onlineHosts?.length ?? 0}, {i18next.t("server:Found servers")}: {servers.length}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <Input
          placeholder={i18next.t("server:CIDR placeholder")}
          value={cidr}
          onChange={(e) => {
            setCidr(e.target.value);
            setResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !scanning) {
              scan();
            }
          }}
        />
        {result ? (
          <div className="max-h-80 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{i18next.t("general:Host")}</TableHead>
                  <TableHead>{i18next.t("general:Port")}</TableHead>
                  <TableHead>{i18next.t("general:Path")}</TableHead>
                  <TableHead>{i18next.t("general:URL")}</TableHead>
                  <TableHead className="text-right">{i18next.t("general:Action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">{i18next.t("general:No data")}</TableCell>
                  </TableRow>
                ) : servers.map((found, index) => (
                  <TableRow key={`${found.url}-${index}`}>
                    <TableCell>{found.host}</TableCell>
                    <TableCell>{found.port}</TableCell>
                    <TableCell>{found.path}</TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      <a className="underline-offset-4 hover:underline" href={found.url} target="_blank" rel="noreferrer">{found.url}</a>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" disabled={added.has(found.url)} onClick={() => add(found)}>{i18next.t("general:Add")}</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={scanning} onClick={() => onOpenChange(false)}>{i18next.t("general:Cancel")}</Button>
          <Button loading={scanning} onClick={scan}>{i18next.t("general:Sync")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ServerListPage() {
  const [scanOpen, setScanOpen] = React.useState(false);

  const columns: ColumnDef<any>[] = [
    linkColumn({dataIndex: "name", to: (r) => `/servers/${r.name}`, width: 200}),
    textColumn({dataIndex: "displayName", title: i18next.t("general:Display name"), width: 220, searchable: true}),
    {
      dataIndex: "transport",
      title: i18next.t("server:Transport"),
      width: 140,
      defaultHidden: true,
      render: (value, record) => <Badge variant="outline">{value || (record.url ? "streamablehttp" : "stdio")}</Badge>,
    },
    {
      dataIndex: "url",
      title: i18next.t("general:URL"),
      width: 260,
      searchable: true,
      defaultHidden: true,
      render: (value, record) => <span className="font-mono text-xs">{value || [record.command, ...(record.args ?? [])].filter(Boolean).join(" ")}</span>,
    },
    {
      dataIndex: "tools",
      title: i18next.t("general:Tool"),
      width: 100,
      align: "center",
      render: (value: any[]) => (value ?? []).length,
    },
    // not a column of the antd list, so it starts in the column menu
    {...dateColumn(), defaultHidden: true},
  ];

  return (
    <CrudListPage
      title={i18next.t("general:MCP Servers")}
      columns={columns}
      fetch={(q) => ServerBackend.getServers("admin", q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
      newRecord={() => newServer()}
      editUrl={(r) => `/servers/${r.name}`}
      remove={(r) => ServerBackend.deleteServer(r)}
      toolbar={({refresh}) => (
        <>
          <Button variant="outline" onClick={() => setScanOpen(true)}>
            <Radar />
            {i18next.t("server:Scan server")}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/server-store">
              <Store />
              {i18next.t("general:MCP Store")}
            </Link>
          </Button>
          <ScanServerDialog open={scanOpen} onOpenChange={setScanOpen} onAdded={refresh} />
        </>
      )}
    />
  );
}
