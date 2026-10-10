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
import {Copy} from "lucide-react";
import {useParams} from "react-router-dom";
import * as ServerBackend from "@/backend/ServerBackend";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Switch} from "@/components/ui/switch";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {McpTestWidget} from "@/components/common/McpTestWidget";
import {MapTable} from "@/components/crud/MapTable";
import {SimpleEditPage, type EditField} from "@/components/crud/SimpleEditPage";
import type {EditMode} from "@/lib/crud";
import * as Setting from "@/lib/setting";

const TRANSPORTS = [
  {value: "streamablehttp", label: "Streamable HTTP"},
  {value: "sse", label: "SSE"},
  {value: "stdio", label: "stdio"},
];

const isStdio = (server: any) => server.transport === "stdio";

function ToolsCard({server, serverName, mode, update, reload}: {server: any; serverName: string; mode: EditMode; update: (field: string, value: any) => void; reload: () => void}) {
  const [syncing, setSyncing] = React.useState(false);
  const tools: any[] = server.tools ?? [];

  const sync = (isCleared: boolean) => {
    setSyncing(true);
    ServerBackend.syncMcpTool("admin", serverName, Setting.deepCopy(server), isCleared).then((res: any) => {
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Successfully saved"));
        reload();
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
      }
    }).catch((error: any) => {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
    }).finally(() => setSyncing(false));
  };

  const setAllowed = (index: number, isAllowed: boolean) => {
    update("tools", tools.map((tool, i) => (i === index ? {...tool, isAllowed} : tool)));
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{i18next.t("general:Tools")}</CardTitle>
          <CardDescription>{i18next.t("general:Tools desc")}</CardDescription>
        </div>
        {mode === "edit" ? (
          <div className="flex gap-2">
            <Button variant="outline" disabled={syncing} onClick={() => sync(true)}>{i18next.t("general:Clear")}</Button>
            <Button loading={syncing} onClick={() => sync(false)}>{i18next.t("general:Sync")}</Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px]">{i18next.t("general:Name")}</TableHead>
                <TableHead>{i18next.t("general:Description")}</TableHead>
                <TableHead className="w-[120px] text-center">{i18next.t("server:Is allowed")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">{i18next.t("general:No data")}</TableCell>
                </TableRow>
              ) : tools.map((tool, index) => (
                <TableRow key={tool.name || index}>
                  <TableCell className="font-mono text-xs">{tool.name}</TableCell>
                  <TableCell className="text-sm">{tool.description}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={Boolean(tool.isAllowed)} disabled={mode === "view"} onCheckedChange={(checked) => setAllowed(index, checked)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ServerEditPage() {
  const {serverName = ""} = useParams();

  const fields: EditField[] = [
    {type: "text", name: "name", labelKey: "general:Name", required: true},
    {type: "text", name: "displayName", labelKey: "general:Display name"},
    {type: "select", name: "transport", labelKey: "server:Transport", options: () => TRANSPORTS},
    {type: "text", name: "command", labelKey: "server:Command", when: (ctx) => isStdio(ctx.record)},
    {type: "tags", name: "args", labelKey: "general:Arguments", when: (ctx) => isStdio(ctx.record)},
    {type: "url", name: "url", labelKey: "general:URL", when: (ctx) => !isStdio(ctx.record)},
    {type: "password", name: "token", labelKey: "server:Access token", when: (ctx) => !isStdio(ctx.record)},
    {
      type: "custom",
      name: "env",
      labelKey: (ctx) => (isStdio(ctx.record) ? "server:Environment variables" : "server:HTTP headers"),
      block: true,
      render: (ctx, update) => (
        <MapTable
          value={ctx.record.env}
          keyTitle={i18next.t("general:Name")}
          valueTitle={i18next.t("general:Value")}
          onChange={(value) => update("env", value)}
        />
      ),
    },
  ];

  return (
    <SimpleEditPage
      titleKey="server:Edit MCP Server"
      backTo="/servers"
      deps={[serverName]}
      fields={fields}
      fetch={() => ServerBackend.getServer("admin", serverName)}
      add={(record) => ServerBackend.addServer(record)}
      update={(record) => ServerBackend.updateServer("admin", serverName, record)}
      editUrl={(record) => `/servers/${record.name}`}
      // an older row has no transport; the backend reads a URL as HTTP and anything else as stdio
      transform={(record) => ({...record, transport: record.transport || (record.url ? "streamablehttp" : "stdio")})}
    >
      {(ctx, update) => {
        const baseUrl = `${window.location.origin}/api/get-server?id=${ctx.record.owner}/${ctx.record.name}`;
        return (
          <div className="mt-6 space-y-4">
            <ToolsCard server={ctx.record} serverName={serverName} mode={ctx.mode} update={update} reload={ctx.reload} />
            {ctx.mode !== "add" ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{i18next.t("general:Test")}</CardTitle>
                  <CardDescription>{i18next.t("general:Test desc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <McpTestWidget server={ctx.record} />
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium">{i18next.t("server:Base URL")}</div>
                    <div className="flex gap-2">
                      <Input readOnly value={baseUrl} />
                      <Button variant="outline" size="icon" className="shrink-0" aria-label={i18next.t("general:Copy")} onClick={() => Setting.copyToClipboard(baseUrl)}>
                        <Copy />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        );
      }}
    </SimpleEditPage>
  );
}
