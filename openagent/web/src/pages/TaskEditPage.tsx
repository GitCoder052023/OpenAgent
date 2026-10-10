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
import {BarChart3, Download, Eraser, FileText, Upload, X} from "lucide-react";
import {useNavigate, useParams} from "react-router-dom";
import * as MessageBackend from "@/backend/MessageBackend";
import * as ProviderBackend from "@/backend/ProviderBackend";
import * as ScaleBackend from "@/backend/ScaleBackend";
import * as TaskBackend from "@/backend/TaskBackend";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Progress} from "@/components/ui/progress";
import {Textarea} from "@/components/ui/textarea";
import {CodeEditor} from "@/components/common/CodeEditor";
import {Loading} from "@/components/common/Loading";
import {SearchableSelect} from "@/components/common/SearchableSelect";
import {TagsInput} from "@/components/common/TagsInput";
import {UnauthorizedPage} from "@/components/common/UnauthorizedPage";
import {EditPageShell} from "@/components/crud/EditPageShell";
import {FormRow, FormSection} from "@/components/crud/FormRow";
import {TaskAnalysisReport} from "@/components/task/TaskAnalysisReport";
import {useAccount} from "@/hooks/use-account";
import {useEditRecord} from "@/hooks/use-edit-record";
import {submitEdit} from "@/lib/crud";
import * as ProviderSetting from "@/lib/provider-setting";
import * as Setting from "@/lib/setting";
import {parseTaskReport} from "@/lib/task-report";

/**
 * Analysis takes minutes and reports no progress, so the bar runs on a five
 * minute clock and holds at 99% until the answer arrives.
 */
const AnalyzeDurationMs = 300 * 1000;
const AnalyzeTickMs = 500;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

function getDocumentFileName(url: string) {
  try {
    const encoded = new URL(url).pathname.split("/").filter(Boolean).pop() || url;
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  } catch {
    return url;
  }
}

