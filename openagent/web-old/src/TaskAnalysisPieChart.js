// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use it except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React from "react";
import ReactEcharts from "echarts-for-react";
import i18next from "i18next";
import {
  TASK_SCORE_BAND_COLORS,
  buildBandsFromScores,
  collectScoresFromCategories
} from "./taskAnalysisScoreBands";

function countByScoreBand(categories) {
  const scores = collectScoresFromCategories(categories);
  const bands = buildBandsFromScores(scores);
  if (bands.length === 0) {
    return [];
  }
  const counts = bands.map(() => 0);
  scores.forEach((s) => {
    const idx = bands.findIndex((b, i) => (i < bands.length - 1 ? s >= b.min && s < b.max : s >= b.min && s <= b.max));
    if (idx >= 0) {
      counts[idx] += 1;
    }
  });
  return bands.map((b, i) => ({
    band: b.label,
    count: counts[i],
  })).filter((d) => d.count > 0);
}

export default function TaskAnalysisPieChart({categories, chartRef}) {
  const bandData = countByScoreBand(categories);
  if (bandData.length === 0) {
    return null;
  }
  const scoreUnit = i18next.t("task:Score Unit");
  const data = bandData.map((d, i) => ({
    name: `${d.band}${scoreUnit} (${d.count}${i18next.t("task:Item count unit")})`,
    value: d.count,
    itemStyle: {color: TASK_SCORE_BAND_COLORS[i % TASK_SCORE_BAND_COLORS.length]},
  }));
  const option = {
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)",
    },
    legend: {
      orient: "vertical",
      right: "8%",
      top: "center",
      textStyle: {fontSize: 12, color: "#000"},
    },
    series: [{
      type: "pie",
      radius: ["40%", "70%"],
      center: ["40%", "52%"],
      avoidLabelOverlap: true,
      itemStyle: {borderColor: "#fff", borderWidth: 2},
      label: {fontSize: 12, color: "#000"},
      data,
    }],
  };
  return <ReactEcharts ref={chartRef} option={option} style={{width: "100%", height: "100%"}} notMerge />;
}
