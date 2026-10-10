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

import React, {useCallback, useEffect, useRef, useState} from "react";
import {Card, Steps, Tabs, Typography} from "antd";
import i18next from "i18next";
import * as MigrationBackend from "./MigrationBackend";
import * as Setting from "../Setting";
import SourceStep from "./SourceStep";
import PreviewStep from "./PreviewStep";
import ProgressStep from "./ProgressStep";
import MigrationHistory from "./MigrationHistory";

const {Title, Text} = Typography;

// How often the running migration is polled. A run writes one entity per tick
// of work, so a sub-second interval keeps the bar moving without flooding.
const progressPollInterval = 800;

const defaultOptions = {
  conflictPolicy: "rename",
  includeSkills: true,
  includeProviders: true,
  includeMcpServers: true,
  includeAgents: true,
  includeChats: true,
};

// MigrationPage walks an admin through importing another agent installation:
// scan the source, look at exactly what would be written, then run it with a
// live progress view. Nothing is written before the last step.
function MigrationPage() {
  const [tab, setTab] = useState("migrate");
  const [step, setStep] = useState(0);

  const [sources, setSources] = useState([]);
  const [sourceId, setSourceId] = useState("");
  const [inputMode, setInputMode] = useState("path");
  const [path, setPath] = useState("");
  const [file, setFile] = useState(null);

  const [bundleId, setBundleId] = useState("");
  const [plan, setPlan] = useState(null);
  const [options, setOptions] = useState(defaultOptions);
  const [selectedKeys, setSelectedKeys] = useState([]);

  const [scanning, setScanning] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);

  const pollTimer = useRef(null);

  useEffect(() => {
    MigrationBackend.getMigrationSources().then(res => {
      if (res.status === "ok") {
        setSources(res.data || []);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
      }
    };
  }, []);

  // applyPlan keeps the row selection in sync with a freshly built plan: every
  // row the plan can actually write starts ticked.
  const applyPlan = useCallback(newPlan => {
    setPlan(newPlan);
    setSelectedKeys((newPlan.items || []).filter(item => item.action !== "skip").map(item => item.key));
  }, []);

  function scan() {
    setScanning(true);
    MigrationBackend.uploadMigrationFile(sourceId, inputMode === "file" ? file : null, inputMode === "path" ? path : "")
      .then(res => {
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
  }

  // Changing what to import or how to resolve conflicts changes the target
  // names too, so the plan is rebuilt server-side rather than filtered locally.
  function changeOptions(newOptions) {
    setOptions(newOptions);
    setReplanning(true);
    MigrationBackend.previewMigration(bundleId, newOptions)
      .then(res => {
        if (res.status === "ok") {
          applyPlan(res.data.plan);
        } else {
          Setting.showMessage("error", `${i18next.t("migration:Failed to build the preview")}: ${res.msg}`);
        }
      })
      .finally(() => setReplanning(false));
  }

  const pollProgress = useCallback(id => {
    MigrationBackend.getMigrationProgress(id).then(res => {
      if (res.status !== "ok") {
        Setting.showMessage("error", `${i18next.t("migration:Lost track of the migration")}: ${res.msg}`);
        return;
      }
      setProgress(res.data);
      if (res.data.status === "Running") {
        pollTimer.current = setTimeout(() => pollProgress(id), progressPollInterval);
      } else {
        setHistoryKey(key => key + 1);
      }
    });
  }, []);

  function start() {
    const allSelectable = (plan.items || []).filter(item => item.action !== "skip").map(item => item.key);
    // An empty selectedKeys list means "everything" on the server, so it is
    // only sent when the user has actually narrowed the selection down.
    const isNarrowed = selectedKeys.length > 0 && selectedKeys.length < allSelectable.length;

    setStarting(true);
    MigrationBackend.startMigration(bundleId, {...options, selectedKeys: isNarrowed ? selectedKeys : []})
      .then(res => {
        if (res.status !== "ok") {
          Setting.showMessage("error", `${i18next.t("migration:Failed to start the migration")}: ${res.msg}`);
          return;
        }
        setProgress(res.data);
        setStep(2);
        pollProgress(res.data.id);
      })
      .finally(() => setStarting(false));
  }

  function restart() {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
    }
    setStep(0);
    setBundleId("");
    setPlan(null);
    setProgress(null);
    setFile(null);
    setOptions(defaultOptions);
    setSelectedKeys([]);
  }

  function renderStep() {
    if (step === 0) {
      return (
        <SourceStep
          sources={sources}
          sourceId={sourceId} setSourceId={setSourceId}
          inputMode={inputMode} setInputMode={setInputMode}
          path={path} setPath={setPath}
          file={file} setFile={setFile}
          scanning={scanning}
          onScan={scan}
        />
      );
    }
    if (step === 1 && plan) {
      return (
        <PreviewStep
          plan={plan}
          options={options} setOptions={changeOptions}
          selectedKeys={selectedKeys} setSelectedKeys={setSelectedKeys}
          replanning={replanning}
          starting={starting}
          onBack={() => setStep(0)}
          onStart={start}
        />
      );
    }
    if (step === 2 && progress) {
      return (
        <ProgressStep
          progress={progress}
          onRestart={restart}
          onViewHistory={() => setTab("history")}
        />
      );
    }
    return null;
  }

  return (
    <div style={{maxWidth: 1200, margin: "0 auto", padding: "24px 16px"}}>
      <div style={{marginBottom: 24}}>
        <Title level={3} style={{marginBottom: 4}}>{i18next.t("general:Migration")}</Title>
        <Text type="secondary">{i18next.t("migration:Bring an existing agent installation -- its skills, models, MCP servers and chat history -- into OpenAgent.")}</Text>
      </div>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: "migrate",
            label: i18next.t("migration:Migrate"),
            children: (
              <Card>
                <Steps
                  current={step}
                  style={{marginBottom: 24}}
                  items={[
                    {title: i18next.t("migration:Source")},
                    {title: i18next.t("general:Preview")},
                    {title: i18next.t("migration:Import")},
                  ]}
                />
                {renderStep()}
              </Card>
            ),
          },
          {
            key: "history",
            label: i18next.t("migration:History"),
            children: <MigrationHistory refreshKey={historyKey} />,
          },
        ]}
      />
    </div>
  );
}

export default MigrationPage;
