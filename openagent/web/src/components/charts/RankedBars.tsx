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

interface RankedBarsProps {
  counts: Record<string, number>;
  /** rows shown before the rest fold into "Other" */
  limit?: number;
}

/**
 * A share-of-total breakdown as labelled horizontal bars, largest first. Every
 * row carries its name and value, so the bars are one hue and nothing hangs on a
 * legend; the long tail folds into one "Other" row instead of thin slivers.
 */
export function RankedBars({counts, limit = 10}: RankedBarsProps) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">{i18next.t("general:No data")}</div>;
  }

  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const rows = entries.slice(0, limit);
  const rest = entries.slice(limit).reduce((sum, [, value]) => sum + value, 0);
  if (rest > 0) {
    rows.push([i18next.t("general:Other"), rest]);
  }
  const max = Math.max(...rows.map(([, value]) => value), 1);

  return (
    <ul className="space-y-1.5">
      {rows.map(([name, value], index) => {
        const share = total > 0 ? (value / total * 100).toFixed(1) : "0";
        const isOther = rest > 0 && index === rows.length - 1;
        return (
          <li key={`${name}-${index}`} className="group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm" title={`${name}: ${value} (${share}%)`}>
            <span className="truncate text-muted-foreground group-hover:text-foreground">{name || "-"}</span>
            <span className="h-3.5 rounded-r bg-muted/50">
              <span
                className="block h-full rounded-r transition-[width] duration-300"
                style={{width: `${value / max * 100}%`, backgroundColor: isOther ? "hsl(var(--muted-foreground) / 0.45)" : "hsl(var(--chart-1))"}}
              />
            </span>
            <span className="whitespace-nowrap text-right tabular-nums">
              {value.toLocaleString()} <span className="text-xs text-muted-foreground">{share}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
