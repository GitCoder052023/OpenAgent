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
import {ArrowLeft} from "lucide-react";
import {useNavigate, useParams} from "react-router-dom";
import * as AnalysisBackend from "@/backend/AnalysisBackend";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {WordCloud} from "@/components/charts/WordCloud";
import {Loading} from "@/components/common/Loading";
import {PageHeader} from "@/components/crud/PageHeader";
import * as Setting from "@/lib/setting";

/** The word cloud of one store's messages. */
export default function AnalysisEditPage() {
  const {storeName = ""} = useParams();
  const navigate = useNavigate();
  const [wordCountMap, setWordCountMap] = React.useState<Record<string, number> | null>(null);

  React.useEffect(() => {
    setWordCountMap(null);
    AnalysisBackend.getStoreWordCloud(storeName, "").then((res: any) => {
      if (res.status === "ok") {
        setWordCountMap(res.data ?? {});
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        setWordCountMap({});
      }
    }).catch((error: any) => {
      Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${error}`);
      setWordCountMap({});
    });
  }, [storeName]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Button variant="ghost" size="iconSm" aria-label={i18next.t("general:Go back")} onClick={() => navigate("/analysis")}>
              <ArrowLeft />
            </Button>
            {i18next.t("store:Word Cloud")} — {storeName}
          </span>
        }
      />
      {wordCountMap === null ? (
        <Loading />
      ) : Object.keys(wordCountMap).length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{i18next.t("store:No message data available")}</p>
      ) : (
        <Card>
          <CardContent className="p-6">
            <WordCloud wordCountMap={wordCountMap} maxWords={200} sizeRange={[13, 64]} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
