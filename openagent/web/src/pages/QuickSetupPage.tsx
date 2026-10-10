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
import dayjs from "dayjs";
import {CheckCircle2, ExternalLink, X} from "lucide-react";
import {Link, useNavigate} from "react-router-dom";
import * as PipeBackend from "@/backend/PipeBackend";
import * as ProviderBackend from "@/backend/ProviderBackend";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {PasswordInput} from "@/components/common/PasswordInput";
import {SearchableSelect} from "@/components/common/SearchableSelect";
import * as ProviderSetting from "@/lib/provider-setting";
import * as Setting from "@/lib/setting";
import {cn} from "@/lib/utils";

function SelectableCard({logo, label, desc, selected, onClick}: {logo?: string; label: string; desc?: string; selected: boolean; onClick: () => void}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "relative flex min-w-0 flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-colors hover:border-primary/50",
        selected ? "border-primary bg-primary/5" : "border-border bg-card",
      )}
    >
      {selected ? <CheckCircle2 className="absolute right-1.5 top-1.5 h-4 w-4 text-primary" /> : null}
      <div className="flex h-11 items-center justify-center">
        {logo ? <img src={logo} alt="" className="max-h-11 max-w-11 object-contain" /> : (
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-lg font-bold text-muted-foreground">{label[0]}</div>
        )}
      </div>
      <div className="text-[13px] font-semibold leading-tight">{label}</div>
      {desc ? <div className="text-[11px] leading-tight text-muted-foreground">{desc}</div> : null}
    </button>
  );
}

