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

import React, {useEffect, useMemo, useRef, useState} from "react";
import ReactEcharts from "echarts-for-react";
import i18next from "i18next";

const GROUP_LINE_COLORS = ["#c41d7f", "#1677ff", "#52c41a", "#d48806", "#531dab"];

/** PUA delimiter: prefix row index, join display label, parse in axisName.formatter; keeps group color mapping. */
const AXIS_ID_SEP = "\uE000";

/**
 * Flattens categories in order. Items under the same main dimension stay adjacent on the circle.
 * @param {Array<{name?: string, items?: object[], score?: number}>} categories
 * @param {boolean} useItems
 */
function buildFlatRows(categories, useItems) {
  const rows = [];
  (categories || []).forEach((cat, gIdx) => {
    const gName = (cat?.name ?? "").trim() || `—${gIdx + 1}—`;
    if (useItems) {
      const its = cat.items || [];
      if (its.length > 0) {
        its.forEach((item) => {
          rows.push({
            name: (item.name ?? "").trim() || gName,
            score: Number(item.score) || 0,
            groupIndex: gIdx,
            groupName: gName,
          });
        });
      } else {
        rows.push({
          name: (cat.name ?? "").trim() || gName,
          score: Number(cat.score) || 0,
          groupIndex: gIdx,
          groupName: gName,
        });
      }
    } else {
      rows.push({
        name: (cat.name ?? "").trim() || gName,
        score: Number(cat.score) || 0,
        groupIndex: gIdx,
        groupName: gName,
      });
    }
  });
  rows.forEach((row, i) => {
    const display = (row.name ?? "").replaceAll(AXIS_ID_SEP, "");
    row.axisKey = `${i}${AXIS_ID_SEP}${display}`;
  });
  return rows;
}

/** Escape `{` and `}` so rich-text axis labels are not parsed as ECharts style tokens. */
function escapeEchartsBraces(s) {
  return (s || "").replace(/[{}]/g, (c) => (c === "{" ? "［" : "］"));
}

/** Series vertex symbols in RadarView carry `__dimIdx` (dimension index). */
function dimIdxFromZrTarget(target) {
  let t = target;
  while (t) {
    if (typeof t.__dimIdx === "number" && t.__dimIdx >= 0) {
      return t.__dimIdx;
    }
    t = t.parent;
  }
  return -1;
}

function pickDimByPixel(chart, x, y) {
  if (!chart || !chart.getModel) {
    return {dim: -1, rOut: 0, maxR: 0, cx: 0, cy: 0};
  }
  const m = chart.getModel().getComponent("radar", 0);
  if (!m) {
    return {dim: -1, rOut: 0, maxR: 0, cx: 0, cy: 0};
  }
  // ECharts: RadarModel.coordinateSystem is the `Radar` impl with `pointToData`.
  const sys = m.coordinateSystem;
  if (!sys || typeof sys.pointToData !== "function") {
    return {dim: -1, rOut: 0, maxR: 0, cx: 0, cy: 0};
  }
  const pr = sys.pointToData([x, y]);
  if (!pr || typeof pr[0] !== "number" || pr[0] < 0) {
    return {dim: -1, rOut: 0, maxR: 0, cx: 0, cy: 0};
  }
  const rOut = Math.hypot(x - sys.cx, y - sys.cy);
  return {dim: pr[0], rOut, maxR: sys.r, cx: sys.cx, cy: sys.cy};
}

