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

import {Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";

interface MetricChartProps {
  rows: Record<string, any>[];
  xKey: string;
  yKey: string;
  /** the series name in the tooltip */
  label: string;
  /** bars for counts per period, an area for a running total */
  kind: "bar" | "area";
  height?: number;
  formatValue?: (value: number) => string;
}

const axisTick = {fill: "hsl(var(--muted-foreground))", fontSize: 11};
const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
};

function compact(value: number) {
  return Intl.NumberFormat(undefined, {notation: "compact", maximumFractionDigits: 1}).format(value);
}

/** One measure over time on its own axis: the small multiple the usage page is made of. */
export function MetricChart({rows, xKey, yKey, label, kind, height = 160, formatValue}: MetricChartProps) {
  const format = formatValue ?? ((value: number) => value.toLocaleString());
  const common = (
    <>
      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
      <XAxis dataKey={xKey} tickLine={false} axisLine={{stroke: "hsl(var(--border))"}} tick={axisTick} minTickGap={28} />
      <YAxis allowDecimals={kind === "area" ? undefined : false} tickLine={false} axisLine={false} tick={axisTick} width={44} tickFormatter={compact} />
      <Tooltip
        contentStyle={tooltipStyle}
        cursor={kind === "bar" ? {fill: "hsl(var(--muted))"} : {stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3"}}
        formatter={(value: number) => [format(value), label]}
      />
    </>
  );

  return (
    <div style={{height}}>
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? (
          <BarChart data={rows} margin={{top: 4, right: 4, bottom: 0, left: -8}}>
            {common}
            <Bar dataKey={yKey} name={label} fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        ) : (
          <AreaChart data={rows} margin={{top: 4, right: 4, bottom: 0, left: -8}}>
            {common}
            <Area
              type="monotone"
              dataKey={yKey}
              name={label}
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="hsl(var(--chart-1) / 0.12)"
              dot={false}
              activeDot={{r: 4, strokeWidth: 2, stroke: "hsl(var(--card))"}}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
