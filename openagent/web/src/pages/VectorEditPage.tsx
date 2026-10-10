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
import {useParams, useSearchParams} from "react-router-dom";
import * as VectorBackend from "@/backend/VectorBackend";
import {Textarea} from "@/components/ui/textarea";
import {CodeEditor} from "@/components/common/CodeEditor";
import {SimpleEditPage, type EditField} from "@/components/crud/SimpleEditPage";

/** The embedding is edited as comma-separated numbers, as in the antd page. */
function DataField({value, disabled, onChange}: {value: number[]; disabled: boolean; onChange: (value: number[]) => void}) {
  const [text, setText] = React.useState(() => (value ?? []).join(","));
  return (
    <Textarea
      rows={6}
      className="font-mono text-xs"
      disabled={disabled}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.split(",").map(Number));
      }}
    />
  );
}

export default function VectorEditPage() {
  const {vectorName = ""} = useParams();
  const [searchParams] = useSearchParams();
  // the chat's knowledge sources open a vector with ?mode=view
  const viewOnly = searchParams.get("mode") === "view";

  const fields: EditField[] = [
    {type: "text", name: "name", labelKey: "general:Name", required: true},
    {type: "text", name: "displayName", labelKey: "general:Display name"},
    {type: "text", name: "store", labelKey: "general:Store"},
    {type: "text", name: "provider", labelKey: "general:Provider"},
    {type: "text", name: "file", labelKey: "store:File"},
    {type: "number", name: "size", labelKey: "general:Size", disabled: () => true},
    {type: "number", name: "dimension", labelKey: "vector:Dimension", disabled: () => true},
    {
      type: "custom",
      name: "text",
      labelKey: "general:Text",
      block: true,
      render: (ctx, update) => (
        <CodeEditor language="markdown" height={320} value={ctx.record.text ?? ""} readOnly={ctx.mode === "view"} onChange={(value) => update("text", value)} />
      ),
    },
    {
      type: "custom",
      name: "data",
      labelKey: "general:Data",
      block: true,
      render: (ctx, update) => <DataField value={ctx.record.data} disabled={ctx.mode === "view"} onChange={(value) => update("data", value)} />,
    },
  ];

  return (
    <SimpleEditPage
      titleKey="vector:Edit Vector"
      backTo="/vectors"
      deps={[vectorName]}
      fields={fields}
      readOnly={() => viewOnly}
      fetch={() => VectorBackend.getVector("admin", vectorName)}
      add={(record) => VectorBackend.addVector(record)}
      remove={(record) => VectorBackend.deleteVector(record)}
      update={(record) => VectorBackend.updateVector(record.owner, vectorName, record)}
      editUrl={(record) => `/vectors/${record.name}`}
    />
  );
}
