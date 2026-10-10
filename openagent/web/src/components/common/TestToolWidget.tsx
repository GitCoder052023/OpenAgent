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
import {Loader2, Play} from "lucide-react";
import * as ProviderBackend from "@/backend/ProviderBackend";
import * as ToolBackend from "@/backend/ToolBackend";
import {Button} from "@/components/ui/button";
import {CodeEditor} from "@/components/common/CodeEditor";
import {ProviderTypeLabel} from "@/components/common/ProviderLogo";
import {SearchableSelect} from "@/components/common/SearchableSelect";
import {TagsInput} from "@/components/common/TagsInput";
import {FormRow} from "@/components/crud/FormRow";
import * as Setting from "@/lib/setting";
import {getToolFunctions} from "@/lib/tool-functions";

function tryFormatJson(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function isValidToolTestJson(content: string) {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed.tool === "string" && parsed.tool.trim() !== "";
  } catch {
    return false;
  }
}

function buildDefaultToolTestJson(tool: any) {
  const fns = getToolFunctions(tool);
  return fns.length > 0 ? fns[0].testContent : JSON.stringify({tool: "", arguments: {}}, null, 2);
}

/** Calls one function of the tool with a JSON request, and keeps the last result on the tool. */
export function TestToolWidget({tool, onUpdateTool}: {tool: any; onUpdateTool: (field: string, value: any) => void}) {
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState<string>(tool.resultSummary ?? "");
  const [modelProviders, setModelProviders] = React.useState<any[]>([]);
  const [selectedFunction, setSelectedFunction] = React.useState("");
  const synced = React.useRef<{type: string | null; subType: string | null} | null>(null);

  React.useEffect(() => {
    ProviderBackend.getProviders("admin").then((res: any) => {
      if (res.status === "ok") {
        setModelProviders((res.data ?? []).filter((p: any) => p.category === "Model"));
      }
    }).catch(() => undefined);
  }, []);

  // a new type (or a new office sub type) gets the example request of its first function
  React.useEffect(() => {
    const previous = synced.current;
    synced.current = {type: tool.type ?? null, subType: tool.subType ?? null};
    if (previous === null) {
      if (!tool.testContent || !isValidToolTestJson(tool.testContent)) {
        onUpdateTool("testContent", buildDefaultToolTestJson(tool));
      } else {
        const formatted = tryFormatJson(tool.testContent);
        if (formatted !== tool.testContent) {
          onUpdateTool("testContent", formatted);
        }
      }
      return;
    }
    if (previous.type !== tool.type || (tool.type === "office" && previous.subType !== tool.subType)) {
      setResult("");
      setSelectedFunction("");
      onUpdateTool("testContent", buildDefaultToolTestJson(tool));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.type, tool.subType]);

  const invoke = async() => {
    let parsed: any;
    try {
      parsed = JSON.parse(tool.testContent);
    } catch (e: any) {
      Setting.showMessage("error", `${i18next.t("provider:Invalid tool test JSON")}: ${e.message}`);
      return;
    }
    if (!parsed || typeof parsed.tool !== "string" || parsed.tool.trim() === "") {
      Setting.showMessage("error", i18next.t("provider:Tool test JSON must include tool"));
      return;
    }

    setTesting(true);
    setResult("");
    try {
      const res = await ToolBackend.testTool(tool);
      if (res.status === "ok") {
        const out = typeof res.data === "string" ? tryFormatJson(res.data) : JSON.stringify(res.data, null, 2);
        setResult(out);
        Setting.showMessage("success", i18next.t("general:Success"));
        onUpdateTool("resultSummary", out);
        await ToolBackend.updateTool(tool.owner, tool.name, {...tool, resultSummary: out});
      } else {
        Setting.showMessage("error", res.msg || i18next.t("general:Failed to save"));
      }
    } catch (error: any) {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  // GUI and video tools expose several functions; pick which one the example request calls
  const functionChoices = tool.type === "gui" || tool.type === "video_download" ? getToolFunctions({type: tool.type}) : [];

  return (
    <div className="space-y-4">
      {functionChoices.length > 0 && (
        <FormRow labelKey="provider:Tool function" block>
          <SearchableSelect
            value={selectedFunction || functionChoices[0].name}
            onChange={(value) => {
              setSelectedFunction(value);
              const fn = functionChoices.find((f) => f.name === value);
              if (fn) {
                onUpdateTool("testContent", fn.testContent);
              }
            }}
            options={functionChoices.map((f) => ({value: f.name, label: `${f.name} — ${f.description}`}))}
          />
        </FormRow>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <FormRow labelKey="provider:Tool test" block>
          <div className="space-y-2">
            <CodeEditor language="json" height={180} value={tool.testContent ?? ""} onChange={(value) => onUpdateTool("testContent", value)} />
            <Button onClick={invoke} disabled={testing || !tool.testContent || tool.testContent.trim() === ""}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {i18next.t("provider:Invoke tool")}
            </Button>
          </div>
        </FormRow>
        <FormRow labelKey="provider:Tool result" block>
          <CodeEditor language="json" height={180} value={result} readOnly />
        </FormRow>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <FormRow labelKey="provider:Model provider" block>
          <SearchableSelect
            value={tool.modelProvider ?? ""}
            placeholder={i18next.t("provider:Select model provider")}
            onChange={(value) => onUpdateTool("modelProvider", value)}
            options={modelProviders.map((mp) => ({
              value: mp.name,
              label: <ProviderTypeLabel category={mp.category} type={mp.type} text={mp.displayName || mp.name} />,
              keywords: `${mp.name} ${mp.displayName ?? ""}`,
            }))}
          />
        </FormRow>
        <FormRow labelKey="tool:Prompt examples" block>
          <TagsInput value={tool.promptExamples ?? []} onChange={(value) => onUpdateTool("promptExamples", value)} />
        </FormRow>
      </div>
    </div>
  );
}
