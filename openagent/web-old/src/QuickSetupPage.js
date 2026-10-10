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

import React, {useState} from "react";
import {useHistory} from "react-router-dom";
import {Button, Typography} from "antd";
import * as ProviderBackend from "./backend/ProviderBackend";
import * as PipeBackend from "./backend/PipeBackend";
import * as Setting from "./Setting";
import i18next from "i18next";
import moment from "moment";
import ModelSection from "./quick-setup/ModelSection";
import PipeSection from "./quick-setup/PipeSection";
import SuccessView from "./quick-setup/SuccessView";

const {Title, Text} = Typography;

function QuickSetupPage() {
  const history = useHistory();

  const [selectedModelType, setSelectedModelType] = useState(null);
  const [providerName, setProviderName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [clientId, setClientId] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [subType, setSubType] = useState("");
  const [providerUrl, setProviderUrl] = useState("");

  const [selectedPipeType, setSelectedPipeType] = useState(null);
  const [pipeSkipped, setPipeSkipped] = useState(false);
  const [pipeName, setPipeName] = useState("");
  const [pipeToken, setPipeToken] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedProvider, setSavedProvider] = useState(null);
  const [savedPipe, setSavedPipe] = useState(null);

  function handleSelectModel(type) {
    if (selectedModelType === type) {return;}
    const meta = Setting.getModelProviderMetadata(type);
    const rand = Setting.getRandomName();
    setSelectedModelType(type);
    setProviderName(`provider_${rand}`);
    setApiKey("");
    setClientId("");
    setRegion("us-east-1");
    setSubType(meta.defaultSubType || "");
    setProviderUrl(meta.defaultUrl || "");
  }

  function handleSelectPipe(type) {
    if (selectedPipeType === type) {return;}
    const rand = Setting.getRandomName();
    setSelectedPipeType(type);
    setPipeSkipped(false);
    setPipeName(`pipe_${rand}`);
    setPipeToken("");
  }

  function handleSkipPipe() {
    setSelectedPipeType(null);
    setPipeSkipped(true);
  }

  async function handleSave() {
    if (!selectedModelType) {
      Setting.showMessage("error", i18next.t("setup:Please choose an AI model"));
      return;
    }
    if (!providerName.trim()) {
      Setting.showMessage("error", i18next.t("setup:Provider name is required"));
      return;
    }
    const meta = Setting.getModelProviderMetadata(selectedModelType);
    if (meta.needsApiKey && !apiKey.trim()) {
      Setting.showMessage("error", i18next.t("setup:API Key is required"));
      return;
    }
    if (meta.needsUrl && !providerUrl.trim()) {
      Setting.showMessage("error", i18next.t("setup:URL is required"));
      return;
    }
    if (!subType.trim()) {
      Setting.showMessage("error", i18next.t("setup:Model name is required"));
      return;
    }
    if (selectedPipeType && !pipeSkipped && !pipeToken.trim()) {
      Setting.showMessage("error", i18next.t("setup:Token is required"));
      return;
    }

    setSaving(true);

    const provider = {
      owner: "admin",
      name: providerName.trim(),
      createdTime: moment().format(),
      displayName: `${selectedModelType} (${subType})`,
      displayName2: "",
      category: "Model",
      type: selectedModelType,
      subType: subType.trim(),
      clientId: meta.needsClientId ? clientId.trim() : "",
      clientSecret: apiKey.trim(),
      mcpTools: [],
      enableThinking: false,
      temperature: 1,
      topP: 1,
      topK: 4,
      frequencyPenalty: 0,
      presencePenalty: 0,
      inputPricePerThousandTokens: 0,
      outputPricePerThousandTokens: 0,
      currency: "USD",
      providerUrl: meta.needsUrl ? providerUrl.trim() : "",
      apiVersion: "",
      apiKey: "",
      network: meta.needsRegion ? region.trim() : "",
      userKey: "",
      userCert: "",
      signKey: "",
      signCert: "",
      compatibleProvider: "",
      contractName: "",
      contractMethod: "",
      state: "Active",
      isRemote: false,
    };

    try {
      const res = await ProviderBackend.addProvider(provider);
      if (res.status !== "ok") {
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
        setSaving(false);
        return;
      }
      setSavedProvider(provider);

      if (selectedPipeType && !pipeSkipped && pipeToken.trim()) {
        const pipe = {
          owner: "admin",
          name: pipeName.trim(),
          createdTime: moment().format(),
          displayName: `${selectedPipeType} Bot`,
          type: selectedPipeType,
          token: pipeToken.trim(),
          secretKey: "",
          domain: "",
          isDefault: false,
          state: "Active",
        };
        const pipeRes = await PipeBackend.addPipe(pipe);
        if (pipeRes.status !== "ok") {
          Setting.showMessage("error", `${i18next.t("general:Failed to add")} pipe: ${pipeRes.msg}`);
          setSaving(false);
          return;
        }
        setSavedPipe(pipe);
      }

      Setting.showMessage("success", i18next.t("setup:Configuration saved successfully"));
    } catch (err) {
      Setting.showMessage("error", String(err));
    } finally {
      setSaving(false);
    }
  }

  if (savedProvider) {
    return (
      <SuccessView
        savedProvider={savedProvider}
        savedPipe={savedPipe}
        onGoToChat={() => history.push("/chat")}
        onViewProvider={() => history.push(`/providers/${savedProvider.name}`)}
        onViewPipe={() => savedPipe && history.push(`/pipes/${savedPipe.name}`)}
        onReset={() => {
          setSavedProvider(null);
          setSavedPipe(null);
          setSelectedModelType(null);
          setSelectedPipeType(null);
          setPipeSkipped(false);
        }}
      />
    );
  }

  return (
    <div style={{maxWidth: 800, margin: "0 auto", padding: "32px 16px"}}>
      <div style={{marginBottom: 32}}>
        <Title level={3} style={{marginBottom: 4}}>{i18next.t("general:Quick Setup")}</Title>
        <Text type="secondary" style={{fontSize: 15}}>{i18next.t("setup:Get your AI up and running in minutes — no technical knowledge required.")}</Text>
      </div>

      <ModelSection
        selectedModelType={selectedModelType}
        onSelectModel={handleSelectModel}
        apiKey={apiKey} setApiKey={setApiKey}
        clientId={clientId} setClientId={setClientId}
        region={region} setRegion={setRegion}
        subType={subType} setSubType={setSubType}
        providerUrl={providerUrl} setProviderUrl={setProviderUrl}
      />

      <PipeSection
        selectedPipeType={selectedPipeType}
        pipeSkipped={pipeSkipped}
        onSelectPipe={handleSelectPipe}
        onSkipPipe={handleSkipPipe}
        pipeToken={pipeToken} setPipeToken={setPipeToken}
      />

      <div style={{display: "flex", justifyContent: "flex-end", gap: 12}}>
        <Button
          type="primary"
          size="large"
          loading={saving}
          disabled={!selectedModelType}
          onClick={handleSave}
          style={{minWidth: 160, borderRadius: 10, height: 44, fontWeight: 600}}
        >
          {saving ? i18next.t("setup:Saving...") : i18next.t("setup:Save Configuration")}
        </Button>
      </div>
    </div>
  );
}

export default QuickSetupPage;
