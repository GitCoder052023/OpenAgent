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
import i18next from "i18next";
import {Info, TriangleAlert} from "lucide-react";
import {useParams} from "react-router-dom";
import * as ToolPolicyBackend from "@/backend/ToolPolicyBackend";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import {Input} from "@/components/ui/input";
import {SimpleEditPage, type EditField} from "@/components/crud/SimpleEditPage";

function patternField(name: string, labelKey: string, placeholder: string): EditField {
  return {
    type: "custom",
    name,
    labelKey,
    render: (ctx, update) => (
      <Input
        className="font-mono"
        placeholder={placeholder}
        disabled={ctx.mode === "view"}
        value={ctx.record[name] ?? ""}
        onChange={(e) => update(name, e.target.value)}
      />
    ),
  };
}

export default function ToolPolicyEditPage() {
  const {toolPolicyName = ""} = useParams();

  const fields: EditField[] = [
    {
      // the backend stores these rules but does not apply them to tool calls yet
      type: "custom",
      name: "notEnforced",
      label: "",
      block: true,
      render: () => (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>{i18next.t("toolPolicy:Not enforced yet")}</AlertTitle>
          <AlertDescription>{i18next.t("toolPolicy:Not enforced yet desc")}</AlertDescription>
        </Alert>
      ),
    },
    {
      // how the patterns below are matched and which rule wins
      type: "custom",
      name: "matchingHelp",
      label: "",
      block: true,
      render: () => (
        <Alert>
          <Info />
          <AlertTitle>{i18next.t("toolPolicy:Matching help title")}</AlertTitle>
          <AlertDescription>{i18next.t("toolPolicy:Matching help desc")}</AlertDescription>
        </Alert>
      ),
    },
    {type: "text", name: "name", labelKey: "general:Name", required: true},
    {type: "text", name: "displayName", labelKey: "general:Display name"},
    patternField("store", "general:Store", "*"),
    patternField("subject", "store:Subject", "*"),
    patternField("tool", "general:Tool", "* / shell / office_*"),
    {
      type: "select",
      name: "category",
      labelKey: "general:Category",
      options: () => ["*", "read", "write", "exec", "network", "sensitive", "unknown"].map((value) => ({value, label: value})),
    },
    patternField("resource", "toolPolicy:Resource", "* / *rm -rf* / https://*.example.com/*"),
    {
      type: "select",
      name: "effect",
      labelKey: "toolPolicy:Effect",
      options: () => ["allow", "ask", "deny"].map((value) => ({value, label: i18next.t(`toolPolicy:${value}`)})),
    },
    {type: "number", name: "priority", labelKey: "toolPolicy:Priority"},
    {
      type: "select",
      name: "state",
      labelKey: "general:State",
      options: () => [
        {value: "Active", label: i18next.t("general:Active")},
        {value: "Disabled", label: i18next.t("general:Disabled")},
      ],
    },
  ];

  return (
    <SimpleEditPage
      titleKey="toolPolicy:Edit Tool Permission"
      backTo="/tool-policies"
      deps={[toolPolicyName]}
      fields={fields}
      fetch={() => ToolPolicyBackend.getToolPolicy("admin", toolPolicyName)}
      add={(record) => ToolPolicyBackend.addToolPolicy(record)}
      update={(record) => ToolPolicyBackend.updateToolPolicy("admin", toolPolicyName, record)}
      editUrl={(record) => `/tool-policies/${record.name}`}
    />
  );
}
