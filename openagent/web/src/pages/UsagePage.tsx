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
import {Link} from "react-router-dom";
import * as UsageBackend from "@/backend/UsageBackend";
import {Badge} from "@/components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Skeleton} from "@/components/ui/skeleton";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {CalendarHeatmap} from "@/components/charts/CalendarHeatmap";
import {MetricChart} from "@/components/charts/MetricChart";
import {RankedBars} from "@/components/charts/RankedBars";
import {Loading} from "@/components/common/Loading";
import {SearchableSelect} from "@/components/common/SearchableSelect";
import {UserLabel} from "@/components/common/UserLabel";
import {DataTable} from "@/components/crud/DataTable";
import {PageHeader} from "@/components/crud/PageHeader";
import type {ColumnDef, TableQuery} from "@/components/crud/types";
import {useAccount} from "@/hooks/use-account";
import {useRequestStore} from "@/hooks/use-request-store";
import {queryRows} from "@/lib/client-table";
import * as Setting from "@/lib/setting";

type RangeType = "All" | "Hour" | "Day" | "Week" | "Month";
const RangeTypes: RangeType[] = ["All", "Hour", "Day", "Week", "Month"];
const RangeCounts: Record<Exclude<RangeType, "All">, number> = {Hour: 72, Day: 30, Week: 16, Month: 12};
const Days = 30;

function formatPeriod(date: string, rangeType: RangeType) {
  switch (rangeType) {
  case "Hour":
    return `${date}:00`;
  case "Week": {
    const start = new Date(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const md = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return `${md(start)} ~ ${md(end)}`;
  }
  case "Month":
    return date.slice(0, 7);
  default:
    return date;
  }
}

interface Metric {
  key: string;
  label: string;
  format?: (value: number) => string;
}

function MetricCard({metric, value, rows, rangeType, loading}: {metric: Metric; value: number | undefined; rows: any[] | null; rangeType: RangeType; loading: boolean}) {
  const format = metric.format ?? ((v: number) => v.toLocaleString());
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{metric.label}</CardTitle>
        {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-semibold tabular-nums">{format(value ?? 0)}</div>}
      </CardHeader>
      <CardContent className="pt-2">
        {rows === null ? <Skeleton className="h-[160px] w-full" /> : (
          <MetricChart
            rows={rows}
            xKey="period"
            yKey={metric.key}
            label={metric.label}
            kind={rangeType === "All" ? "area" : "bar"}
            formatValue={metric.format}
          />
        )}
      </CardContent>
    </Card>
  );
}

function UserTable({rows, isAdmin}: {rows: any[] | null; isAdmin: boolean}) {
  const [query, setQueryState] = React.useState<TableQuery>({page: 1, pageSize: 100, sortField: "tokenCount", sortOrder: "descend", searchText: "", searchedColumn: ""});
  const setQuery = (patch: Partial<TableQuery>) => setQueryState((prev) => ({...prev, ...patch}));
  const {rows: pageRows, total} = queryRows(rows ?? [], query);

  const countLink = (path: string) => function CountLink(value: number, record: any) {
    return (
      <Link to={`/${path}?user=${encodeURIComponent(record.user)}`}>
        <Badge variant="success" className="tabular-nums">{value}</Badge>
      </Link>
    );
  };

  const columns: ColumnDef<any>[] = [
    {dataIndex: "user", title: i18next.t("general:User"), width: 180, render: (value) => <UserLabel user={value} />},
    {dataIndex: "chats", title: i18next.t("general:Chats"), sortable: true, render: countLink("chats")},
    {dataIndex: "messageCount", title: i18next.t("general:Messages"), sortable: true, render: countLink("messages")},
    {dataIndex: "tokenCount", title: i18next.t("chat:Token count"), sortable: true, className: "tabular-nums"},
    // only the admin sees money, as on the charts above
    ...(isAdmin ? [{dataIndex: "price", title: i18next.t("chat:Price"), sortable: true, className: "tabular-nums"}] : []),
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows === null ? null : pageRows}
      total={total}
      loading={rows === null}
      query={query}
      onQueryChange={setQuery}
      rowKey={(row) => row.user}
    />
  );
}