export default function TaskEditPage() {
  const {owner = "", taskName = ""} = useParams();
  const navigate = useNavigate();
  const {account} = useAccount();
  const isAdmin = Setting.isAdminUser(account);
  const [modelProviders, setModelProviders] = React.useState<any[]>([]);
  const [publicScales, setPublicScales] = React.useState<any[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzeProgress, setAnalyzeProgress] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const progressTimer = React.useRef<ReturnType<typeof setInterval>>(undefined);

  const {record: task, updateField, updateFields, loading, denied} = useEditRecord<any>({
    fetch: () => TaskBackend.getTask(owner, taskName),
    // the report is stored as a JSON string and edited here as an object
    transform: (record) => ({...record, scale: record.scale ?? "", result: parseTaskReport(record.result)}),
    deps: [owner, taskName],
  });

  React.useEffect(() => {
    ScaleBackend.getPublicScales().then((res: any) => {
      if (res.status === "ok" && res.data) {
        setPublicScales(res.data);
      }
    });
    return () => clearInterval(progressTimer.current);
  }, []);

  React.useEffect(() => {
    if (!account) {
      return;
    }
    ProviderBackend.getProviders(account.name).then((res: any) => {
      if (res.status === "ok") {
        setModelProviders((res.data ?? []).filter((provider: any) => provider.category === "Model"));
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    });
  }, [account]);

  if (denied) {
    return <UnauthorizedPage />;
  }
  if (loading || task === null) {
    return <Loading />;
  }

  const scaleText = publicScales.find((item) => `${item.owner}/${item.name}` === task.scale)?.text ?? "";

  const save = async(exitAfterSave: boolean) => {
    const payload = Setting.deepCopy(task);
    if (payload.result && typeof payload.result === "object") {
      payload.result = JSON.stringify(payload.result);
    }
    setSaving(true);
    const ok = await submitEdit({
      mode: "edit",
      record: payload,
      add: TaskBackend.addTask,
      update: (record) => TaskBackend.updateTask(record.owner, taskName, record),
      onSaved: (saved) => {
        if (exitAfterSave) {
          navigate("/tasks");
        } else if (saved.name !== taskName) {
          navigate(`/tasks/${saved.owner}/${saved.name}`, {replace: true});
        }
      },
    });
    setSaving(false);
    return ok;
  };

  const uploadDocument = async(file: File | undefined) => {
    if (!file) {
      return;
    }
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const res: any = await TaskBackend.uploadTaskDocument(`${task.owner}/${task.name}`, base64, file.name, file.type);
      if (res.status === "ok") {
        updateFields({documentUrl: res.data.url, documentText: res.data.text});
        Setting.showMessage("success", i18next.t("general:Successfully uploaded"));
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to upload")}: ${res.msg}`);
      }
    } catch (error: any) {
      Setting.showMessage("error", `${i18next.t("general:Failed to upload")}: ${error?.message ?? error}`);
    } finally {
      setUploading(false);
    }
  };

  const analyze = async() => {
    if (!String(task.scale || "").trim()) {
      return;
    }
    const startedAt = Date.now();
    setAnalyzing(true);
    setAnalyzeProgress(0);
    progressTimer.current = setInterval(() => {
      setAnalyzeProgress(Math.round(Math.min(99, 99 * (Date.now() - startedAt) / AnalyzeDurationMs)));
    }, AnalyzeTickMs);
    try {
      const res: any = await TaskBackend.analyzeTask(task.owner, task.name);
      if (res.status === "ok") {
        updateFields({result: res.data, score: res.data.score});
        Setting.showMessage("success", i18next.t("general:Successfully saved"));
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    } catch (error: any) {
      Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${error?.message ?? error}`);
    } finally {
      clearInterval(progressTimer.current);
      setAnalyzeProgress(100);
      setTimeout(() => {
        setAnalyzing(false);
        setAnalyzeProgress(0);
      }, 400);
    }
  };

  // labeling mode: fill the scale's {example} and {labels} and ask the model directly
  const run = () => {
    const question = scaleText
      .replace("{example}", task.example ?? "")
      .replace("{labels}", (task.labels ?? []).map((label: string) => `"${label}"`).join(", "));
    updateField("log", "");
    setRunning(true);
    MessageBackend.getAnswer(task.provider, question, task.name, "").then((res: any) => {
      if (res.status === "ok") {
        updateField("log", res.data);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    }).finally(() => setRunning(false));
  };

  const documentField = task.documentUrl ? (
    <div className="inline-flex max-w-full items-center gap-3 rounded-md border px-3 py-2">
      <FileText className={task.documentUrl.endsWith(".pdf") ? "h-7 w-7 shrink-0 text-red-600 dark:text-red-400" : "h-7 w-7 shrink-0 text-blue-600 dark:text-blue-400"} />
      <span className="min-w-0 truncate text-sm" title={getDocumentFileName(task.documentUrl)}>{getDocumentFileName(task.documentUrl)}</span>
      <Button variant="link" size="sm" asChild className="shrink-0">
        <a href={task.documentUrl} target="_blank" rel="noopener noreferrer"><Download />{i18next.t("general:Download")}</a>
      </Button>
      <Button
        variant="ghost"
        size="iconSm"
        className="shrink-0 text-destructive"
        aria-label={i18next.t("general:Delete")}
        onClick={() => updateFields({documentUrl: "", documentText: ""})}
      >
        <X />
      </Button>
    </div>
  ) : (
    <>
      <Button loading={uploading} onClick={() => fileRef.current?.click()}>
        <Upload />
        {i18next.t("store:Upload file")} (.docx, .pdf)
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".docx,.pdf"
        className="hidden"
        onChange={(e) => {
          uploadDocument(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );

  return (
    <EditPageShell
      title={`${i18next.t("task:Edit Task")} - ${task.displayName || task.name}`}
      mode="edit"
      backTo="/tasks"
      onSave={save}
      remove={() => TaskBackend.deleteTask(task)}
      saving={saving}
    >
      <div className="space-y-6">
        <FormSection title={i18next.t("general:General Settings")} description={i18next.t("general:General Settings desc")}>
          <FormRow labelKey="general:Name" block={!isAdmin}>
            <Input value={task.name ?? ""} onChange={(e) => updateField("name", e.target.value)} />
          </FormRow>
          {isAdmin ? (
            <>
              <FormRow labelKey="provider:Model provider">
                <SearchableSelect
                  value={task.provider ?? ""}
                  onChange={(value) => updateField("provider", value)}
                  options={modelProviders.map((provider) => ({
                    value: provider.name,
                    keywords: `${ProviderSetting.getProviderDisplayName(provider)} ${provider.name}`,
                    label: (
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <img src={ProviderSetting.getProviderLogoURL(provider)} alt="" className="h-5 w-5 shrink-0 object-contain" />
                        <span className="truncate">{ProviderSetting.getProviderDisplayName(provider)} ({provider.name})</span>
                      </span>
                    ),
                  }))}
                />
              </FormRow>
              <FormRow labelKey="general:Type">
                <SearchableSelect value={task.type ?? ""} onChange={(value) => updateField("type", value)} options={["Labeling", "PBL"].map((value) => ({value, label: value}))} />
              </FormRow>
            </>
          ) : null}
          {task.type === "Labeling" || isAdmin ? (
            <FormRow labelKey="general:Display name">
              <Input value={task.displayName ?? ""} onChange={(e) => updateField("displayName", e.target.value)} />
            </FormRow>
          ) : null}
        </FormSection>

        <FormSection title={i18next.t("general:Options")}>
          <FormRow labelKey="task:Scale" block>
            <SearchableSelect
              value={task.scale ?? ""}
              onChange={(value) => updateField("scale", value || "")}
              options={[
                {value: "", label: i18next.t("general:None")},
                ...publicScales.map((scale) => {
                  const id = `${scale.owner}/${scale.name}`;
                  return {value: id, label: scale.displayName ? `${scale.displayName} (${id})` : id};
                }),
              ]}
            />
          </FormRow>
          {scaleText ? (
            <FormRow label={i18next.t("general:Text")} tooltip={i18next.t("task:Scale - Tooltip")} block>
              <Textarea rows={5} readOnly value={scaleText} className="max-h-[120px]" />
            </FormRow>
          ) : null}
          <FormRow labelKey="store:File" block>
            <div>{documentField}</div>
          </FormRow>

          {task.type === "Labeling" ? (
            <>
              <FormRow labelKey="task:Example">
                <Input value={task.example ?? ""} onChange={(e) => updateField("example", e.target.value)} />
              </FormRow>
              <FormRow labelKey="task:Labels">
                <TagsInput value={task.labels ?? []} onChange={(value) => updateField("labels", value)} />
              </FormRow>
              <FormRow labelKey="task:Log" block>
                <div className="space-y-3">
                  <Button loading={running} onClick={run}>{i18next.t("general:Run")}</Button>
                  <CodeEditor language="javascript" height={200} value={task.log ?? ""} onChange={(value) => updateField("log", value)} />
                </div>
              </FormRow>
            </>
          ) : task.documentUrl ? (
            <FormRow labelKey="task:Report" block>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="w-[200px]"
                    loading={analyzing}
                    disabled={!task.documentText || !!task.result || !String(task.scale || "").trim()}
                    onClick={analyze}
                  >
                    <BarChart3 />
                    {i18next.t("task:Analyze")}
                  </Button>
                  {task.result ? (
                    <Button variant="outline" className="w-[200px]" onClick={() => updateFields({result: null, score: 0})}>
                      <Eraser />
                      {i18next.t("general:Clear")}
                    </Button>
                  ) : null}
                </div>
                {analyzing ? (
                  <div className="flex max-w-md items-center gap-3">
                    <Progress value={analyzeProgress} className="flex-1" />
                    <span className="w-10 text-right text-sm tabular-nums">{analyzeProgress}%</span>
                    <span className="text-sm text-muted-foreground">{i18next.t("task:Analyzing")}</span>
                  </div>
                ) : null}
                {task.result ? <TaskAnalysisReport result={task.result} downloadFileName={`${task.owner}_${task.name}_report.docx`} /> : null}
              </div>
            </FormRow>
          ) : null}
        </FormSection>
      </div>
    </EditPageShell>
  );
}
