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
import {Ban, CircleAlert, CircleCheck, CircleX, MessageSquare, ShieldCheck, TriangleAlert, Users} from "lucide-react";
import * as AnalysisBackend from "@/backend/AnalysisBackend";
import {Badge} from "@/components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {UserLabel} from "@/components/common/UserLabel";
import {BarList, EmptyNote, ReportBody, type ReportProps, StatCard, formatTemplate, useReport, usePeriodControls} from "@/components/store/InsightsCommon";
import {cn} from "@/lib/utils";

type Status = "pass" | "warn" | "fail";

const StatusMeta: Record<Status, {icon: React.ReactNode; text: string; badge: "success" | "warning" | "destructive"; label: () => string}> = {
  pass: {icon: <CircleCheck />, text: "text-success", badge: "success", label: () => i18next.t("video:Pass")},
  warn: {icon: <CircleAlert />, text: "text-warning", badge: "warning", label: () => i18next.t("store:Warning")},
  fail: {icon: <CircleX />, text: "text-destructive", badge: "destructive", label: () => i18next.t("video:Fail")},
};

const SeverityMeta: Record<string, {badge: "destructive" | "warning" | "secondary"; label: () => string}> = {
  high: {badge: "destructive", label: () => i18next.t("store:High")},
  medium: {badge: "warning", label: () => i18next.t("figure:Medium")},
  low: {badge: "secondary", label: () => i18next.t("store:Low")},
};

function scoreTone(score: number) {
  if (score >= 75) {
    return {text: "text-success", stroke: "hsl(var(--success))"};
  }
  if (score >= 60) {
    return {text: "text-warning", stroke: "hsl(var(--warning))"};
  }
  return {text: "text-destructive", stroke: "hsl(var(--destructive))"};
}

const SecretCategoryKeys: Record<string, string> = {
  privateKey: "store:sec.secret.privateKey",
  apiKey: "store:sec.secret.apiKey",
  awsAccessKey: "store:sec.secret.awsAccessKey",
  slackToken: "store:sec.secret.slackToken",
  githubToken: "store:sec.secret.githubToken",
  jwt: "store:sec.secret.jwt",
  credentialAssignment: "store:sec.secret.credentialAssignment",
};

/** The backend sends each check as a key, a status and numbers; the wording lives here so it can be translated. */
function checkText(check: any): {title: string; detail: string; fix: string} {
  const meta = check.meta ?? {};
  const t = (key: string) => i18next.t(key);
  switch (check.key) {
  case "prompt_secret_scan": {
    const categories = (meta.categories ?? []).map((c: string) => (SecretCategoryKeys[c] ? t(SecretCategoryKeys[c]) : c)).join(", ");
    return {
      title: t("store:Secrets in agent definition"),
      detail: check.status === "fail"
        ? formatTemplate(t("store:Possible secrets detected in the agent's prompt or description: {c}."), {c: categories})
        : t("store:No hard-coded secrets found in the agent's prompt or description."),
      fix: t("store:Remove credentials from the prompt/description and inject them at runtime via a provider or environment variable."),
    };
  }
  case "api_key_exposure":
    return {
      title: t("store:API key exposure"),
      detail: check.status === "fail"
        ? t("store:The store's external API key appears in a text field readable by clients.")
        : meta.hasKey ? t("store:The external API key is set and not exposed in any readable text field.") : t("store:No external API key is configured."),
      fix: t("store:Rotate the external API key and remove it from the prompt, description, and welcome text."),
    };
  case "content_moderation":
    return {
      title: t("store:Content moderation list"),
      detail: check.status === "warn"
        ? t("store:No forbidden words are configured, so user input is not filtered.")
        : formatTemplate(t("store:{n} forbidden word(s) configured for input filtering."), {n: meta.wordCount}),
      fix: t("store:Add forbidden words in the agent settings to block abusive or sensitive input."),
    };
  case "file_upload_policy":
    return {
      title: t("store:File upload policy"),
      detail: check.status === "warn"
        ? t("store:This agent is public and file uploads are enabled, allowing anyone to upload files.")
        : meta.disabled ? t("store:File uploads are disabled.") : t("store:File uploads are enabled."),
      fix: t("store:Disable file uploads for public agents, or ensure uploaded files are scanned and access-controlled."),
    };
  case "public_exposure":
    return {
      title: t("store:Public exposure"),
      detail: check.status === "warn" ? t("store:This agent is published and reachable by anyone in the public Hub.") : t("store:This agent is not published publicly."),
      fix: t("store:Review the prompt, files, and knowledge base for sensitive content before publishing."),
    };
  case "tool_attack_surface":
    return {
      title: t("store:Tool & capability surface"),
      detail: check.status === "warn"
        ? formatTemplate(t("store:{tools} tool(s), {skills} skill(s){mcp} are enabled, expanding the attack surface."), {tools: meta.toolCount, skills: meta.skillCount, mcp: meta.hasMcp ? t("store: and an MCP server") : ""})
        : t("store:No external tools, skills, or MCP servers are enabled."),
      fix: t("store:Enable only the tools and skills this agent needs, and review MCP server permissions."),
    };
  case "access_control":
    return {
      title: t("store:Co-owner access control"),
      detail: check.status === "warn" ? formatTemplate(t("store:{n} owners have write access to this agent."), {n: meta.ownerCount}) : t("store:Only the primary owner can modify this agent."),
      fix: t("store:Keep the co-owner list minimal and remove owners who no longer need write access."),
    };
  case "forbidden_word_violations":
    return {
      title: t("store:Forbidden-word violations"),
      detail: check.status === "fail"
        ? formatTemplate(t("store:{hits} message(s) tripped the forbidden-word filter in this window."), {hits: meta.hits})
        : formatTemplate(t("store:No forbidden-word violations across {n} scanned message(s)."), {n: meta.messagesScanned}),
      fix: t("store:Review the flagged messages below and consider blocking or warning the users involved."),
    };
  default:
    return {title: check.key, detail: "", fix: ""};
  }
}

