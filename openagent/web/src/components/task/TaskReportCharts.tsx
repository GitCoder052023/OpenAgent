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

import i18next from "i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {ChartSlots, chartColor} from "@/components/charts/TrendChart";
import {countByScoreBand, flattenItems, getRadarDomain, type FlatItem, type ReportCategory} from "@/lib/task-report";

const ItemNameMaxLength = 18;
const tick = {fill: "hsl(var(--muted-foreground))", fontSize: 11};
const valueLabel = {fill: "hsl(var(--foreground))", fontSize: 11};
const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
};

function shortLabel(name: string) {
  return name.length > ItemNameMaxLength ? `${name.slice(0, ItemNameMaxLength)}…` : name;
}

/** A dimension's colour; past the palette's eight slots every dimension shares a neutral. */
function groupColor(index: number) {
  return index < ChartSlots ? chartColor(index) : "hsl(var(--muted-foreground))";
}

function ItemTooltip({active, payload}: any) {
  if (!active || !payload?.length) {
    return null;
  }
  const item: FlatItem = payload[0].payload;
  return (
    <div style={tooltipStyle} className="max-w-[280px] px-2.5 py-2 shadow-md">
      <div className="text-[11px] text-muted-foreground">{item.categoryName}</div>
      <div className="mb-1 break-words">{item.name}</div>
      <div className="font-semibold tabular-nums">{i18next.t("task:Score")}: {item.score}{i18next.t("task:Score Unit")}</div>
    </div>
  );
}

/**
 * Every sub-criterion as one spoke. Spokes of the same dimension sit together
 * and carry that dimension's colour as a dot, named in the legend underneath.
 */
export function ScoreRadar({categories}: {categories: ReportCategory[]}) {
  const items = flattenItems(categories);
  const [min, max] = getRadarDomain(categories);
  const groups = categories.map((category, index) => (category?.name ?? "").trim() || `—${index + 1}—`);

  const renderTick = ({x, y, payload, textAnchor}: any) => {
    const item = items[payload.index];
    if (!item) {
      return <g />;
    }
    // the dot carries the dimension; the name itself stays in the text colour
    return (
      <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={10}>
        <tspan fill={groupColor(item.categoryIndex)}>● </tspan>
        <tspan fill="hsl(var(--foreground))">{shortLabel(item.name)}</tspan>
      </text>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={items} outerRadius="72%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="name" tick={renderTick} />
            <PolarRadiusAxis domain={[min, max]} tick={false} axisLine={false} tickCount={5} />
            <Radar
              dataKey="score"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="hsl(var(--chart-1))"
              fillOpacity={0.25}
              dot={{r: 3, fill: "hsl(var(--chart-1))", stroke: "hsl(var(--card))", strokeWidth: 1}}
              isAnimationActive={false}
            />
            <Tooltip content={<ItemTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {groups.length > 0 ? (
        <div className="flex shrink-0 flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-xs">
          {groups.map((name, index) => (
            <span key={index} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{backgroundColor: groupColor(index)}} />
              {name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** All sub-criteria, best first, each bar labelled with its score. */
export function RankedScoreBars({categories}: {categories: ReportCategory[]}) {
  const items = flattenItems(categories).sort((a, b) => b.score - a.score).map((item) => ({...item, label: shortLabel(item.name)}));
  if (items.length === 0) {
    return null;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={items} layout="vertical" margin={{top: 4, right: 36, bottom: 4, left: 4}}>
        <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
        <XAxis type="number" domain={["dataMin - 10", "dataMax"]} allowDecimals={false} tickLine={false} axisLine={false} tick={tick} tickFormatter={(value) => String(Math.max(0, Math.round(value)))} />
        <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={{stroke: "hsl(var(--border))"}} tick={{...tick, fill: "hsl(var(--foreground))"}} interval={0} />
        <Tooltip content={<ItemTooltip />} cursor={{fill: "hsl(var(--muted))"}} />
        <Bar dataKey="score" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
          <LabelList dataKey="score" position="right" style={valueLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** How many sub-criteria scored in each range, lowest range first. */
export function ScoreDistribution({categories}: {categories: ReportCategory[]}) {
  const unit = i18next.t("task:Score Unit").trim();
  const rows = countByScoreBand(categories).map((row) => ({...row, label: `${row.band}${unit}`}));
  if (rows.length === 0) {
    return null;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{top: 20, right: 8, bottom: 4, left: -16}}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tickLine={false} axisLine={{stroke: "hsl(var(--border))"}} tick={tick} interval={0} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={tick} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{fill: "hsl(var(--muted))"}}
          formatter={(value: number) => [`${value}${i18next.t("task:Item count unit")}`, i18next.t("task:Pie chart")]}
        />
        <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
          <LabelList dataKey="count" position="top" style={valueLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Sub-criteria under 70, the ones a revision should start with. */
export function LowScoreBars({categories, threshold = 70}: {categories: ReportCategory[]; threshold?: number}) {
  const items = flattenItems(categories)
    .filter((item) => item.score < threshold)
    .sort((a, b) => b.score - a.score)
    .map((item) => ({...item, label: shortLabel(item.name)}));
  if (items.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{i18next.t("general:No data")}</div>;
  }
  // 50-80 separates these scores best; a score under 50 widens the floor
  const lowest = Math.min(...items.map((item) => item.score));
  const yMin = lowest >= 50 ? 50 : Math.max(0, Math.min(Math.floor(lowest / 10) * 10 - 10, lowest - 10));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={items} margin={{top: 20, right: 8, bottom: 8, left: -16}}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tickLine={false} axisLine={{stroke: "hsl(var(--border))"}} tick={{...tick, fontSize: 10}} interval={0} angle={-35} textAnchor="end" height={80} />
        <YAxis domain={[yMin, 80]} allowDataOverflow tickLine={false} axisLine={false} tick={tick} />
        <Tooltip content={<ItemTooltip />} cursor={{fill: "hsl(var(--muted))"}} />
        <Bar dataKey="score" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false}>
          <LabelList dataKey="score" position="top" style={{...valueLabel, fontSize: 10}} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
