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
import {Link} from "react-router-dom";
import {Activity, Clock, Cloud, Coins, Eye, File, GitFork, Link2, MapPin, MessageSquare, MessagesSquare, Route, Star, Trophy, User, Users, Zap} from "lucide-react";
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import * as AnalysisBackend from "@/backend/AnalysisBackend";
import * as StoreBackend from "@/backend/StoreBackend";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {WordCloud} from "@/components/charts/WordCloud";
import {UserLabel} from "@/components/common/UserLabel";
import {StoreAvatar} from "@/components/store/StoreHubDrawer";
import {BarList, EmptyNote, ReportBody, type ReportProps, Sparkline, StatCard, axisTick, formatTemplate, tooltipStyle, useReport, usePeriodControls} from "@/components/store/InsightsCommon";
import {cn} from "@/lib/utils";

export const InsightsSubs = ["pulse", "contributors", "traffic", "wordcloud", "cost", "stargazers", "watchers", "forks"] as const;
export type InsightsSub = typeof InsightsSubs[number];

function subTabs(): {key: InsightsSub; icon: React.ReactNode; label: string}[] {
  return [
    {key: "pulse", icon: <Zap />, label: i18next.t("store:Pulse")},
    {key: "contributors", icon: <Users />, label: i18next.t("store:Contributors")},
    {key: "traffic", icon: <MapPin />, label: i18next.t("store:Traffic")},
    {key: "wordcloud", icon: <Cloud />, label: i18next.t("store:Word Cloud")},
    {key: "cost", icon: <Coins />, label: i18next.t("store:Cost")},
    {key: "stargazers", icon: <Star />, label: i18next.t("store:Stargazers")},
    {key: "watchers", icon: <Eye />, label: i18next.t("store:Watchers")},
    {key: "forks", icon: <GitFork />, label: i18next.t("store:Forks")},
  ];
}

interface LineSeries {
  key: string;
  name: string;
  color: string;
  area?: boolean;
  /** draws on the right-hand axis */
  right?: boolean;
}

