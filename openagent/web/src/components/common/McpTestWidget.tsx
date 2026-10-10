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
import * as ServerBackend from "@/backend/ServerBackend";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {CodeEditor} from "@/components/common/CodeEditor";
import {SearchableSelect} from "@/components/common/SearchableSelect";
import * as Setting from "@/lib/setting";

interface JsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
}

function parseSchema(inputSchema: string | undefined): JsonSchema {
  if (!inputSchema) {
    return {};
  }
  try {
    return JSON.parse(inputSchema);
  } catch {
    return {};
  }
}

/** turns the form values into the tool's arguments, typed the way its schema declares them */
function buildArguments(values: Record<string, any>, schema: JsonSchema) {
  const args: Record<string, any> = {};
  for (const [name, value] of Object.entries(values)) {
    if (value === "" || value === undefined || value === null) {
      continue;
    }
    const type = schema.properties?.[name]?.type;
    if (type === "object" || type === "array") {
      try {
        args[name] = JSON.parse(value);
      } catch {
        args[name] = value;
      }
    } else if (type === "number" || type === "integer") {
      args[name] = Number(value);
    } else {
      args[name] = value;
    }
  }
  return args;
}

function ArgumentInput({schema, value, onChange}: {schema: JsonSchema; value: any; onChange: (value: any) => void}) {
  const type = schema.type || "string";
  if (type === "boolean") {
    return <Switch checked={Boolean(value)} onCheckedChange={onChange} />;
  }
  if (type === "number" || type === "integer") {
    return <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
  if (type === "array" || type === "object") {
    return <Textarea rows={3} className="font-mono text-xs" placeholder="JSON..." value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
  return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

/** Calls one of an MCP server's synced tools with arguments filled in from its input schema. */
export function McpTestWidget({server}: {server: any}) {
  const [toolName, setToolName] = React.useState("");
  const [values, setValues] = React.useState<Record<string, any>>({});
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState("");

  const tools: any[] = server.tools ?? [];
  if (tools.length === 0) {
    return <p className="text-sm italic text-muted-foreground">{i18next.t("server:Sync tools first using the Sync button above")}</p>;
  }

  const tool = tools.find((t) => t.name === toolName);
  const schema = parseSchema(tool?.inputSchema);
  const properties = Object.entries(schema.properties ?? {});
  const required = schema.required ?? [];

  const invoke = async() => {
    const payload = Setting.deepCopy(server);
    payload.testContent = JSON.stringify({tool: toolName, arguments: buildArguments(values, schema)});
    setTesting(true);
    setResult("");
    try {
      const res = await ServerBackend.testMcpServer(payload);
      if (res.status === "ok") {
        setResult(typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2));
        Setting.showMessage("success", i18next.t("general:Success"));
      } else {
        Setting.showMessage("error", res.msg);
      }
    } catch (error: any) {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error?.message ?? error}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="text-sm font-medium">{i18next.t("general:Tool")}</div>
        <SearchableSelect
          value={toolName}
          placeholder={i18next.t("server:Select tool...")}
          allowUnknownValue={false}
          options={tools.map((t) => ({
            value: t.name,
            label: t.name,
            keywords: t.description,
            itemLabel: (
              <div className="min-w-0">
                <div className="font-medium">{t.name}</div>
                {t.description ? <div className="line-clamp-2 text-xs text-muted-foreground">{t.description}</div> : null}
              </div>
            ),
          }))}
          onChange={(value) => {
            setToolName(value);
            setValues({});
          }}
        />
      </div>

      {properties.length > 0 ? (
        <div className="space-y-3 rounded-md border bg-muted/40 p-4">
          <div className="text-sm font-medium">{i18next.t("general:Arguments")}</div>
          {properties.map(([name, propertySchema]) => (
            <div key={name} className="grid grid-cols-1 gap-2 md:grid-cols-[200px_1fr]">
              <div className="text-sm">
                <span className={required.includes(name) ? "font-semibold" : undefined}>
                  {required.includes(name) ? <span className="text-destructive">* </span> : null}
                  {name}
                </span>
                {propertySchema.description ? <div className="mt-0.5 text-xs text-muted-foreground">{propertySchema.description}</div> : null}
              </div>
              <ArgumentInput schema={propertySchema} value={values[name]} onChange={(value) => setValues((prev) => ({...prev, [name]: value}))} />
            </div>
          ))}
        </div>
      ) : toolName ? (
        <p className="text-xs italic text-muted-foreground">{i18next.t("server:This tool takes no arguments")}</p>
      ) : null}

      <Button onClick={invoke} disabled={!toolName || testing}>
        {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {i18next.t("provider:Invoke MCP tool")}
      </Button>

      {result ? (
        <div className="space-y-1.5">
          <div className="text-sm font-medium">{i18next.t("provider:MCP tool result")}</div>
          <CodeEditor value={result} height={180} readOnly />
        </div>
      ) : null}
    </div>
  );
}