/** The score on a 260° arc, open at the bottom. */
function ScoreGauge({score}: {score: number}) {
  const tone = scoreTone(score);
  const radius = 52;
  const sweep = 260;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * sweep / 360;
  const filled = arc * Math.max(0, Math.min(100, score)) / 100;
  // the arc starts at 230° (lower left) and runs clockwise
  const rotate = 90 + (360 - sweep) / 2;
  return (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${arc} ${circumference}`} transform={`rotate(${rotate} 60 60)`} />
        <circle cx="60" cy="60" r={radius} fill="none" stroke={tone.stroke} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${filled} ${circumference}`} transform={`rotate(${rotate} 60 60)`} />
      </svg>
      <div className={cn("absolute inset-0 flex items-center justify-center text-4xl font-semibold tabular-nums", tone.text)}>{score}</div>
    </div>
  );
}

function ScoreCard({data}: {data: any}) {
  const tone = scoreTone(data.score);
  const total = data.passCount + data.warnCount + data.failCount;
  const counts: {status: Status; label: string; value: number; color: string}[] = [
    {status: "pass", label: i18next.t("store:Passed"), value: data.passCount, color: "hsl(var(--success))"},
    {status: "warn", label: i18next.t("store:Warnings"), value: data.warnCount, color: "hsl(var(--warning))"},
    {status: "fail", label: i18next.t("application:Failed"), value: data.failCount, color: "hsl(var(--destructive))"},
  ];
  return (
    <Card>
      <CardContent className="grid items-center gap-6 p-4 sm:grid-cols-[200px_1fr]">
        <div className="text-center">
          <ScoreGauge score={data.score} />
          <Badge variant="outline" className={cn("-mt-3 text-sm font-semibold", tone.text)}>{i18next.t("store:Security grade")} {data.grade}</Badge>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />{i18next.t("store:Security score")}
          </div>
        </div>
        <div>
          <div className="grid grid-cols-3 gap-4">
            {counts.map((item) => (
              <div key={item.status}>
                <div className={cn("flex items-center gap-1.5 text-xs font-medium [&_svg]:h-3.5 [&_svg]:w-3.5", StatusMeta[item.status].text)}>{StatusMeta[item.status].icon}{item.label}</div>
                <div className={cn("mt-1 text-2xl font-semibold tabular-nums", StatusMeta[item.status].text)}>{item.value}</div>
              </div>
            ))}
          </div>
          {total > 0 ? (
            <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-muted">
              {counts.filter((item) => item.value > 0).map((item) => (
                <div key={item.status} style={{width: `${item.value / total * 100}%`, backgroundColor: item.color}} />
              ))}
            </div>
          ) : null}
          <p className="mt-4 text-sm text-muted-foreground">
            {i18next.t("store:This report audits the agent's configuration and recent activity. Address failed and warned checks to improve the score.")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityReport({owner, storeName, period, refreshTick, onLoaded}: ReportProps) {
  const state = useReport<any>(() => AnalysisBackend.getStoreSecurity(owner, storeName, period), [owner, storeName, period, refreshTick], onLoaded);

  return (
    <ReportBody state={state}>
      {(data) => {
        const checks: any[] = data.checks ?? [];
        if (checks.length === 0) {
          return <EmptyNote text={i18next.t("store:No security data available")} />;
        }
        const words: any[] = data.topForbiddenWords ?? [];
        const flagged: any[] = data.flaggedMessages ?? [];
        return (
          <>
            <ScoreCard data={data} />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard icon={<MessageSquare />} label={i18next.t("store:Messages scanned")} value={data.messagesScanned ?? 0} />
              <StatCard icon={<Ban />} label={i18next.t("store:Forbidden-word hits")} value={data.forbiddenWordHits ?? 0} valueClassName={data.forbiddenWordHits > 0 ? "text-destructive" : undefined} />
              <StatCard icon={<TriangleAlert />} label={i18next.t("store:Error replies")} value={data.errorMessages ?? 0} valueClassName={data.errorMessages > 0 ? "text-warning" : undefined} />
              <StatCard
                icon={<Users />}
                label={i18next.t("store:Visits")}
                value={(data.guestVisits ?? 0) + (data.authedVisits ?? 0)}
                hint={formatTemplate(i18next.t("store:{g} guest / {a} signed-in"), {g: data.guestVisits ?? 0, a: data.authedVisits ?? 0})}
              />
            </div>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" />{i18next.t("store:Data compliance check")}</CardTitle>
              </CardHeader>
              <CardContent className="py-0">
                {checks.map((check) => {
                  const status = StatusMeta[check.status as Status] ?? StatusMeta.warn;
                  const severity = SeverityMeta[check.severity] ?? SeverityMeta.low;
                  const text = checkText(check);
                  return (
                    <div key={check.key} className="flex items-start gap-3 border-b py-3.5 last:border-b-0">
                      <span className={cn("mt-0.5 shrink-0 [&_svg]:h-5 [&_svg]:w-5", status.text)}>{status.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">{text.title}</span>
                          <span className="flex gap-1.5">
                            <Badge variant={severity.badge}>{severity.label()}</Badge>
                            <Badge variant={status.badge}>{status.label()}</Badge>
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{text.detail}</p>
                        {check.status !== "pass" && text.fix ? (
                          <p className="mt-2 rounded-md bg-muted/60 px-3 py-1.5 text-sm text-muted-foreground">
                            <span className="font-medium">{i18next.t("store:Recommendation")}: </span>{text.fix}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            {words.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm"><Ban className="h-4 w-4" />{i18next.t("store:Top forbidden words")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarList items={words} label={(word) => word.label} value={(word) => word.count} color="hsl(var(--destructive))" />
                </CardContent>
              </Card>
            ) : null}
            {flagged.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm"><Ban className="h-4 w-4" />{i18next.t("store:Flagged messages")}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[170px]">{i18next.t("general:User")}</TableHead>
                        <TableHead className="w-[130px]">{i18next.t("store:Word")}</TableHead>
                        <TableHead>{i18next.t("store:Context")}</TableHead>
                        <TableHead className="w-[180px]">{i18next.t("general:Created time")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flagged.map((message, index) => (
                        <TableRow key={`${message.chat}-${index}`}>
                          <TableCell>{message.user ? <UserLabel user={message.user} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell><Badge variant="destructive">{message.word}</Badge></TableCell>
                          <TableCell className="text-sm">{message.snippet}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{message.createdTime ? new Date(message.createdTime).toLocaleString() : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}
          </>
        );
      }}
    </ReportBody>
  );
}

/** The agent's Security tab: its own window and refresh above the security report. */
export function StoreSecurity({account, owner, storeName}: {account: any; owner: string; storeName: string}) {
  const controls = usePeriodControls();
  return (
    <div className="space-y-4">
      {controls.bar}
      <SecurityReport account={account} owner={owner} storeName={storeName} period={controls.period} refreshTick={controls.refreshTick} onLoaded={controls.setAsOf} />
    </div>
  );
}

export default StoreSecurity;
