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

import i18next from "i18next";
import {RotateCcw} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Switch} from "@/components/ui/switch";
import {SearchableSelect} from "@/components/common/SearchableSelect";
import {EditableTable, type EditableColumn} from "@/components/crud/EditableTable";
import {getFormTypeItems, type FormItem} from "@/lib/form-types";

interface FormItemTableProps {
  title?: React.ReactNode;
  items: FormItem[] | undefined;
  onChange: (items: FormItem[]) => void;
  /** "Table" defines free columns; "List Page" picks among a list page's own columns */
  category: string;
  /** the list page a "List Page" Form customizes */
  formType?: string;
}

/** The columns of a Form: what each is called, how wide it is, and whether it shows. */
export function FormItemTable({title, items, onChange, category, formType}: FormItemTableProps) {
  const rows = items ?? [];

  if (category !== "List Page") {
    const columns: EditableColumn<FormItem>[] = [
      {key: "no", title: i18next.t("general:No."), width: 60, render: (_row, index) => <span className="tabular-nums text-muted-foreground">{index + 1}</span>},
      {key: "name", title: i18next.t("general:Name"), render: (row, _index, update) => <Input value={row.name ?? ""} onChange={(e) => update({name: e.target.value})} />},
      {key: "label", title: i18next.t("general:Label"), render: (row, _index, update) => <Input value={row.label ?? ""} onChange={(e) => update({label: e.target.value})} />},
      {key: "type", title: i18next.t("general:Type"), render: (row, _index, update) => <Input value={row.type ?? ""} onChange={(e) => update({type: e.target.value})} />},
      {key: "width", title: i18next.t("form:Width"), width: 120, render: (row, _index, update) => <Input value={row.width ?? ""} onChange={(e) => update({width: e.target.value})} />},
    ];
    return (
      <EditableTable
        title={title}
        rows={rows}
        onChange={onChange}
        columns={columns}
        newRow={() => ({name: `column${rows.length}`, label: `Column ${rows.length}`, type: "Text", visible: true, width: "100"})}
      />
    );
  }

  const defaults = getFormTypeItems(formType ?? "");
  const defaultLabel = (name: string) => defaults.find((item) => item.name === name)?.label;

  const columns: EditableColumn<FormItem>[] = [
    {
      key: "name",
      title: i18next.t("general:Name"),
      width: 220,
      render: (row, _index, update) => (
        <SearchableSelect
          value={row.name}
          // a column can be listed once; the row's own column stays pickable
          options={defaults
            .filter((item) => item.name === row.name || !rows.some((other) => other.name === item.name))
            .map((item) => ({value: item.name, label: i18next.t(item.label)}))}
          onChange={(name) => update({name, label: defaultLabel(name) ?? name})}
        />
      ),
    },
    {
      key: "label",
      title: i18next.t("general:Label"),
      width: 220,
      render: (row, _index, update) => <Input value={i18next.t(row.label ?? "")} onChange={(e) => update({label: e.target.value})} />,
    },
    {
      key: "visible",
      title: i18next.t("general:Visible"),
      width: 100,
      render: (row, _index, update) => <Switch checked={row.visible !== false} onCheckedChange={(visible) => update({visible})} />,
    },
    {key: "width", title: i18next.t("form:Width"), width: 120, render: (row, _index, update) => <Input value={row.width ?? ""} onChange={(e) => update({width: e.target.value})} />},
  ];

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => onChange(getFormTypeItems(formType ?? ""))}>
          <RotateCcw />
          {i18next.t("general:Reset to Default")}
        </Button>
      </div>
      <EditableTable
        title={title}
        rows={rows}
        onChange={onChange}
        columns={columns}
        newRow={() => ({name: `column${rows.length}`, label: `Column ${rows.length}`, type: "Text", visible: true, width: "100"})}
      />
    </div>
  );
}
