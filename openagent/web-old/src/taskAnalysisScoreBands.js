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

/** Same palette as TaskAnalysisPieChart — low → high score band. */
export const TASK_SCORE_BAND_COLORS = ["#f5222d", "#fa8c16", "#faad14", "#52c41a", "#1677ff"];

const NUM_BANDS = 5;

export function collectScoresFromCategories(categories) {
  const scores = [];
  (categories || []).forEach((cat) => {
    (cat.items || []).forEach((item) => {
      const s = Number(item.score) || 0;
      scores.push(s);
    });
  });
  return scores;
}

export function buildBandsFromScores(scores) {
  if (scores.length === 0) {
    return [];
  }
  const dataMin = Math.min(...scores);
  const dataMax = Math.max(...scores);
  const low = Math.max(0, dataMin <= 10 ? 0 : Math.floor(dataMin / 10) * 10);
  let high = Math.min(100, dataMax >= 90 ? 100 : Math.ceil((dataMax + 5) / 10) * 10);
  if (high <= low) {
    high = Math.min(100, low + 20);
  }
  const step = (high - low) / NUM_BANDS;
  const bands = [];
  for (let i = 0; i < NUM_BANDS; i++) {
    const bMin = Math.round(low + i * step);
    const bMax = i === NUM_BANDS - 1 ? high : Math.round(low + (i + 1) * step);
    if (bMax > bMin) {
      bands.push({min: bMin, max: bMax, label: `${bMin}-${bMax}`});
    }
  }
  return bands;
}

/**
 * Hex color for a sub-criterion score, aligned with "Score share by first-level dimension" bands.
 */
export function getScoreBandColor(score, categories) {
  const scores = collectScoresFromCategories(categories);
  const bands = buildBandsFromScores(scores);
  if (bands.length === 0) {
    return null;
  }
  const s = Number(score) || 0;
  const idx = bands.findIndex((b, i) => (i < bands.length - 1 ? s >= b.min && s < b.max : s >= b.min && s <= b.max));
  if (idx < 0) {
    return TASK_SCORE_BAND_COLORS[TASK_SCORE_BAND_COLORS.length - 1];
  }
  return TASK_SCORE_BAND_COLORS[idx % TASK_SCORE_BAND_COLORS.length];
}