export default function TaskAnalysisRadarChart({categories, radarMin = 0, radarMax, chartRef}) {
  const [ec, setEc] = useState(null);
  const [hoverTip, setHoverTip] = useState(null);
  const flatRef = useRef([]);

  const {flat, groupNames, showGroupLegend} = useMemo(() => {
    if (!categories || categories.length === 0) {
      return {flat: [], groupNames: [], showGroupLegend: false};
    }
    const hasItems = (categories || []).some((c) => (c.items || []).length > 0);
    const f = buildFlatRows(categories, hasItems);
    const g = (categories || []).map((c, gIdx) => (c?.name ?? "").trim() || `—${gIdx + 1}—`);
    return {flat: f, groupNames: g, showGroupLegend: g.length > 0};
  }, [categories]);

  flatRef.current = flat;

  useEffect(() => {
    if (!ec || flat.length === 0) {
      return undefined;
    }
    const zr = ec.getZr();
    const onMove = (e) => {
      const ex = e.offsetX;
      const ey = e.offsetY;
      let dimIdx = dimIdxFromZrTarget(e.target);
      if (dimIdx < 0) {
        const pick = pickDimByPixel(ec, ex, ey);
        dimIdx = pick.dim;
        if (dimIdx < 0) {
          setHoverTip(null);
          return;
        }
        if (pick.maxR > 0 && pick.rOut < pick.maxR * 0.1) {
          setHoverTip(null);
          return;
        }
      }
      const row = flatRef.current[dimIdx];
      if (!row) {
        setHoverTip(null);
        return;
      }
      setHoverTip({
        x: ex,
        y: ey,
        name: row.name,
        score: row.score,
        group: row.groupName,
      });
    };
    const clear = () => setHoverTip(null);
    zr.on("mousemove", onMove);
    zr.on("globalout", clear);
    return () => {
      zr.off("mousemove", onMove);
      zr.off("globalout", clear);
    };
  }, [ec, flat.length]);

  if (flat.length === 0) {
    return null;
  }

  const rich = {};
  (categories || []).forEach((_, gIdx) => {
    rich[`g${gIdx}`] = {
      color: GROUP_LINE_COLORS[gIdx % GROUP_LINE_COLORS.length],
      fontSize: 9,
      lineHeight: 12,
    };
  });

  const option = {
    /** ECharts default tooltip (full list) is off; a small custom overlay shows one sub-criterion. */
    tooltip: {show: false},
    radar: {
      triggerEvent: true,
      indicator: flat.map((r) => ({name: r.axisKey, min: radarMin, max: radarMax})),
      center: ["50%", "50%"],
      /** Radar web size in the box; nameGap is small to leave room for long axis names. */
      radius: "80%",
      splitNumber: 4,
      axisName: {
        formatter: (axisKey) => {
          if (!axisKey || typeof axisKey !== "string") {
            return "";
          }
          const p = axisKey.indexOf(AXIS_ID_SEP);
          const i = p >= 0 ? parseInt(axisKey.slice(0, p), 10) : 0;
          const sh = p >= 0 ? axisKey.slice(p + AXIS_ID_SEP.length) : axisKey;
          const gIdx = (flat[i] && Number.isInteger(flat[i].groupIndex)) ? flat[i].groupIndex : 0;
          return `{g${gIdx}|${escapeEchartsBraces(sh || "")}}`;
        },
        rich,
        margin: 2,
      },
      nameGap: 2,
      splitLine: {
        lineStyle: {color: "rgba(0,0,0,0.1)"},
      },
      splitArea: {
        show: true,
        areaStyle: {color: ["rgba(0,0,0,0.01)", "rgba(0,0,0,0.03)"]},
      },
    },
    series: [{
      type: "radar",
      name: i18next.t("task:Score"),
      data: [{
        value: flat.map((r) => r.score),
        name: i18next.t("task:Score"),
        lineStyle: {color: "rgba(22, 119, 255, 0.85)"},
        areaStyle: {opacity: 0.3, color: "rgba(22, 119, 255, 0.35)"},
        symbol: "circle",
        symbolSize: 4,
      }],
    }],
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
        }}
      >
        <ReactEcharts
          ref={chartRef}
          option={option}
          style={{width: "100%", height: "100%"}}
          notMerge
          onChartReady={setEc}
        />
        {hoverTip ? (
          <div
            style={{
              position: "absolute",
              left: (hoverTip.x || 0) + 8,
              top: (hoverTip.y || 0) + 8,
              zIndex: 5,
              maxWidth: 280,
              padding: "8px 10px",
              background: "rgba(255, 255, 255, 0.96)",
              color: "rgba(0, 0, 0, 0.85)",
              fontSize: 12,
              lineHeight: 1.45,
              borderRadius: 4,
              pointerEvents: "none",
              border: "1px solid #e0e0e0",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
            }}
            role="tooltip"
          >
            <div
              style={{
                fontSize: 11,
                color: "rgba(0, 0, 0, 0.45)",
                marginBottom: 2,
                wordBreak: "break-word",
              }}
            >
              {hoverTip.group}
            </div>
            <div style={{wordBreak: "break-word", marginBottom: 4}}>{hoverTip.name}</div>
            <div style={{fontWeight: 600, fontSize: 13}}>
              {i18next.t("task:Score")}：{hoverTip.score}
              {i18next.t("task:Score Unit")}
            </div>
          </div>
        ) : null}
      </div>
      {showGroupLegend ? (
        <div
          style={{
            flexShrink: 0,
            paddingTop: "4px",
            textAlign: "center",
            fontSize: 12,
            lineHeight: 1.5,
            color: "rgba(0,0,0,0.88)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px 16px",
          }}
        >
          {groupNames.map((n, i) => (
            <span key={i} style={{whiteSpace: "nowrap", maxWidth: "100%"}}>
              <span
                style={{
                  color: GROUP_LINE_COLORS[i % GROUP_LINE_COLORS.length],
                  marginRight: 4,
                }}
                aria-hidden
              >
                ●
              </span>
              {n}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