/** Counts over the window, with an optional second axis for a measure on another scale. */
function SeriesChart({rows, series, height = 260}: {rows: any[]; series: LineSeries[]; height?: number}) {
  const hasRight = series.some((item) => item.right);
  return (
    <div style={{height}}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{top: 8, right: hasRight ? 0 : 16, bottom: 0, left: -8}}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tickLine={false} axisLine={{stroke: "hsl(var(--border))"}} tick={axisTick} minTickGap={24} />
          <YAxis yAxisId="left" allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} width={48} />
          {hasRight ? <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={axisTick} width={56} /> : null}
          <Tooltip contentStyle={tooltipStyle} cursor={{stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3"}} />
          {series.length > 1 ? <Legend iconType="plainline" wrapperStyle={{fontSize: 12, color: "hsl(var(--muted-foreground))"}} /> : null}
          {series.map((item) => (
            <Line
              key={item.key}
              yAxisId={item.right ? "right" : "left"}
              type="monotone"
              dataKey={item.key}
              name={item.name}
              stroke={item.color}
              strokeWidth={2}
              dot={false}
              activeDot={{r: 4, strokeWidth: 2, stroke: "hsl(var(--card))"}}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Section({icon, title, extra, children, className}: {icon?: React.ReactNode; title: React.ReactNode; extra?: React.ReactNode; children: React.ReactNode; className?: string}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm [&_svg]:h-4 [&_svg]:w-4">
          {icon}{title}
          {extra ? <span className="text-xs font-normal text-muted-foreground">{extra}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Pulse({owner, storeName, period, refreshTick, onLoaded}: ReportProps) {
  const state = useReport<any>(() => AnalysisBackend.getStoreInsightsSummary(owner, storeName, period), [owner, storeName, period, refreshTick], onLoaded);
  return (
    <ReportBody state={state}>
      {(data) => {
        const buckets: any[] = data.buckets ?? [];
        const cards = [
          {label: i18next.t("general:Chats"), value: data.chatCount, series: buckets.map((b) => b.chats), icon: <MessagesSquare />},
          {label: i18next.t("general:Messages"), value: data.messageCount, series: buckets.map((b) => b.messages), icon: <MessageSquare />},
          {label: i18next.t("store:Files added"), value: data.filesAdded, series: buckets.map((b) => b.filesAdded), icon: <File />},
          {label: i18next.t("store:Vectors added"), value: data.vectorsAdded, series: buckets.map((b) => b.vectorsAdded), icon: <Zap />},
        ];
        const topUsers: any[] = data.topUsers ?? [];
        return (
          <>
            <p className="text-sm text-muted-foreground">
              {[
                formatTemplate(i18next.t("store:{n} active users"), {n: data.activeUsers}),
                formatTemplate(i18next.t("store:{n} chats"), {n: data.chatCount}),
                formatTemplate(i18next.t("store:{n} messages"), {n: data.messageCount}),
                formatTemplate(i18next.t("store:{n} files added"), {n: data.filesAdded}),
                formatTemplate(i18next.t("store:{n} vectors added"), {n: data.vectorsAdded}),
              ].join(" · ")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((card) => (
                <StatCard key={card.label} icon={card.icon} label={card.label} value={card.value ?? 0}>
                  <Sparkline values={card.series} />
                </StatCard>
              ))}
            </div>
            <Section icon={<Users />} title={i18next.t("store:Active users")}>
              {topUsers.length === 0 ? <EmptyNote text={i18next.t("store:No activity in this window")} /> : (
                <BarList
                  items={topUsers}
                  label={(user) => <UserLabel user={user.user} />}
                  value={(user) => user.messageCount}
                  trailing={(user) => `${user.messageCount} · ${user.chatCount} ${i18next.t("store:chats").toLowerCase()}`}
                />
              )}
            </Section>
          </>
        );
      }}
    </ReportBody>
  );
}

function Contributors({owner, storeName, period, refreshTick, onLoaded}: ReportProps) {
  const state = useReport<any>(() => AnalysisBackend.getStoreContributors(owner, storeName, period, 20), [owner, storeName, period, refreshTick], onLoaded);
  return (
    <ReportBody state={state}>
      {(data) => {
        const contributors: any[] = data.contributors ?? [];
        return (
          <>
            <Section icon={<Users />} title={i18next.t("store:Activity over time")} extra={formatTemplate(i18next.t("store:{n} active users"), {n: data.totalActiveUsers})}>
              <SeriesChart
                height={220}
                rows={data.totalSeries ?? []}
                series={[{key: "messageCount", name: i18next.t("general:Messages"), color: "hsl(var(--chart-1))"}]}
              />
            </Section>
            {contributors.length === 0 ? (
              <Card><CardContent className="p-4"><EmptyNote text={i18next.t("store:No activity in this window")} /></CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {contributors.map((contributor) => (
                  <Card key={contributor.user}>
                    <CardContent className="p-4">
                      <UserLabel user={contributor.user} className="font-medium" />
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-muted-foreground">{i18next.t("general:Messages")}</div>
                          <div className="text-lg font-semibold tabular-nums">{contributor.messageCount}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{i18next.t("general:Chats")}</div>
                          <div className="text-lg font-semibold tabular-nums">{contributor.chatCount}</div>
                        </div>
                      </div>
                      <Sparkline values={(contributor.series ?? []).map((point: any) => point.messageCount)} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        );
      }}
    </ReportBody>
  );
}

function Traffic({owner, storeName, period, refreshTick, onLoaded}: ReportProps) {
  const state = useReport<any>(() => AnalysisBackend.getStoreTraffic(owner, storeName, period), [owner, storeName, period, refreshTick], onLoaded);
  return (
    <ReportBody state={state}>
      {(data) => {
        const buckets: any[] = data.buckets ?? [];
        // 24h buckets are hours, so the busiest one is a peak hour, not a peak day
        const peak = buckets.reduce((acc, bucket) => (bucket.views > acc.views ? bucket : acc), {date: "—", views: 0});
        const topList = (items: any[] | undefined) => (!items || items.length === 0)
          ? <EmptyNote text={i18next.t("store:No data in this window")} />
          : <BarList items={items} label={(item) => <span title={item.label}>{item.label}</span>} value={(item) => item.count} />;
        return (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={<Eye />} label={i18next.t("store:Total views")} value={data.totalViews ?? 0} />
              <StatCard icon={<User />} label={i18next.t("store:Unique visitors")} value={data.totalUniqueVisitors ?? 0} />
              <StatCard icon={<Activity />} label={data.period === "24h" ? i18next.t("store:Peak hour") : i18next.t("store:Peak day")} value={peak.views} hint={peak.date} />
            </div>
            <Card>
              <CardContent className="p-4">
                <SeriesChart
                  rows={buckets}
                  series={[
                    {key: "views", name: i18next.t("store:Views"), color: "hsl(var(--chart-1))"},
                    {key: "uniqueVisitors", name: i18next.t("store:Unique visitors"), color: "hsl(var(--chart-4))"},
                  ]}
                />
              </CardContent>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <Section icon={<Link2 />} title={i18next.t("store:Top referrers")}>{topList(data.topReferrers)}</Section>
              <Section icon={<Route />} title={i18next.t("store:Top paths")}>{topList(data.topPaths)}</Section>
            </div>
          </>
        );
      }}
    </ReportBody>
  );
}

function WordCloudReport({storeName, period, refreshTick, onLoaded}: ReportProps) {
  const state = useReport<Record<string, number>>(
    () => AnalysisBackend.getStoreWordCloud(storeName, period).then((res: any) => (res.status === "ok" ? {...res, data: res.data ?? {}} : res)),
    [storeName, period, refreshTick],
    onLoaded,
    () => new Date().toISOString(),
  );
  const [minFreq, setMinFreq] = React.useState(2);

  return (
    <ReportBody state={state}>
      {(wordMap) => {
        const entries = Object.entries(wordMap);
        const maxFreq = entries.reduce((max, [, count]) => Math.max(max, count), 1);
        // the default of 2 would hide every word of a quiet agent, so it is clamped
        const effective = Math.min(minFreq, maxFreq);
        const shown = Object.fromEntries(entries.filter(([, count]) => count >= effective));
        const shownCount = Object.keys(shown).length;
        return (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={<Cloud />} label={i18next.t("store:Distinct words")} value={entries.length} />
              <StatCard label={i18next.t("store:Shown after filter")} value={shownCount} />
              <Card>
                <CardContent className="p-4">
                  <label htmlFor="word-cloud-min-freq" className="text-xs font-medium text-muted-foreground">
                    {i18next.t("store:Min frequency")}: <span className="tabular-nums text-foreground">{effective}</span>
                  </label>
                  <input
                    id="word-cloud-min-freq"
                    type="range"
                    min={1}
                    max={maxFreq}
                    value={effective}
                    onChange={(e) => setMinFreq(Number(e.target.value))}
                    className="mt-3 w-full accent-[hsl(var(--primary))]"
                  />
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardContent className="p-4">
                {shownCount === 0 ? <EmptyNote text={i18next.t("store:No words match the current filter")} /> : <WordCloud wordCountMap={shown} className="min-h-[320px]" />}
              </CardContent>
            </Card>
          </>
        );
      }}
    </ReportBody>
  );
}

function formatPrice(value: any, currency: string) {
  if (value === undefined || value === null) {
    return "—";
  }
  const num = Number(value).toFixed(4);
  return currency ? `${num} ${currency}` : num;
}

function Cost({owner, storeName, period, refreshTick, onLoaded}: ReportProps) {
  const state = useReport<any>(() => AnalysisBackend.getStoreCostSeries(owner, storeName, period), [owner, storeName, period, refreshTick], onLoaded);
  return (
    <ReportBody state={state}>
      {(data) => {
        const costName = data.currency ? `${i18next.t("store:Cost")} (${data.currency})` : i18next.t("store:Cost");
        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<Zap />} label={i18next.t("store:Total tokens")} value={data.totalTokenCount ?? 0} />
              <StatCard icon={<Coins />} label={i18next.t("store:Total cost")} value={formatPrice(data.totalPrice, data.currency)} />
              <StatCard icon={<MessageSquare />} label={i18next.t("store:Avg per message")} value={formatPrice(data.avgPricePerMsg, data.currency)} hint={`~${Math.round(data.avgTokensPerMsg || 0)} tok`} />
              <StatCard icon={<Trophy />} label={i18next.t("store:Peak day")} value={data.peakTokenCount ?? 0} hint={data.peakDate || "—"} />
            </div>
            <Card>
              <CardContent className="p-4">
                <SeriesChart
                  height={300}
                  rows={data.buckets ?? []}
                  series={[
                    {key: "tokenCount", name: i18next.t("general:Tokens"), color: "hsl(var(--chart-1))"},
                    {key: "price", name: costName, color: "hsl(var(--chart-3))", right: true},
                  ]}
                />
              </CardContent>
            </Card>
          </>
        );
      }}
    </ReportBody>
  );
}

function FavoriteUsers({owner, storeName, refreshTick, onLoaded, favoriteType}: ReportProps & {favoriteType: "star" | "watch"}) {
  const state = useReport<any[]>(
    () => StoreBackend.getStoreFavoriteUsers(owner, storeName, favoriteType).then((res: any) => (res.status === "ok" ? {...res, data: res.data ?? []} : res)),
    [owner, storeName, favoriteType, refreshTick],
    onLoaded,
    () => new Date().toISOString(),
  );
  const isStar = favoriteType === "star";
  return (
    <ReportBody state={state}>
      {(users) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={isStar ? <Star /> : <Eye />} label={i18next.t(isStar ? "store:Stargazers" : "store:Watchers")} value={users.length} />
          </div>
          {users.length === 0 ? (
            <Card><CardContent className="p-4"><EmptyNote text={i18next.t("general:No data")} /></CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {users.map((user) => (
                <Card key={user.user}>
                  <CardContent className="space-y-2 p-4">
                    <UserLabel user={user.user} className="font-medium" />
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {user.createdTime ? new Date(user.createdTime).toLocaleString() : "—"}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </ReportBody>
  );
}

function Forks({owner, storeName, refreshTick, onLoaded}: ReportProps) {
  const state = useReport<any[]>(
    () => StoreBackend.getStoreForks(owner, storeName).then((res: any) => (res.status === "ok" ? {...res, data: res.data ?? []} : res)),
    [owner, storeName, refreshTick],
    onLoaded,
    () => new Date().toISOString(),
  );
  return (
    <ReportBody state={state}>
      {(forks) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={<GitFork />} label={i18next.t("store:Forks")} value={forks.length} />
          </div>
          {forks.length === 0 ? (
            <Card><CardContent className="p-4"><EmptyNote text={i18next.t("general:No data")} /></CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {forks.map((store) => (
                <Card key={`${store.owner}/${store.name}`}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <StoreAvatar store={store} className="h-8 w-8 shrink-0" />
                      <Link to={`/agents/${store.owner}/${store.name}`} className="truncate font-medium underline-offset-4 hover:underline" title={store.displayName || store.name}>
                        {store.displayName || store.name}
                      </Link>
                    </div>
                    {store.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{store.description}</p> : null}
                    <UserLabel user={store.owner} className="text-sm" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </ReportBody>
  );
}

interface StoreInsightsProps {
  account: any;
  owner: string;
  storeName: string;
  activeSub: InsightsSub;
  onSubTabChange: (sub: InsightsSub) => void;
}

/** The agent's insights: a menu of reports and the chosen one under a shared window and refresh. */
export function StoreInsights({account, owner, storeName, activeSub, onSubTabChange}: StoreInsightsProps) {
  const controls = usePeriodControls();
  const {setAsOf} = controls;

  // a newly chosen report shows no data time until it has loaded its own
  React.useEffect(() => {
    setAsOf(null);
  }, [activeSub, setAsOf]);

  const common: ReportProps = {account, owner, storeName, period: controls.period, refreshTick: controls.refreshTick, onLoaded: setAsOf};
  const reports: Record<InsightsSub, React.ReactNode> = {
    pulse: <Pulse {...common} />,
    contributors: <Contributors {...common} />,
    traffic: <Traffic {...common} />,
    wordcloud: <WordCloudReport {...common} />,
    cost: <Cost {...common} />,
    stargazers: <FavoriteUsers {...common} favoriteType="star" />,
    watchers: <FavoriteUsers {...common} favoriteType="watch" />,
    forks: <Forks {...common} />,
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      <nav className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1 md:mx-0 md:w-52 md:flex-col md:overflow-visible md:border-r md:px-0 md:pr-4">
        {subTabs().map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSubTabChange(tab.key)}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors [&_svg]:h-4 [&_svg]:w-4",
              activeSub === tab.key ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 space-y-4">
        {controls.bar}
        {/* keyed so a switched report starts from its own spinner, not the last one's data */}
        <React.Fragment key={activeSub}>{reports[activeSub]}</React.Fragment>
      </div>
    </div>
  );
}

export default StoreInsights;
