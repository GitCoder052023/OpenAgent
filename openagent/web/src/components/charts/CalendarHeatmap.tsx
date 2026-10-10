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
import dayjs from "dayjs";

const Cell = 13;
const Gap = 2;
const Step = Cell + Gap;
const LeftLabelWidth = 30;
const TopLabelHeight = 16;
const MonthKeys = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DayKeys = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** the four shades above "none"; one hue, light to dark */
const Shades = [0.25, 0.45, 0.7, 1];

interface CalendarHeatmapProps {
  data: {date: string; count: number}[];
  /** [first day, last day] as YYYY-MM-DD; defaults to the year up to today */
  range?: string[];
  max?: number;
}

/** Daily counts over a year as a week-by-day grid, darker for busier days. */
export function CalendarHeatmap({data, range, max}: CalendarHeatmapProps) {
  const [hover, setHover] = React.useState<{x: number; y: number; date: string; count: number} | null>(null);

  const end = dayjs(range?.[1] ?? undefined);
  const start = range?.[0] ? dayjs(range[0]) : end.subtract(1, "year");
  const counts = new Map(data.map((item) => [item.date, item.count]));
  const peak = Math.max(max ?? 0, ...data.map((item) => item.count), 1);

  // the grid starts on the Sunday of the first week, so every column is one week
  const gridStart = start.subtract(start.day(), "day");
  const weeks = Math.ceil(end.diff(gridStart, "day") / 7) + 1;

  const cells: React.ReactNode[] = [];
  const monthLabels: React.ReactNode[] = [];
  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < 7; day++) {
      const date = gridStart.add(week * 7 + day, "day");
      if (date.isBefore(start, "day") || date.isAfter(end, "day")) {
        continue;
      }
      const key = date.format("YYYY-MM-DD");
      const count = counts.get(key) ?? 0;
      const shade = count === 0 ? 0 : Shades[Math.min(Shades.length - 1, Math.floor(count / peak * Shades.length))];
      const x = LeftLabelWidth + week * Step;
      const y = TopLabelHeight + day * Step;
      cells.push(
        <rect
          key={key}
          x={x}
          y={y}
          width={Cell}
          height={Cell}
          rx={2}
          fill={count === 0 ? "hsl(var(--muted))" : `hsl(var(--chart-1) / ${shade})`}
          onMouseEnter={() => setHover({x: x + Cell / 2, y, date: key, count})}
          onMouseLeave={() => setHover(null)}
        />,
      );
      if (date.date() === 1 || (week === 0 && day === start.day())) {
        monthLabels.push(
          <text key={`m-${key}`} x={x} y={11} className="fill-muted-foreground text-[11px]">
            {i18next.t(`usage:${MonthKeys[date.month()]}`)}
          </text>,
        );
      }
    }
  }

  const width = LeftLabelWidth + weeks * Step;
  const height = TopLabelHeight + 7 * Step;

  return (
    <div className="relative overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label={i18next.t("general:Messages")}>
        {monthLabels}
        {[1, 3, 5].map((day) => (
          <text key={day} x={0} y={TopLabelHeight + day * Step + 10} className="fill-muted-foreground text-[10px]">
            {i18next.t(`usage:${DayKeys[day]}`)}
          </text>
        ))}
        {cells}
      </svg>
      {hover ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
          style={{left: hover.x, top: hover.y - 4}}
        >
          {hover.date} <span className="font-semibold tabular-nums">{hover.count}</span>
        </div>
      ) : null}
      <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
        <span className="mr-1">0</span>
        {[0, ...Shades].map((shade) => (
          <span
            key={shade}
            className="h-[11px] w-[11px] rounded-sm"
            style={{backgroundColor: shade === 0 ? "hsl(var(--muted))" : `hsl(var(--chart-1) / ${shade})`}}
          />
        ))}
        <span className="ml-1 tabular-nums">{peak}</span>
      </div>
    </div>
  );
}
