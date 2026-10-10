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
import * as MigrationBackend from "@/backend/MigrationBackend";
import {Card, CardContent} from "@/components/ui/card";
import {Steps} from "@/components/ui/steps";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {PageHeader} from "@/components/crud/PageHeader";
import {MigrationHistory} from "@/components/migration/MigrationHistory";
import {PreviewStep, type MigrationOptions} from "@/components/migration/PreviewStep";
import {ProgressStep} from "@/components/migration/ProgressStep";
import {SourceStep} from "@/components/migration/SourceStep";
import * as Setting from "@/lib/setting";

/** A run writes one entity per tick of work, so a sub-second poll keeps the bar moving without flooding. */
const ProgressPollInterval = 800;

const defaultOptions: MigrationOptions = {
  conflictPolicy: "rename",
  includeSkills: true,
  includeProviders: true,
  includeMcpServers: true,
  includeAgents: true,
  includeChats: true,
};

/**
 * Imports another agent installation: scan the source, look at exactly what would
 * be written, then run it with live progress. Nothing is written before the last step.
 */
export default function MigrationPage() {
  const [tab, setTab] = React.useState("migrate");
  const [step, setStep] = React.useState(0);

  const [sources, setSources] = React.useState<any[]>([]);
  const [sourceId, setSourceId] = React.useState("");
  const [inputMode, setInputMode] = React.useState("path");
  const [path, setPath] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  const [bundleId, setBundleId] = React.useState("");
  const [plan, setPlan] = React.useState<any>(null);
  const [options, setOptions] = React.useState<MigrationOptions>(defaultOptions);
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);

  const [scanning, setScanning] = React.useState(false);
  const [replanning, setReplanning] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [progress, setProgress] = React.useState<any>(null);
  const [historyKey, setHistoryKey] = React.useState(0);

  const pollTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    MigrationBackend.getMigrationSources().then((res: any) => {
      if (res.status === "ok") {
        setSources(res.data ?? []);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    });
    return () => clearTimeout(pollTimer.current);
  }, []);

  // every row the fresh plan can actually write starts ticked
  const applyPlan = (newPlan: any) => {
    setPlan(newPlan);
    setSelectedKeys((newPlan.items ?? []).filter((item: any) => item.action !== "skip").map((item: any) => item.key));
  };

  const scan = () => {
    setScanning(true);
    MigrationBackend.uploadMigrationFile(sourceId, inputMode === "file" ? file : null, inputMode === "path" ? path : "")
      .then((res: any) => {
        if (res.status !== "ok") {
          Setting.showMessage("error", `${i18next.t("migration:Failed to read the source")}: ${res.msg}`);
          return;
        }
        setBundleId(res.data.bundleId);
        applyPlan(res.data.plan);
        setOptions(defaultOptions);
        setStep(1);
      })
      .finally(() => setScanning(false));
  };

  // what to import and how conflicts resolve change the target names too, so the
  // plan is rebuilt by the server rather than filtered here
  const changeOptions = (newOptions: MigrationOptions) => {
    setOptions(newOptions);
    setReplanning(true);
    MigrationBackend.previewMigration(bundleId, newOptions)
      .then((res: any) => {
        if (res.status === "ok") {
          applyPlan(res.data.plan);
        } else {
          Setting.showMessage("error", `${i18next.t("migration:Failed to build the preview")}: ${res.msg}`);
        }
      })
      .finally(() => setReplanning(false));
  };

  const pollProgress = (id: string) => {
    MigrationBackend.getMigrationProgress(id).then((res: any) => {
      if (res.status !== "ok") {
        Setting.showMessage("error", `${i18next.t("migration:Lost track of the migration")}: ${res.msg}`);
        return;
      }
      setProgress(res.data);
      if (res.data.status === "Running") {
        pollTimer.current = setTimeout(() => pollProgress(id), ProgressPollInterval);
      } else {
        setHistoryKey((key) => key + 1);
      }
    });
  };

  const start = () => {
    const allSelectable = (plan.items ?? []).filter((item: any) => item.action !== "skip").map((item: any) => item.key);
    // an empty list means "everything" to the server, so it is only sent once the selection is narrowed
    const isNarrowed = selectedKeys.length > 0 && selectedKeys.length < allSelectable.length;

    setStarting(true);
    MigrationBackend.startMigration(bundleId, {...options, selectedKeys: isNarrowed ? selectedKeys : []})
      .then((res: any) => {
        if (res.status !== "ok") {
          Setting.showMessage("error", `${i18next.t("migration:Failed to start the migration")}: ${res.msg}`);
          return;
        }
        setProgress(res.data);
        setStep(2);
        pollProgress(res.data.id);
      })
      .finally(() => setStarting(false));
  };

  const restart = () => {
    clearTimeout(pollTimer.current);
    setStep(0);
    setBundleId("");
    setPlan(null);
    setProgress(null);
    setFile(null);
    setOptions(defaultOptions);
    setSelectedKeys([]);
  };

  let content: React.ReactNode = null;
  if (step === 0) {
    content = (
      <SourceStep
        sources={sources}
        sourceId={sourceId}
        setSourceId={setSourceId}
        inputMode={inputMode}
        setInputMode={setInputMode}
        path={path}
        setPath={setPath}
        file={file}
        setFile={setFile}
        scanning={scanning}
        onScan={scan}
      />
    );
  } else if (step === 1 && plan) {
    content = (
      <PreviewStep
        plan={plan}
        options={options}
        setOptions={changeOptions}
        selectedKeys={selectedKeys}
        setSelectedKeys={setSelectedKeys}
        replanning={replanning}
        starting={starting}
        onBack={() => setStep(0)}
        onStart={start}
      />
    );
  } else if (step === 2 && progress) {
    content = <ProgressStep progress={progress} onRestart={restart} onViewHistory={() => setTab("history")} />;
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <PageHeader
        title={i18next.t("general:Migration")}
        description={i18next.t("migration:Bring an existing agent installation -- its skills, models, MCP servers and chat history -- into OpenAgent.")}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="migrate">{i18next.t("migration:Migrate")}</TabsTrigger>
          <TabsTrigger value="history">{i18next.t("migration:History")}</TabsTrigger>
        </TabsList>
        <TabsContent value="migrate">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <Steps
                current={step}
                items={[
                  {title: i18next.t("migration:Source")},
                  {title: i18next.t("general:Preview")},
                  {title: i18next.t("migration:Import")},
                ]}
              />
              {content}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <MigrationHistory refreshKey={historyKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
