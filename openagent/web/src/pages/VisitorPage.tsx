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
import {CircleCheck, CircleX} from "lucide-react";
import * as UsageBackend from "@/backend/UsageBackend";
import * as VisitorBackend from "@/backend/VisitorBackend";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Skeleton} from "@/components/ui/skeleton";
import {RankedBars} from "@/components/charts/RankedBars";
import {ChartSlots, TrendChart} from "@/components/charts/TrendChart";
import {Loading} from "@/components/common/Loading";
import {MultiSelect} from "@/components/common/MultiSelect";
import {SearchableSelect} from "@/components/common/SearchableSelect";
import {PageHeader} from "@/components/crud/PageHeader";
import {useAccount} from "@/hooks/use-account";
import * as Setting from "@/lib/setting";

const Days = 30;
const BreakdownFields = ["region", "city", "unit", "section"];
const BreakdownTitleKeys: Record<string, string> = {
  region: "general:Region",
  city: "general:City",
  unit: "general:Unit",
  section: "general:Section",
};
/** the trend opens on the busiest few actions; more can be added up to the palette's size */
const DefaultTrendSeries = 5;

interface DailyCount {
  date: string;
  FieldCount: Record<string, number>;
}

/** The visitor API answers per field with one entry per day; the last one is the period's total. */
function latestCounts(days: DailyCount[] | undefined): Record<string, number> {
  return days && days.length > 0 ? days[days.length - 1].FieldCount ?? {} : {};
}

function StatTile({icon, label, value, loading}: {icon: React.ReactNode; label: string; value: number | undefined; loading: boolean}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {icon}
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {loading ? <Skeleton className="mt-1 h-7 w-16" /> : <div className="text-2xl font-semibold tabular-nums">{(value ?? 0).toLocaleString()}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function VisitorPage() {
  const {account} = useAccount();
  const canViewAll = Setting.canViewAllUsers(account);
  const [users, setUsers] = React.useState<string[] | null>(null);
  const [selectedUser, setSelectedUser] = React.useState<string | null>(null);
  const [visitors, setVisitors] = React.useState<Record<string, DailyCount[] | undefined>>({});
  const [selectedOps, setSelectedOps] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!account) {
      return;
    }
    UsageBackend.getUsers("", account.name).then((res: any) => {
      if (res.status === "ok") {
        setUsers(res.data ?? []);
        setSelectedUser(canViewAll ? "All" : (res.data?.[0] ?? ""));
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    });
  }, [account, canViewAll]);

  React.useEffect(() => {
    if (selectedUser === null) {
      return;
    }
    let cancelled = false;
    setVisitors({});
    const load = (fields: string[]) => {
      VisitorBackend.getVisitors("", selectedUser, Days, fields).then((res: any) => {
        if (cancelled) {
          return;
        }
        if (res.status !== "ok") {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
          return;
        }
        setVisitors((prev) => ({...prev, ...res.data}));
        if (res.data?.action) {
          const totals = latestCounts(res.data.action);
          setSelectedOps(Object.keys(totals).sort((a, b) => totals[b] - totals[a]).slice(0, DefaultTrendSeries));
        }
      });
    };
    load(BreakdownFields);
    load(["action"]);
    load(["response"]);
    return () => {
      cancelled = true;
    };
  }, [selectedUser]);

  if (users === null || selectedUser === null) {
    return <Loading />;
  }

  const actions = visitors.action;
  const responses = latestCounts(visitors.response);
  const actionTotals = latestCounts(actions);
  const allOps = [...new Set((actions ?? []).flatMap((day) => Object.keys(day.FieldCount ?? {})))]
    .sort((a, b) => (actionTotals[b] ?? 0) - (actionTotals[a] ?? 0));
  const trendRows = (actions ?? []).map((day) => ({date: day.date, ...day.FieldCount}));

  const userOptions = [
    {value: "All", label: "All", disabled: !canViewAll},
    ...users.map((user) => ({value: user, label: user})),
  ];

  const changeOps = (next: string[]) => {
    if (next.length > ChartSlots) {
      Setting.showMessage("warning", `${i18next.t("general:Action")}: ≤ ${ChartSlots}`);
      return;
    }
    setSelectedOps(next);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={i18next.t("general:Visitors")}
        actions={
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{i18next.t("general:User")}</span>
            <SearchableSelect className="w-56" value={selectedUser} onChange={setSelectedUser} options={userOptions} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:max-w-md">
        <StatTile
          icon={<CircleCheck className="h-6 w-6 text-success" />}
          label={i18next.t("general:Success")}
          value={responses.ok}
          loading={visitors.response === undefined}
        />
        <StatTile
          icon={<CircleX className="h-6 w-6 text-destructive" />}
          label={i18next.t("general:Error")}
          value={responses.error}
          loading={visitors.response === undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{i18next.t("general:Action")}</CardTitle>
          </CardHeader>
          <CardContent>
            {actions === undefined ? <Loading /> : <RankedBars counts={actionTotals} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
            <CardTitle className="text-sm">{i18next.t("general:Trend")}</CardTitle>
            <MultiSelect
              className="w-72 max-w-full"
              value={selectedOps}
              onChange={changeOps}
              options={allOps.map((op) => ({value: op, label: op}))}
              maxDisplay={3}
            />
          </CardHeader>
          <CardContent>
            {actions === undefined ? <Loading /> : <TrendChart rows={trendRows} xKey="date" series={selectedOps} />}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {BreakdownFields.map((field) => {
          const days = visitors[field];
          // a field nobody filled in (no city data, no units) is left out rather than shown empty
          if (days !== undefined && Object.keys(latestCounts(days)).length === 0) {
            return null;
          }
          return (
            <Card key={field}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{i18next.t(BreakdownTitleKeys[field])}</CardTitle>
              </CardHeader>
              <CardContent>
                {days === undefined ? <Loading /> : <RankedBars counts={latestCounts(days)} />}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
