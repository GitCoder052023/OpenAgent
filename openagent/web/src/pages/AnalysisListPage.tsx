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
import {Link} from "react-router-dom";
import * as AnalysisBackend from "@/backend/AnalysisBackend";
import * as StoreBackend from "@/backend/StoreBackend";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {WordCloud} from "@/components/charts/WordCloud";
import {Loading} from "@/components/common/Loading";
import {UserLabel} from "@/components/common/UserLabel";
import {PageHeader} from "@/components/crud/PageHeader";
import {useRequestStore} from "@/hooks/use-request-store";
import * as Setting from "@/lib/setting";

interface StoreWordCloud {
  store: any;
  wordCountMap: Record<string, number>;
}

function NoData() {
  return <p className="py-10 text-center text-sm text-muted-foreground">{i18next.t("store:No message data available")}</p>;
}

/** A word cloud per store that has messages, to compare what each one is asked about. */
export default function AnalysisListPage() {
  const requestStore = useRequestStore();
  const [clouds, setClouds] = React.useState<StoreWordCloud[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setClouds(null);
    StoreBackend.getGlobalStores(requestStore, 1, 10000).then(async(res: any) => {
      if (res.status !== "ok") {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        setClouds([]);
        return;
      }
      const stores = (res.data ?? []).filter((store: any) => store.messageCount > 0);
      const results = await Promise.all(stores.map((store: any) =>
        AnalysisBackend.getStoreWordCloud(store.name, "")
          .then((r: any) => ({store, wordCountMap: r.status === "ok" ? r.data ?? {} : {}}))
          .catch(() => ({store, wordCountMap: {}})),
      ));
      if (!cancelled) {
        setClouds(results);
      }
    }).catch((error: any) => {
      Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${error}`);
      setClouds([]);
    });
    return () => {
      cancelled = true;
    };
  }, [requestStore]);

  return (
    <div className="space-y-4">
      <PageHeader title={i18next.t("store:Analysis")} />
      {clouds === null ? (
        <Loading />
      ) : clouds.length === 0 ? (
        <NoData />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {clouds.map(({store, wordCountMap}) => (
            <Card key={`${store.owner}/${store.name}`} className="flex flex-col">
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-2">
                <div className="flex min-w-0 items-center gap-2">
                  <img src={Setting.getStoreIconUrl(store)} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                  <CardTitle className="truncate text-base">{store.displayName || store.name}</CardTitle>
                  <span className="shrink-0 text-xs text-muted-foreground"><UserLabel user={store.owner} /></span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/stores/${store.owner}/${store.name}`}>{i18next.t("general:Edit")}</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/analysis/${store.owner}/${store.name}`}>{i18next.t("general:View")}</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 items-center justify-center">
                {Object.keys(wordCountMap).length > 0
                  ? <WordCloud wordCountMap={wordCountMap} maxWords={60} sizeRange={[11, 32]} className="max-h-80 overflow-hidden" />
                  : <NoData />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
