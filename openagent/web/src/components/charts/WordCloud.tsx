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
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {cn} from "@/lib/utils";

const CHART_COLORS = 8;

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface WordCloudProps {
  wordCountMap: Record<string, number>;
  /** the most frequent words kept; a long tail of single mentions is noise */
  maxWords?: number;
  /** font sizes in px for the rarest and the most frequent word */
  sizeRange?: [number, number];
  className?: string;
}

/**
 * The words people use most, sized by frequency. The antd frontend drew this with
 * echarts-wordcloud; a wrapped run of words carries the same reading without
 * pulling echarts into the bundle, and takes its colours from the chart palette.
 */
export function WordCloud({wordCountMap, maxWords = 120, sizeRange = [12, 48], className}: WordCloudProps) {
  const [small, large] = sizeRange;
  const words = React.useMemo(() => {
    const top = Object.entries(wordCountMap ?? {})
      .filter(([word, count]) => word.trim() !== "" && count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxWords);
    if (top.length === 0) {
      return [];
    }
    const max = Math.sqrt(top[0][1]);
    const min = Math.sqrt(top[top.length - 1][1]);
    return top
      .map(([word, count]) => ({
        word,
        count,
        size: max === min ? (small + large) / 2 : small + ((Math.sqrt(count) - min) / (max - min)) * (large - small),
        color: `hsl(var(--chart-${(hash(word) % CHART_COLORS) + 1}))`,
      }))
      // a stable shuffle, so the big words spread through the cloud instead of leading it
      .sort((a, b) => hash(a.word) - hash(b.word));
  }, [wordCountMap, maxWords, small, large]);

  if (words.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-3 gap-y-1 p-4 leading-tight", className)}>
      {words.map((item) => (
        <Tooltip key={item.word}>
          <TooltipTrigger asChild>
            <span className="cursor-default font-semibold transition-opacity hover:opacity-70" style={{fontSize: item.size, color: item.color}}>
              {item.word}
            </span>
          </TooltipTrigger>
          <TooltipContent>{i18next.t("store:Word frequency")}: {item.count}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
