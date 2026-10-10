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
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";

/** The categorical slots, in order; a series keeps its slot for as long as it is shown. */
export const ChartSlots = 8;

export function chartColor(slot: number) {
  return `hsl(var(--chart-${slot + 1}))`;
}

/**
 * Gives each shown series a colour slot that does not move when other series are
 * added or removed: a series keeps its slot, a newcomer takes the first free one.
 */
export function useStableSlots(keys: string[]) {
  const slots = React.useRef(new Map<string, number>());
  const map = slots.current;
  for (const key of [...map.keys()]) {
    if (!keys.includes(key)) {
      map.delete(key);
    }
  }
  for (const key of keys) {
    if (!map.has(key)) {
      const used = new Set(map.values());
      let slot = 0;
      while (used.has(slot)) {
        slot++;
      }
      map.set(key, slot);
    }
  }
  return map;
}

interface TrendChartProps {
  /** one row per x value: {[xKey]: label, [series]: number} */
  rows: Record<string, any>[];
  xKey: string;
  series: string[];
  height?: number;
}

/**
 * Several counts over time on one axis, with a hover crosshair and a table view
 * of the same numbers for readers who cannot tell the lines apart.
 */
export function TrendChart({rows, xKey, series, height = 320}: TrendChartProps) {
  const [view, setView] = React.useState("chart");
  const slots = useStableSlots(series);

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Tabs value={view} onValueChange={setView}>
          <TabsList className="h-8">
            <TabsTrigger value="chart" className="text-xs">{i18next.t("general:Chart")}</TabsTrigger>
            <TabsTrigger value="table" className="text-xs">{i18next.t("general:Table")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {view === "chart" ? (
        <div style={{height}}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{top: 8, right: 16, bottom: 0, left: -8}}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey={xKey} tickLine={false} axisLine={{stroke: "hsl(var(--border))"}} tick={{fill: "hsl(var(--muted-foreground))", fontSize: 11}} minTickGap={24} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{fill: "hsl(var(--muted-foreground))", fontSize: 11}} width={48} />
              <Tooltip
                cursor={{stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3"}}
                contentStyle={{background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12, color: "hsl(var(--popover-foreground))"}}
                itemSorter={(item) => -(item.value as number)}
              />
              <Legend iconType="plainline" wrapperStyle={{fontSize: 12, color: "hsl(var(--muted-foreground))"}} />
              {series.map((name) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={chartColor(slots.get(name) ?? 0)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{r: 4, strokeWidth: 2, stroke: "hsl(var(--card))"}}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="overflow-auto rounded-md border" style={{maxHeight: height}}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i18next.t("general:Date")}</TableHead>
                {series.map((name) => <TableHead key={name} className="text-right">{name}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row[xKey]}>
                  <TableCell className="whitespace-nowrap tabular-nums">{row[xKey]}</TableCell>
                  {series.map((name) => <TableCell key={name} className="text-right tabular-nums">{row[name] ?? 0}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
