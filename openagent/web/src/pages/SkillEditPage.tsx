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
import {X} from "lucide-react";
import {useParams} from "react-router-dom";
import * as SkillBackend from "@/backend/SkillBackend";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {SimpleEditPage, type EditField} from "@/components/crud/SimpleEditPage";
import {SkillTypes} from "@/pages/SkillListPage";

export default function SkillEditPage() {
  const {skillName = ""} = useParams();

  const fields: EditField[] = [
    {type: "text", name: "name", labelKey: "general:Name", required: true},
    {type: "text", name: "displayName", labelKey: "general:Display name"},
    {type: "text", name: "emoji", labelKey: "general:Emoji"},
    {
      type: "select",
      name: "type",
      labelKey: "general:Type",
      options: () => SkillTypes.map((value) => ({value, label: value})),
    },
    {
      type: "select",
      name: "state",
      labelKey: "general:State",
      options: () => [
        {value: "Active", label: i18next.t("general:Active")},
        {value: "Inactive", label: i18next.t("general:Inactive")},
      ],
    },
    {type: "textarea", name: "description", labelKey: "general:Description", rows: 3},
    {type: "url", name: "homepage", labelKey: "skill:Homepage"},
    {type: "code", name: "content", labelKey: "general:Content", language: "markdown", height: 420},
    {
      type: "custom",
      name: "references",
      labelKey: "skill:References",
      when: (ctx) => (ctx.record.references ?? []).length > 0,
      render: (ctx, update) => (
        <div className="flex flex-wrap gap-2">
          {(ctx.record.references ?? []).map((ref: any, index: number) => (
            <Badge key={ref.name} variant="outline" className="gap-1 font-mono">
              {ref.name}
              {ctx.mode !== "view" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  onClick={() => update("references", ctx.record.references.filter((_: any, i: number) => i !== index))}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      type: "code",
      name: "skillMd",
      labelKey: "skill:SKILL.md",
      language: "markdown",
      height: 320,
      when: (ctx) => !!ctx.record.skillMd,
      disabled: () => true,
    },
  ];

  return (
    <SimpleEditPage
      titleKey="skill:Edit Skill"
      backTo="/skills"
      deps={[skillName]}
      fields={fields}
      fetch={() => SkillBackend.getSkill("admin", skillName)}
      add={(record) => SkillBackend.addSkill(record)}
      update={(record) => SkillBackend.updateSkill("admin", skillName, record)}
      editUrl={(record) => `/skills/${record.name}`}
    />
  );
}