function Section({number, title, optional, children}: {number: number; title: string; optional?: boolean; children: React.ReactNode}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2.5 text-lg">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">{number}</span>
          {title}
          {optional ? <Badge variant="secondary" className="font-normal">{i18next.t("setup:Optional")}</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function Field({label, hint, children}: {label: string; hint?: React.ReactNode; children: React.ReactNode}) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{label}</div>
      {children}
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

const cardGrid = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

/** A first AI model, and optionally a chat platform, in one form, for someone new to the console. */
export default function QuickSetupPage() {
  const navigate = useNavigate();
  const [modelType, setModelType] = React.useState<string | null>(null);
  const [providerName, setProviderName] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [region, setRegion] = React.useState("us-east-1");
  const [subType, setSubType] = React.useState("");
  const [providerUrl, setProviderUrl] = React.useState("");
  const [pipeType, setPipeType] = React.useState<string | null>(null);
  const [pipeSkipped, setPipeSkipped] = React.useState(false);
  const [pipeName, setPipeName] = React.useState("");
  const [pipeToken, setPipeToken] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState<{provider: any; pipe: any} | null>(null);

  const meta = modelType ? ProviderSetting.getModelProviderMetadata(modelType) : null;
  const pipeMeta = pipeType ? ProviderSetting.getPipePlatformMetadata(pipeType) : null;
  const modelOptions = modelType && modelType !== "OpenAI Compatible" ? ProviderSetting.getProviderSubTypeOptions("Model", modelType) ?? [] : [];

  const selectModel = (type: string) => {
    if (type === modelType) {
      return;
    }
    const typeMeta = ProviderSetting.getModelProviderMetadata(type);
    setModelType(type);
    setProviderName(`provider_${Setting.getRandomName()}`);
    setApiKey("");
    setClientId("");
    setRegion("us-east-1");
    setSubType(typeMeta.defaultSubType || "");
    setProviderUrl(typeMeta.defaultUrl || "");
  };

  const selectPipe = (type: string) => {
    if (type === pipeType) {
      return;
    }
    setPipeType(type);
    setPipeSkipped(false);
    setPipeName(`pipe_${Setting.getRandomName()}`);
    setPipeToken("");
  };

  const reset = () => {
    setSaved(null);
    setModelType(null);
    setPipeType(null);
    setPipeSkipped(false);
  };

  const save = async() => {
    if (!modelType || !meta) {
      Setting.showMessage("error", i18next.t("setup:Please choose an AI model"));
      return;
    }
    const checks: [boolean, string][] = [
      [!providerName.trim(), "setup:Provider name is required"],
      [meta.needsApiKey && !apiKey.trim(), "setup:API Key is required"],
      [meta.needsUrl && !providerUrl.trim(), "setup:URL is required"],
      [!subType.trim(), "setup:Model name is required"],
      [Boolean(pipeType) && !pipeSkipped && !pipeToken.trim(), "setup:Token is required"],
    ];
    const failed = checks.find(([bad]) => bad);
    if (failed) {
      Setting.showMessage("error", i18next.t(failed[1]));
      return;
    }

    const provider = {
      owner: "admin",
      name: providerName.trim(),
      createdTime: dayjs().format(),
      displayName: `${modelType} (${subType})`,
      displayName2: "",
      category: "Model",
      type: modelType,
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
      // Bedrock's region rides in the network column, as the provider page stores it
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

    setSaving(true);
    try {
      const res: any = await ProviderBackend.addProvider(provider);
      if (res.status !== "ok") {
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
        return;
      }
      let pipe: any = null;
      if (pipeType && !pipeSkipped && pipeToken.trim()) {
        pipe = {
          owner: "admin",
          name: pipeName.trim(),
          createdTime: dayjs().format(),
          displayName: `${pipeType} Bot`,
          type: pipeType,
          token: pipeToken.trim(),
          secretKey: "",
          domain: "",
          isDefault: false,
          state: "Active",
        };
        const pipeRes: any = await PipeBackend.addPipe(pipe);
        if (pipeRes.status !== "ok") {
          Setting.showMessage("error", `${i18next.t("general:Failed to add")} pipe: ${pipeRes.msg}`);
          // the model is already saved; show it rather than lose track of it
          pipe = null;
        }
      }
      setSaved({provider, pipe});
      Setting.showMessage("success", i18next.t("setup:Configuration saved successfully"));
    } catch (error) {
      Setting.showMessage("error", String(error));
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 py-4">
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle className="text-base">{i18next.t("setup:Setup complete!")}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{i18next.t("setup:Your configuration has been saved. You can now start chatting or further customize your setup.")}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate("/chat")}>{i18next.t("general:Chat")}</Button>
              <Button variant="outline" asChild><Link to={`/providers/${saved.provider.name}`}>{i18next.t("setup:View AI Model")}</Link></Button>
              {saved.pipe ? <Button variant="outline" asChild><Link to={`/pipes/${saved.pipe.name}`}>{i18next.t("setup:View Pipe")}</Link></Button> : null}
              <Button variant="ghost" onClick={reset}>{i18next.t("setup:Setup another")}</Button>
            </div>
          </AlertDescription>
        </Alert>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{i18next.t("setup:Created Resources")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{i18next.t("setup:AI Model")}</Badge>
              <code className="rounded bg-muted px-1.5 py-0.5">{saved.provider.name}</code>
              <span className="text-muted-foreground">({saved.provider.type} / {saved.provider.subType})</span>
            </div>
            {saved.pipe ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{i18next.t("general:Pipes")}</Badge>
                <code className="rounded bg-muted px-1.5 py-0.5">{saved.pipe.name}</code>
                <span className="text-muted-foreground">({saved.pipe.type})</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{i18next.t("general:Quick Setup")}</h1>
        <p className="text-muted-foreground">{i18next.t("setup:Get your AI up and running in minutes — no technical knowledge required.")}</p>
      </div>

      <Section number={1} title={i18next.t("setup:Choose an AI Model")}>
        <div className={cardGrid}>
          {ProviderSetting.getQuickSetupModelTypes().map((type: string) => (
            <SelectableCard
              key={type}
              logo={ProviderSetting.getProviderLogoURL({category: "Model", type})}
              label={type}
              desc={ProviderSetting.getModelProviderMetadata(type).desc}
              selected={modelType === type}
              onClick={() => selectModel(type)}
            />
          ))}
        </div>

        {meta ? (
          <div className="space-y-4 border-t pt-5">
            <div className="font-semibold">{i18next.t("setup:Configure")} {modelType}</div>
            <Field label={i18next.t("general:Model")}>
              {modelOptions.length > 0 ? (
                <SearchableSelect value={subType} options={modelOptions.map((item: any) => ({value: item.id, label: item.name}))} onChange={setSubType} />
              ) : (
                <Input value={subType} placeholder={i18next.t("setup:Enter model name")} onChange={(e) => setSubType(e.target.value)} />
              )}
            </Field>
            {meta.needsClientId ? (
              <div className="md:w-1/2">
                <Field label={modelType === "Amazon Bedrock" ? "Access Key ID" : modelType === "Azure" ? i18next.t("provider:Deployment name") : "Client ID"}>
                  <Input value={clientId} placeholder={modelType === "Azure" ? i18next.t("setup:Enter deployment name") : "AKIA..."} onChange={(e) => setClientId(e.target.value)} />
                </Field>
              </div>
            ) : null}
            {meta.needsApiKey ? (
              <Field label={i18next.t("setup:API Key")} hint={i18next.t("setup:Your secret API key from the provider dashboard")}>
                <PasswordInput value={apiKey} placeholder="sk-..." autoComplete="off" onChange={(e) => setApiKey(e.target.value)} />
              </Field>
            ) : null}
            {meta.needsRegion ? (
              <div className="md:w-1/2">
                <Field label={i18next.t("general:Region")}>
                  <Input value={region} placeholder="us-east-1" onChange={(e) => setRegion(e.target.value)} />
                </Field>
              </div>
            ) : null}
            {meta.needsUrl ? (
              <Field
                label={modelType === "Ollama" ? i18next.t("setup:Ollama Server URL") : i18next.t("setup:API Endpoint URL")}
                hint={modelType === "Ollama" ? i18next.t("setup:Make sure Ollama is running locally before saving") : undefined}
              >
                <Input value={providerUrl} placeholder={meta.urlPlaceholder || "https://"} onChange={(e) => setProviderUrl(e.target.value)} />
              </Field>
            ) : null}
          </div>
        ) : null}
      </Section>

      <Section number={2} title={i18next.t("setup:Connect a Messaging Platform")} optional>
        <p className="text-sm text-muted-foreground">
          {i18next.t("setup:Connect a messaging app so users can chat with your AI through Telegram, Discord, or WhatsApp. You can skip this step and set it up later.")}
        </p>
        <div className={cardGrid}>
          {ProviderSetting.getPipeTypeOptions().map((item: any) => (
            <SelectableCard
              key={item.id}
              logo={ProviderSetting.getProviderLogoURL({category: "Chat", type: item.id})}
              label={item.name}
              desc={ProviderSetting.getPipePlatformMetadata(item.id)?.desc}
              selected={pipeType === item.id}
              onClick={() => selectPipe(item.id)}
            />
          ))}
          <button
            type="button"
            aria-pressed={pipeSkipped}
            onClick={() => {
              setPipeType(null);
              setPipeSkipped(true);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center transition-colors hover:border-primary/50",
              pipeSkipped ? "border-primary bg-primary/5" : "border-border bg-card",
            )}
          >
            <X className="h-8 w-8 text-muted-foreground/50" />
            <div className="text-[13px] font-semibold">{i18next.t("general:Skip")}</div>
            <div className="text-[11px] text-muted-foreground">{i18next.t("setup:Set up later")}</div>
          </button>
        </div>

        {pipeMeta && !pipeSkipped ? (
          <div className="space-y-4 border-t pt-5">
            <div className="font-semibold">{i18next.t("setup:Configure")} {pipeType}</div>
            <Field
              label={pipeMeta.tokenLabel}
              hint={
                <span>
                  {i18next.t("setup:How to get a token?")}{" "}
                  <a href={pipeMeta.helpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
                    {i18next.t("setup:View guide")}<ExternalLink className="h-3 w-3" />
                  </a>
                </span>
              }
            >
              <PasswordInput value={pipeToken} placeholder={pipeMeta.tokenPlaceholder} autoComplete="off" onChange={(e) => setPipeToken(e.target.value)} />
            </Field>
          </div>
        ) : null}
      </Section>

      <div className="flex justify-end">
        <Button size="lg" className="min-w-40" loading={saving} disabled={!modelType} onClick={save}>
          {saving ? i18next.t("setup:Saving...") : i18next.t("setup:Save Configuration")}
        </Button>
      </div>
    </div>
  );
}
