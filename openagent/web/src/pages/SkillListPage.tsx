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
import {Download, Store} from "lucide-react";
import {Link, useNavigate} from "react-router-dom";
import * as SkillBackend from "@/backend/SkillBackend";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {LoadSkillDialog} from "@/components/skill/LoadSkillDialog";
import {SkillMarketplaceDialog} from "@/components/skill/SkillMarketplaceDialog";
import {dateColumn, textColumn, valueFilters} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import * as Setting from "@/lib/setting";

export const SkillTypes = ["writing", "coding", "analysis", "translation", "reasoning", "search", "custom"];

function newSkill() {
  return {
    owner: "admin",
    name: `skill_${Setting.getRandomName()}`,
    createdTime: dayjs().format(),
    displayName: "",
    type: "custom",
    description: "",
    homepage: "",
    emoji: "",
    metadata: "",
    content: "",
    skillMd: "",
    references: [],
    state: "Active",
  };
}

export default function SkillListPage() {
  const navigate = useNavigate();
  const [loadOpen, setLoadOpen] = React.useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = React.useState(false);
  const openSkill = (name: string) => navigate(`/skills/${name}`);

  const columns: ColumnDef<any>[] = [
    {
      dataIndex: "name",
      title: i18next.t("general:Name"),
      width: 200,
      sortable: true,
      searchable: true,
      fixed: "left",
      render: (value, record) => (
        <span>
          {record.emoji ? <span className="mr-1.5">{record.emoji}</span> : null}
          <Link to={`/skills/${value}`} className="font-medium underline-offset-4 hover:underline">{value}</Link>
        </span>
      ),
    },
    textColumn({dataIndex: "displayName", title: i18next.t("general:Display name"), searchable: true, width: 160}),
    {
      dataIndex: "type",
      title: i18next.t("general:Type"),
      width: 120,
      sortable: true,
      filters: valueFilters(SkillTypes),
      render: (value) => (value ? <Badge variant="secondary">{value}</Badge> : null),
    },
    {
      dataIndex: "description",
      title: i18next.t("general:Description"),
      width: 220,
      searchable: true,
      render: (value) => (value ? Setting.getShortText(value, 20) : null),
    },
    {
      dataIndex: "references",
      title: i18next.t("skill:References"),
      width: 180,
      render: (refs: any[]) => (
        <div className="flex flex-col gap-1">
          {(refs ?? []).map((ref) => (
            <Badge key={ref.name} variant="outline" className="w-fit font-mono">{ref.name}</Badge>
          ))}
        </div>
      ),
    },
    {
      dataIndex: "state",
      title: i18next.t("general:State"),
      width: 100,
      sortable: true,
      render: (value) => <Badge variant={value === "Active" ? "success" : "secondary"}>{value}</Badge>,
    },
    // not a column of the antd list, so it starts in the column menu
    {...dateColumn(), defaultHidden: true},
  ];

  return (
    <>
      <CrudListPage
        title={i18next.t("general:Skills")}
        columns={columns}
        fetch={(q) => SkillBackend.getSkills("admin", q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
        newRecord={newSkill}
        editUrl={(r) => `/skills/${r.name}`}
        remove={(r) => SkillBackend.deleteSkill(r)}
        toolbar={
          <>
            <Button variant="outline" onClick={() => setLoadOpen(true)}><Download />{i18next.t("skill:Load Existing Skill")}</Button>
            <Button variant="outline" onClick={() => setMarketplaceOpen(true)}><Store />{i18next.t("skill:Marketplace")}</Button>
          </>
        }
      />
      <LoadSkillDialog open={loadOpen} onOpenChange={setLoadOpen} onImported={openSkill} />
      <SkillMarketplaceDialog open={marketplaceOpen} onOpenChange={setMarketplaceOpen} onInstalled={openSkill} />
    </>
  );
}
