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

/** One sub-criterion of a task analysis: its score and the model's commentary. */
export interface ReportItem {
  name: string;
  score: number | string;
  advantage?: string;
  disadvantage?: string;
  suggestion?: string;
}

/** A first-level dimension of the scale, holding its sub-criteria. */
export interface ReportCategory {
  name: string;
  score: number | string;
  items?: ReportItem[];
}

export interface TaskReport {
  title?: string;
  designer?: string;
  stage?: string;
  participants?: string;
  grade?: string;
  instructor?: string;
  subject?: string;
  school?: string;
  otherSubjects?: string;
  textbook?: string;
  score?: number | string;
  categories?: ReportCategory[];
}

/** The task row stores the report as a JSON string; older rows may hold an object already. */
export function parseTaskReport(result: unknown): TaskReport | null {
  if (!result) {
    return null;
  }
  if (typeof result === "object") {
    return result as TaskReport;
  }
  try {
    return JSON.parse(String(result));
  } catch {
    return null;
  }
}

export interface FlatItem {
  name: string;
  score: number;
  categoryName: string;
  categoryIndex: number;
}

/** Every sub-criterion in category order, each tagged with the dimension it belongs to. */
export function flattenItems(categories: ReportCategory[] | undefined): FlatItem[] {
  const list: FlatItem[] = [];
  (categories ?? []).forEach((category, categoryIndex) => {
    const categoryName = (category?.name ?? "").trim() || `—${categoryIndex + 1}—`;
    const items = category.items ?? [];
    if (items.length === 0) {
      list.push({name: categoryName, score: Number(category.score) || 0, categoryName, categoryIndex});
      return;
    }
    items.forEach((item) => {
      list.push({name: (item.name ?? "").trim() || categoryName, score: Number(item.score) || 0, categoryName, categoryIndex});
    });
  });
  return list;
}

const NumBands = 5;

export interface ScoreBand {
  min: number;
  max: number;
  label: string;
}

/**
 * Five equal-width score ranges fitted to the scores at hand, rounded to tens,
 * so a report whose scores all sit in 60-90 is not drawn as one 0-100 lump.
 */
export function buildScoreBands(scores: number[]): ScoreBand[] {
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
  const step = (high - low) / NumBands;
  const bands: ScoreBand[] = [];
  for (let i = 0; i < NumBands; i++) {
    const min = Math.round(low + i * step);
    const max = i === NumBands - 1 ? high : Math.round(low + (i + 1) * step);
    if (max > min) {
      bands.push({min, max, label: `${min}-${max}`});
    }
  }
  return bands;
}

/** How many sub-criteria fall in each band; the last band includes its upper bound. */
export function countByScoreBand(categories: ReportCategory[] | undefined): {band: string; count: number}[] {
  const scores = flattenItems(categories).map((item) => item.score);
  const bands = buildScoreBands(scores);
  const counts = bands.map(() => 0);
  scores.forEach((score) => {
    const index = bands.findIndex((band, i) => (i < bands.length - 1 ? score >= band.min && score < band.max : score >= band.min && score <= band.max));
    if (index >= 0) {
      counts[index] += 1;
    }
  });
  return bands.map((band, i) => ({band: band.label, count: counts[i]}));
}

/**
 * The scale the radar is drawn on: 0-5 and 0-10 rubrics keep their own range;
 * percentages use 50-100, where real scores differ enough to see.
 */
export function getRadarDomain(categories: ReportCategory[] | undefined): [number, number] {
  const scores = flattenItems(categories).map((item) => item.score);
  const max = scores.length > 0 ? Math.max(...scores) : 0;
  if (max <= 5) {
    return [0, 5];
  }
  if (max <= 10) {
    return [0, 10];
  }
  return [50, 100];
}

/** The status a score reads as: 80 and up is good, under 60 needs work. */
export function getScoreVariant(score: unknown): "success" | "warning" | "destructive" | "secondary" {
  const n = Number(score);
  if (!Number.isFinite(n)) {
    return "secondary";
  }
  if (n >= 80) {
    return "success";
  }
  if (n >= 60) {
    return "warning";
  }
  return "destructive";
}

export function formatScore(score: unknown) {
  const n = Number(score);
  if (!Number.isFinite(n)) {
    return "";
  }
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** True when the dimension's title already carries its own number ("1." / "2）"). */
function hasLeadingIndex(name: string) {
  return /^\d+[.)、]/.test(name.trim());
}

export function formatCategoryHeading(category: ReportCategory, index: number) {
  const name = (category?.name ?? "").trim();
  if (!name) {
    return `${index + 1}.`;
  }
  return hasLeadingIndex(name) ? name : `${index + 1}. ${name}`;
}

/** Chinese documents number their sections "1、"; others use "1.". */
export function formatCategoryTitleForDocx(category: ReportCategory, index: number, zh: boolean) {
  const name = (category?.name ?? "").trim();
  if (!name) {
    return zh ? `${index + 1}、` : `${index + 1}.`;
  }
  if (hasLeadingIndex(name)) {
    return name;
  }
  return zh ? `${index + 1}、${name}` : `${index + 1}. ${name}`;
}
