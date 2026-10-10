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
import {AlertCircle, RefreshCw} from "lucide-react";
import {Area, AreaChart, ResponsiveContainer, Tooltip} from "recharts";
import {Alert, AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Loading} from "@/components/common/Loading";
import {cn} from "@/lib/utils";

export type Period = "24h" | "7d" | "30d";

/** What every report gets from its shell: the window, a refresh counter and where to report its data time. */
export interface ReportProps {
  account: any;
  owner: string;
  storeName: string;
  period: Period;
  refreshTick: number;
  onLoaded: (asOf: string | null) => void;
}

export const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
};

export const axisTick = {fill: "hsl(var(--muted-foreground))", fontSize: 11};

export function formatTemplate(text: string, values: Record<string, any>) {
  return Object.entries(values).reduce((out, [key, value]) => out.split(`{${key}}`).join(String(value ?? "")), text);
}

/**
 * Loads one report and reloads it when the window or the refresh counter changes.
 * The previous data stays on screen while the next request runs.
 */
export function useReport<T>(load: () => Promise<any>, deps: React.DependencyList, onLoaded: (asOf: string | null) => void, asOf?: (data: T) => string | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const onLoadedRef = React.useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load().then((res: any) => {
      if (cancelled) {
        return;
      }
      if (res.status === "ok") {
        setData(res.data);
        onLoadedRef.current(asOf ? asOf(res.data) : res.data?.asOf ?? null);
      } else {
        setError(res.msg);
      }
    }).catch((err: any) => {
      if (!cancelled) {
        setError(err.message || String(err));
      }
    }).finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return {data, error, loading};
}

/** The spinner, the error or the report, dimmed while it reloads. */
export function ReportBody<T>({state, children}: {state: {data: T | null; error: string | null; loading: boolean}; children: (data: T) => React.ReactNode}) {
  if (state.error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state.data === null) {
    return state.loading ? <Loading className="py-16" /> : null;
  }
  return <div className={cn("space-y-4 transition-opacity", state.loading && "pointer-events-none opacity-60")}>{children(state.data)}</div>;
}

function formatAsOf(iso: string | null) {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  return isNaN(date.getTime()) ? iso : date.toLocaleString();
}

/** The window switch, the refresh button and when the shown data was computed. */
export function PeriodBar({period, onPeriodChange, onRefresh, asOf}: {period: Period; onPeriodChange: (period: Period) => void; onRefresh: () => void; asOf: string | null}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Tabs value={period} onValueChange={(value) => onPeriodChange(value as Period)}>
          <TabsList>
            {(["24h", "7d", "30d"] as Period[]).map((value) => (
              <TabsTrigger key={value} value={value}>{i18next.t(`store:${value}`)}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="outline" onClick={onRefresh}><RefreshCw />{i18next.t("general:Refresh")}</Button>
      </div>
      <span className="text-xs text-muted-foreground">{i18next.t("store:Data as of")}: {formatAsOf(asOf)}</span>
    </div>
  );
}

/** Period, refresh and data time for a report shell; switching the window or refreshing clears the time. */
export function usePeriodControls() {
  const [period, setPeriod] = React.useState<Period>("7d");
  const [refreshTick, setRefreshTick] = React.useState(0);
  const [asOf, setAsOf] = React.useState<string | null>(null);
  return {
    period,
    refreshTick,
    asOf,
    setAsOf,
    bar: (
      <PeriodBar
        period={period}
        asOf={asOf}
        onPeriodChange={(next) => {
          setPeriod(next);
          setAsOf(null);
        }}
        onRefresh={() => {
          setRefreshTick((tick) => tick + 1);
          setAsOf(null);
        }}
      />
    ),
  };
}

interface StatCardProps {
  icon?: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  /** small text after the value, such as the day a peak fell on */
  hint?: React.ReactNode;
  valueClassName?: string;
  children?: React.ReactNode;
  className?: string;
}

export function StatCard({icon, label, value, hint, valueClassName, children, className}: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}{label}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className={cn("text-2xl font-semibold tabular-nums", valueClassName)}>{typeof value === "number" ? value.toLocaleString() : value}</span>
          {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** A small trend without axes, under a stat. */
export function Sparkline({values, height = 44}: {values: number[]; height?: number}) {
  const rows = values.map((value, index) => ({index, value}));
  return (
    <div className="mt-2" style={{height}}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{top: 2, right: 2, bottom: 2, left: 2}}>
          <Tooltip contentStyle={tooltipStyle} cursor={{stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3"}} labelFormatter={() => ""} formatter={(value: number) => [value.toLocaleString(), ""]} separator="" />
          <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="hsl(var(--chart-1) / 0.15)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A labelled bar per item, scaled to the largest. */
export function BarList<T>({items, label, value, color = "hsl(var(--chart-1))", trailing}: {items: T[]; label: (item: T) => React.ReactNode; value: (item: T) => number; color?: string; trailing?: (item: T) => React.ReactNode}) {
  const max = Math.max(...items.map(value), 1);
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(80px,140px)_auto] items-center gap-3 text-sm">
          <div className="min-w-0 truncate">{label(item)}</div>
          <span className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full" style={{width: `${value(item) / max * 100}%`, backgroundColor: color}} />
          </span>
          <span className="whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">{trailing ? trailing(item) : value(item).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyNote({text}: {text: string}) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}
