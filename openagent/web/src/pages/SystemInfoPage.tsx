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
import {ArrowDown, ArrowLeftRight, ArrowUp, Code, Database, Gauge, Github, Globe, HardDrive, Link2, Wifi, Zap} from "lucide-react";
import * as SystemBackend from "@/backend/SystemInfo";
import {Badge} from "@/components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {Loading} from "@/components/common/Loading";
import * as Setting from "@/lib/setting";
import {cn} from "@/lib/utils";

const RefreshIntervalMs = 2000;

/** green under 60%, orange under 85%, red above */
function usageColor(percent: number) {
  if (percent >= 85) {
    return "hsl(var(--destructive))";
  }
  if (percent >= 60) {
    return "hsl(var(--warning))";
  }
  return "hsl(var(--success))";
}

function Ring({percent, size = 120}: {percent: number; size?: number}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative mx-auto" style={{width: size, height: size}}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={usageColor(percent)}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(percent, 100) / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums">
        {percent}<span className="text-xs font-normal">%</span>
      </div>
    </div>
  );
}

function InfoCard({icon: Icon, title, live, children, className}: {icon: React.ElementType; title: string; live?: boolean; children: React.ReactNode; className?: string}) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="border-b py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
          {live ? (
            <span className="relative ml-1 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

function Unavailable({text}: {text: string}) {
  return <span className="text-sm text-muted-foreground">{text}</span>;
}

function UsedTotal({used, total}: {used: number; total: number}) {
  const percent = Number((used / total * 100).toFixed(1));
  return (
    <div className="text-center">
      <Ring percent={percent} />
      <div className="mt-4 flex justify-around">
        <div>
          <div className="mb-0.5 text-xs text-muted-foreground">{i18next.t("system:Used")}</div>
          <div className="text-sm font-semibold tabular-nums">{Setting.getFriendlyFileSize(used)}</div>
        </div>
        <div className="w-px bg-border" />
        <div>
          <div className="mb-0.5 text-xs text-muted-foreground">{i18next.t("system:Total")}</div>
          <div className="text-sm font-semibold tabular-nums">{Setting.getFriendlyFileSize(total)}</div>
        </div>
      </div>
    </div>
  );
}

function CpuUsage({usages}: {usages: number[]}) {
  if (usages.length === 0) {
    return <Unavailable text={i18next.t("system:Failed to get CPU usage")} />;
  }
  const average = Number((usages.reduce((a, b) => a + b, 0) / usages.length).toFixed(1));
  return (
    <div>
      <div className="mb-4 text-center">
        <Ring percent={average} size={100} />
        <div className="mt-1 text-xs text-muted-foreground">
          {i18next.t("general:Average")} · {usages.length} {i18next.t("system:cores")}
        </div>
      </div>
      <div className="grid gap-1.5" style={{gridTemplateColumns: `repeat(${Math.min(usages.length, 4)}, minmax(0, 1fr))`}}>
        {usages.map((usage, index) => {
          const percent = Number(usage.toFixed(1));
          return (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <div className="text-center">
                  <div className="mb-0.5 text-[10px] text-muted-foreground">C{index}</div>
                  <div className="relative h-12 overflow-hidden rounded bg-muted">
                    <div
                      className="absolute inset-x-0 bottom-0 opacity-85 transition-[height] duration-500"
                      style={{height: `${percent}%`, backgroundColor: usageColor(percent)}}
                    />
                  </div>
                  <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{percent}%</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>{`Core ${index}: ${percent}%`}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

function NetworkUsage({info}: {info: any}) {
  if (info.networkTotal === undefined || info.networkTotal === null) {
    return <Unavailable text={i18next.t("system:Failed to get network usage")} />;
  }
  const row = (icon: React.ReactNode, label: string, value: number, className: string) => (
    <div className={cn("flex items-center justify-between rounded-lg border px-3.5 py-2.5", className)}>
      <span className="flex items-center gap-1.5 text-sm">{icon}{label}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">{Setting.getFriendlyFileSize(value)}</span>
    </div>
  );
  return (
    <div className="space-y-3">
      {row(<ArrowUp className="h-4 w-4" />, i18next.t("system:Sent"), info.networkSent, "border-success/25 bg-success/5 text-success")}
      {row(<ArrowDown className="h-4 w-4" />, i18next.t("system:Received"), info.networkRecv, "border-blue-500/25 bg-blue-500/5 text-blue-600 dark:text-blue-400")}
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ArrowLeftRight className="h-4 w-4" />
          {i18next.t("system:Total Throughput")}
        </span>
        <span className="text-base font-bold tabular-nums">{Setting.getFriendlyFileSize(info.networkTotal)}</span>
      </div>
    </div>
  );
}

function MetricsTable({rows, columns}: {rows: any[]; columns: {key: string; title: string}[]}) {
  if (!rows || rows.length === 0) {
    return <Loading />;
  }
  return (
    <div className="max-h-[300px] overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>{columns.map((column) => <TableHead key={column.key}>{column.title}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => <TableCell key={column.key} className="break-all text-xs">{row[column.key]}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function SystemInfoPage() {
  const [systemInfo, setSystemInfo] = React.useState<any>({cpuUsage: [], memoryUsed: 0, memoryTotal: 0, diskUsed: 0, diskTotal: 0});
  const [prometheusInfo, setPrometheusInfo] = React.useState<any>({apiThroughput: [], apiLatency: [], totalThroughput: 0});
  const [versionInfo, setVersionInfo] = React.useState<any>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let stopped = false;
    const stop = () => {
      stopped = true;
      clearInterval(timer);
    };

    const refresh = () => {
      SystemBackend.getSystemInfo().then((res: any) => {
        if (stopped) {
          return;
        }
        setLoading(false);
        if (res.status === "ok") {
          setSystemInfo(res.data);
        } else {
          Setting.showMessage("error", res.msg);
          stop();
        }
      }).catch((error: any) => {
        if (!stopped) {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${error}`);
          stop();
        }
      });
      SystemBackend.getPrometheusInfo().then((res: any) => {
        if (!stopped && res.status === "ok" && res.data) {
          setPrometheusInfo(res.data);
        }
      }).catch(() => undefined);
    };

    // the first answer arrives after this line, so `stop` never sees the timer uninitialized
    const timer = setInterval(refresh, RefreshIntervalMs);
    refresh();

    SystemBackend.getVersionInfo().then((res: any) => {
      if (res.status === "ok") {
        setVersionInfo(res.data);
      } else {
        Setting.showMessage("error", res.msg);
      }
    }).catch((error: any) => Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${error}`));

    return stop;
  }, []);

  const releaseLink = versionInfo?.version ? `https://github.com/the-open-agent/openagent/releases/tag/${versionInfo.version}` : undefined;
  let versionText = versionInfo?.version || i18next.t("system:Unknown version");
  if (versionInfo?.commitOffset > 0) {
    versionText += ` (ahead+${versionInfo.commitOffset})`;
  }

  const body = (content: React.ReactNode) => (loading ? <Loading /> : content);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <InfoCard icon={Gauge} title={i18next.t("system:CPU Usage")} live>
        {body(<CpuUsage usages={systemInfo.cpuUsage || []} />)}
      </InfoCard>
      <InfoCard icon={Database} title={i18next.t("system:Memory Usage")} live>
        {body(systemInfo.memoryTotal > 0
          ? <UsedTotal used={systemInfo.memoryUsed} total={systemInfo.memoryTotal} />
          : <Unavailable text={i18next.t("system:Failed to get memory usage")} />)}
      </InfoCard>
      <InfoCard icon={HardDrive} title={i18next.t("system:Disk Usage")} live>
        {body(systemInfo.diskTotal > 0
          ? <UsedTotal used={systemInfo.diskUsed} total={systemInfo.diskTotal} />
          : <Unavailable text={i18next.t("system:Failed to get disk usage")} />)}
      </InfoCard>
      <InfoCard icon={Wifi} title={i18next.t("system:Network Usage")} live>
        {body(<NetworkUsage info={systemInfo} />)}
      </InfoCard>
      <InfoCard icon={Zap} title={i18next.t("system:API Latency")} className="hidden md:block">
        {body(
          <MetricsTable
            rows={prometheusInfo?.apiLatency}
            columns={[
              {key: "name", title: i18next.t("general:Name")},
              {key: "method", title: i18next.t("general:Method")},
              {key: "count", title: i18next.t("general:Count")},
              {key: "latency", title: `${i18next.t("scan:Latency")}(ms)`},
            ]}
          />,
        )}
      </InfoCard>
      <InfoCard icon={ArrowLeftRight} title={i18next.t("system:API Throughput")} className="hidden md:block">
        {body(
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              {i18next.t("system:Total Throughput")}: <span className="font-semibold tabular-nums text-foreground">{prometheusInfo?.totalThroughput}</span>
            </div>
            <MetricsTable
              rows={prometheusInfo?.apiThroughput}
              columns={[
                {key: "name", title: i18next.t("general:Name")},
                {key: "method", title: i18next.t("general:Method")},
                {key: "throughput", title: i18next.t("system:Throughput")},
              ]}
            />
          </div>,
        )}
      </InfoCard>
      <InfoCard icon={Code} title={i18next.t("system:About OpenAgent")} className="md:col-span-2 xl:col-span-3">
        <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {i18next.t("system:🚀⚡️Next-generation personal AI assistant powered by LLM, RAG and agent loops,\nsupporting computer-use, browser-use and coding agent")}
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="https://github.com/the-open-agent/openagent" target="_blank" rel="noreferrer">
            <Badge variant="outline" className="gap-1 px-2.5 py-1"><Github className="h-3.5 w-3.5" />GitHub</Badge>
          </a>
          <a href={releaseLink} target="_blank" rel="noreferrer">
            <Badge variant="info" className="gap-1 px-2.5 py-1"><Link2 className="h-3.5 w-3.5" />{versionText}</Badge>
          </a>
          <a href="https://openagentai.org" target="_blank" rel="noreferrer">
            <Badge variant="success" className="gap-1 px-2.5 py-1"><Globe className="h-3.5 w-3.5" />{i18next.t("system:Official website")}</Badge>
          </a>
        </div>
      </InfoCard>
    </div>
  );
}
