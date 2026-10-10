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
import {Plus, RefreshCw} from "lucide-react";
import {useNavigate} from "react-router-dom";
import * as ServerBackend from "@/backend/ServerBackend";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Loading} from "@/components/common/Loading";
import {MultiSelect} from "@/components/common/MultiSelect";
import {PageHeader} from "@/components/crud/PageHeader";
import * as Setting from "@/lib/setting";
import {newServer} from "@/pages/ServerListPage";

interface OnlineServer {
  id: string;
  name: string;
  categories: string[];
  endpoint: string;
  description: string;
  website: string;
}

// the registry has been served as a bare array, as {servers} and as {data}
function getServerList(data: any): any[] {
  if (Array.isArray(data?.servers)) {
    return data.servers;
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.data)) {
    return data.data;
  }
  return [];
}

function normalize(servers: any[]): OnlineServer[] {
  return servers.map((server, index) => ({
    id: server.id ?? `${server.name ?? "server"}-${index}`,
    name: server.name ?? "",
    categories: [server?.category].filter((c) => typeof c === "string" && c.trim() !== ""),
    endpoint: server.endpoints?.production ?? server.endpoint ?? "",
    description: server.description ?? "",
    website: server?.maintainer?.website ?? server?.website ?? "",
  })).filter((server) => server.endpoint.startsWith("http"));
}

function getServerName(server: OnlineServer) {
  const normalized = String(server.id || server.name).toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return `${normalized || "server"}_${Setting.getRandomName()}`;
}

function getWebsiteUrl(website: string) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

export default function ServerStorePage() {
  const navigate = useNavigate();
  const [servers, setServers] = React.useState<OnlineServer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [nameFilter, setNameFilter] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string[]>([]);

  const fetchServers = React.useCallback(() => {
    setLoading(true);
    ServerBackend.getOnlineServers().then((res: any) => {
      if (res.status === "ok") {
        setServers(normalize(getServerList(res.data)));
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    }).catch((error: any) => {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
    }).finally(() => setLoading(false));
  }, []);

  React.useEffect(fetchServers, [fetchServers]);

  const categories = React.useMemo(
    () => [...new Set(servers.flatMap((server) => server.categories))].sort((a, b) => a.localeCompare(b)),
    [servers],
  );

  const shown = servers.filter((server) => {
    const name = nameFilter.trim().toLowerCase();
    return (!name || server.name.toLowerCase().includes(name)) &&
      (categoryFilter.length === 0 || categoryFilter.some((category) => server.categories.includes(category)));
  });

  // the server is only created when its edit page is saved, like the Add button of the list
  const add = (server: OnlineServer) => {
    const record = newServer({
      name: getServerName(server),
      displayName: server.name || server.id,
      url: server.endpoint,
      // the registry does not say which transport an endpoint speaks, but the SSE ones end in /sse
      transport: /\/sse\/?$/.test(server.endpoint) ? "sse" : "streamablehttp",
    });
    navigate(`/servers/${record.name}`, {state: {mode: "add", record}});
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={i18next.t("general:MCP Store")}
        actions={
          <Button variant="outline" size="iconSm" aria-label={i18next.t("general:Refresh")} disabled={loading} onClick={fetchServers}>
            <RefreshCw className={loading ? "animate-spin" : undefined} />
          </Button>
        }
      />
      <div className="flex flex-col gap-2 md:flex-row">
        <Input className="md:max-w-xs" placeholder={i18next.t("general:Name")} value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} />
        <MultiSelect
          className="md:max-w-md"
          placeholder={i18next.t("general:Category")}
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={categories.map((category) => ({value: category, label: category}))}
        />
        {nameFilter || categoryFilter.length > 0 ? (
          <Button variant="ghost" onClick={() => {
            setNameFilter("");
            setCategoryFilter([]);
          }}>
            {i18next.t("general:Clear")}
          </Button>
        ) : null}
      </div>
      {loading ? (
        <Loading />
      ) : shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{i18next.t("general:No data")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((server) => (
            <Card key={server.id} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
                <CardTitle className="min-w-0 break-words text-base">{server.name || "-"}</CardTitle>
                <Button size="sm" className="shrink-0" onClick={() => add(server)}>
                  <Plus />
                  {i18next.t("general:Add")}
                </Button>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                <p className="line-clamp-3 text-muted-foreground">{server.description || "-"}</p>
                <div className="mt-auto space-y-1">
                  <div className="truncate">
                    <span className="font-medium">{i18next.t("general:URL")}: </span>
                    <a className="underline-offset-4 hover:underline" href={server.endpoint} target="_blank" rel="noreferrer">{server.endpoint}</a>
                  </div>
                  <div className="truncate">
                    <span className="font-medium">{i18next.t("general:Website")}: </span>
                    {server.website ? (
                      <a className="underline-offset-4 hover:underline" href={getWebsiteUrl(server.website)} target="_blank" rel="noreferrer">{server.website}</a>
                    ) : "-"}
                  </div>
                </div>
                {server.categories.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {server.categories.map((category) => <Badge key={category} variant="secondary">{category}</Badge>)}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