export default function UsagePage() {
  const {account} = useAccount();
  const isAdmin = account?.name === "admin";
  const canViewAll = Setting.canViewAllUsers(account);
  const store = useRequestStore();
  const [users, setUsers] = React.useState<string[] | null>(null);
  const [selectedUser, setSelectedUser] = React.useState<string | null>(null);
  const [rangeType, setRangeType] = React.useState<RangeType>("All");
  const [usages, setUsages] = React.useState<any[] | null>(null);
  const [usageMetadata, setUsageMetadata] = React.useState<any>(null);
  const [rangeUsages, setRangeUsages] = React.useState<Record<string, any[] | null>>({});
  const [userTableInfo, setUserTableInfo] = React.useState<any[] | null>(null);
  const [providerData, setProviderData] = React.useState<any[] | null>(null);
  const [heatmapData, setHeatmapData] = React.useState<any>(null);

  React.useEffect(() => {
    if (!account) {
      return;
    }
    UsageBackend.getUsers("", account.name, store).then((res: any) => {
      if (res.status === "ok") {
        setUsers(res.data ?? []);
        setSelectedUser(canViewAll ? "All" : (res.data?.[0] ?? ""));
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    });
    const owner = account.owner ?? "admin";
    UsageBackend.getUserTableInfos("", store, account.name).then((res: any) => {
      if (res.status === "ok") {
        setUserTableInfo(res.data ?? []);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    });
    UsageBackend.getUsageProviders(owner).then((res: any) => res.status === "ok" && setProviderData(res.data));
    UsageBackend.getUsageHeatmap(owner).then((res: any) => res.status === "ok" && setHeatmapData(res.data));
  }, [account, canViewAll, store]);

  React.useEffect(() => {
    if (selectedUser === null) {
      return;
    }
    let cancelled = false;
    const fail = (res: any) => Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
    setUsages(null);
    setRangeUsages({});
    UsageBackend.getUsages("", store, selectedUser, Days).then((res: any) => {
      if (cancelled) {
        return;
      }
      if (res.status === "ok") {
        setUsages(res.data ?? []);
        setUsageMetadata(res.data2);
      } else {
        fail(res);
      }
    });
    (Object.keys(RangeCounts) as (keyof typeof RangeCounts)[]).forEach((type) => {
      UsageBackend.getRangeUsages("", type, RangeCounts[type], store, selectedUser).then((res: any) => {
        if (cancelled) {
          return;
        }
        if (res.status === "ok") {
          setRangeUsages((prev) => ({...prev, [type]: res.data ?? []}));
        } else {
          fail(res);
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedUser, store]);

  if (users === null || selectedUser === null) {
    return <Loading />;
  }

  const source = rangeType === "All" ? usages : (rangeUsages[rangeType] ?? null);
  const rows = source === null ? null : source.map((usage) => ({...usage, period: formatPeriod(usage.date, rangeType)}));
  const latest = usages && usages.length > 0 ? usages[usages.length - 1] : null;
  const loading = usages === null;

  const metrics: Metric[] = [
    {key: "userCount", label: i18next.t("general:Users")},
    {key: "chatCount", label: i18next.t("general:Chats")},
    {key: "messageCount", label: i18next.t("general:Messages")},
    {key: "tokenCount", label: i18next.t("general:Tokens")},
    ...(isAdmin ? [{
      key: "price",
      label: i18next.t("chat:Price"),
      format: (value: number) => `${latest?.currency ? "$" : ""}${Number(value ?? 0).toLocaleString(undefined, {maximumFractionDigits: 4})}`,
    }] : []),
  ];

  const tableRows = userTableInfo === null ? null : selectedUser === "All" ? userTableInfo : userTableInfo.filter((item) => item.user === selectedUser);

  return (
    <div className="space-y-4">
      <PageHeader
        title={i18next.t("general:Usages")}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={rangeType} onValueChange={(value) => setRangeType(value as RangeType)}>
              <TabsList>
                {RangeTypes.map((type) => (
                  <TabsTrigger key={type} value={type}>{type === "All" ? i18next.t("store:All") : i18next.t(`usage:${type}`)}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{i18next.t("general:User")}</span>
              <SearchableSelect
                className="w-56"
                value={selectedUser}
                onChange={setSelectedUser}
                options={[{value: "All", label: "All", disabled: !canViewAll}, ...users.map((user) => ({value: user, label: user}))]}
              />
            </div>
          </div>
        }
      />

      {isAdmin ? (
        <div className="text-sm text-muted-foreground">
          {i18next.t("task:Application")}: {loading ? "…" : <span className="font-semibold tabular-nums text-foreground">{usageMetadata?.application ?? "-"}</span>}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.key} metric={metric} value={latest?.[metric.key]} rows={rows} rangeType={rangeType} loading={loading} />
        ))}
      </div>

      {(providerData && providerData.length > 0) || heatmapData?.data ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {providerData && providerData.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{i18next.t("general:Providers")}</CardTitle>
              </CardHeader>
              <CardContent>
                <RankedBars counts={Object.fromEntries(providerData.map((p) => [p.category || i18next.t("application:Unknown"), p.count]))} />
              </CardContent>
            </Card>
          ) : null}
          {heatmapData?.data ? (
            <Card className={providerData && providerData.length > 0 ? "xl:col-span-2" : "xl:col-span-3"}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{i18next.t("general:Messages")}</CardTitle>
              </CardHeader>
              <CardContent>
                <CalendarHeatmap data={heatmapData.data} range={heatmapData.dateRange?.length === 2 ? heatmapData.dateRange : undefined} max={heatmapData.maxCount} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{i18next.t("general:Users")}</CardTitle>
        </CardHeader>
        <CardContent>
          <UserTable rows={tableRows} isAdmin={isAdmin} />
        </CardContent>
      </Card>
    </div>
  );
}
