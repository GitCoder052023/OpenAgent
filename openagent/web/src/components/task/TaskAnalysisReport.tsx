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
import {Download, Maximize2} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {LowScoreBars, RankedScoreBars, ScoreDistribution, ScoreRadar} from "@/components/task/TaskReportCharts";
import {chartToPngDataUrl} from "@/lib/chart-image";
import {formatCategoryHeading, getScoreVariant, type ReportCategory, type TaskReport} from "@/lib/task-report";
import * as Setting from "@/lib/setting";

type ChartKey = "radar" | "bar" | "pie" | "lowScoreBar";

const charts: {key: ChartKey; captionKey: string; render: (categories: ReportCategory[]) => React.ReactNode}[] = [
  {key: "radar", captionKey: "task:Chart caption radar", render: (categories) => <ScoreRadar categories={categories} />},
  {key: "bar", captionKey: "task:Chart caption bar ranked", render: (categories) => <RankedScoreBars categories={categories} />},
  {key: "pie", captionKey: "task:Chart caption pie", render: (categories) => <ScoreDistribution categories={categories} />},
  {key: "lowScoreBar", captionKey: "task:Chart caption priority dimensions", render: (categories) => <LowScoreBars categories={categories} />},
];

/**
 * The analysis of a task's document against its scale: who and what it is about,
 * the overall score, four charts, and every sub-criterion's commentary.
 */
export function TaskAnalysisReport({result, downloadFileName}: {result: TaskReport; downloadFileName?: string}) {
  const chartRefs = React.useRef<Record<ChartKey, HTMLDivElement | null>>({radar: null, bar: null, pie: null, lowScoreBar: null});
  const [downloading, setDownloading] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState<ChartKey | null>(null);
  const categories = result.categories ?? [];

  const meta: [string, string | undefined][] = [
    [i18next.t("task:Unit Name"), result.title],
    [i18next.t("task:Designer"), result.designer],
    [i18next.t("video:Stage"), result.stage],
    [i18next.t("task:Participants"), result.participants],
    [i18next.t("store:Grade"), result.grade],
    [i18next.t("task:Instructor"), result.instructor],
    [i18next.t("store:Subject"), result.subject],
    [i18next.t("video:School"), result.school],
    [i18next.t("task:Other Subjects"), result.otherSubjects],
    [i18next.t("task:Textbook"), result.textbook],
  ];

  const download = async() => {
    setDownloading(true);
    try {
      // the docx library and the report text only load when someone downloads
      const {downloadTaskAnalysisReportDocx} = await import("@/lib/task-report-docx");
      const chartImages: Partial<Record<ChartKey, string>> = {};
      for (const {key} of charts) {
        const image = await chartToPngDataUrl(chartRefs.current[key]).catch(() => null);
        if (image) {
          chartImages[key] = image;
        }
      }
      await downloadTaskAnalysisReportDocx(result, {fileName: downloadFileName || "task_report.docx", chartImages});
      Setting.showMessage("success", i18next.t("general:Successfully downloaded"));
    } catch (error: any) {
      Setting.showMessage("error", error?.message || String(error));
    } finally {
      setDownloading(false);
    }
  };

  const fullscreenChart = charts.find((chart) => chart.key === fullscreen);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-md border bg-muted/40 p-3 text-sm sm:grid-cols-2">
        {meta.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <span className="whitespace-nowrap font-medium">{label}：</span>
            <span className="min-w-0 break-words">{value || "-"}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="text-base font-semibold">
          {i18next.t("task:Overall Score")}：<span className="text-xl tabular-nums text-primary">{result.score}</span>
        </div>
        <Button loading={downloading} onClick={download}>
          <Download />
          {i18next.t("task:Download report")}
        </Button>
      </div>

      {categories.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {charts.map((chart) => (
            <div key={chart.key} className="flex min-w-0 flex-col rounded-lg border bg-card p-3 shadow-sm">
              <div className="relative mb-2 border-b pb-2 text-center text-sm font-semibold">
                {i18next.t(chart.captionKey)}
                <Button
                  variant="ghost"
                  size="iconSm"
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={i18next.t(chart.captionKey)}
                  onClick={() => setFullscreen(chart.key)}
                >
                  <Maximize2 />
                </Button>
              </div>
              <div ref={(el) => {
                chartRefs.current[chart.key] = el;
              }} className="h-[400px] min-h-0"
              >
                {chart.render(categories)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Dialog open={fullscreen !== null} onOpenChange={(open) => !open && setFullscreen(null)}>
        <DialogContent className="flex h-[90vh] max-w-[95vw] flex-col">
          <DialogHeader>
            <DialogTitle>{fullscreenChart ? i18next.t(fullscreenChart.captionKey) : ""}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">{fullscreenChart?.render(categories)}</div>
        </DialogContent>
      </Dialog>

      {categories.map((category, index) => (
        <div key={index} className="space-y-2">
          <div className="text-sm font-semibold">
            {formatCategoryHeading(category, index)}（{i18next.t("task:Score")}：{category.score}{i18next.t("task:Score Unit")}）
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[12%]">{i18next.t("task:Sub-criteria")}</TableHead>
                  <TableHead className="w-[8%]">{i18next.t("task:Score")}</TableHead>
                  <TableHead className="w-[27%]">{i18next.t("task:Advantages")}</TableHead>
                  <TableHead className="w-[27%]">{i18next.t("task:Disadvantages")}</TableHead>
                  <TableHead className="w-[26%]">{i18next.t("task:Suggestion")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(category.items ?? []).map((item, itemIndex) => (
                  <TableRow key={itemIndex} className="align-top">
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant={getScoreVariant(item.score)} className="whitespace-nowrap tabular-nums">
                        {item.score}{i18next.t("task:Score Unit")}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-pre-wrap">{item.advantage}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{item.disadvantage}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{item.suggestion}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
