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
import {useParams} from "react-router-dom";
import * as ExperienceBackend from "@/backend/ExperienceBackend";
import {SimpleEditPage, type EditField} from "@/components/crud/SimpleEditPage";
import {useStoreOptions} from "@/hooks/use-stores";
import {diffText} from "@/lib/diff-text";
import * as Setting from "@/lib/setting";
import {ExperienceCategories, ExperienceStates} from "@/pages/ExperienceListPage";

/**
 * The point of the library is the delta between what the model said and what a human
 * wanted, so the page shows that delta right under the two answers.
 */
function AnswerDiff({experience}: {experience: any}) {
  if (!experience.originalText && !experience.correctedText) {
    return null;
  }
  const {parts, truncated} = diffText(experience.originalText || "", experience.correctedText || "");
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {truncated
          ? i18next.t("experience:The answers differ too much to align, showing both versions")
          : i18next.t("experience:Struck-through text was removed, highlighted text was added")}
      </div>
      <div className="whitespace-pre-wrap break-words rounded-md border p-3 text-sm leading-7">
        {parts.map((part: any, index: number) => {
          if (part.type === "equal") {
            return <span key={index}>{part.text}</span>;
          }
          return part.type === "remove"
            ? <span key={index} className="rounded-sm bg-destructive/15 px-px text-destructive line-through">{part.text}</span>
            : <span key={index} className="rounded-sm bg-success/15 px-px text-success">{part.text}</span>;
        })}
      </div>
    </div>
  );
}

export default function ExperienceEditPage() {
  const {experienceName = ""} = useParams();
  const storeOptions = useStoreOptions();
  const readOnly = () => true;

  const fields: EditField[] = [
    {type: "textarea", name: "question", labelKey: "experience:Question", rows: 2, block: true},
    {type: "textarea", name: "originalText", labelKey: "experience:Original AI answer", rows: 6},
    {type: "textarea", name: "correctedText", labelKey: "experience:Corrected answer", rows: 6},
    {type: "textarea", name: "reason", labelKey: "experience:Why was it wrong?", rows: 2, block: true},
    {type: "custom", name: "diff", label: "", block: true, render: (ctx) => <AnswerDiff experience={ctx.record} />},
    {
      type: "select",
      name: "category",
      labelKey: "general:Category",
      options: () => ExperienceCategories.map((item) => ({value: item, label: i18next.t(`experience:Category - ${item}`)})),
    },
    {
      type: "select",
      name: "state",
      labelKey: "general:State",
      options: () => ExperienceStates.map((item) => ({value: item, label: i18next.t(`experience:State - ${item}`)})),
    },
    {type: "number", name: "hitCount", labelKey: "experience:Hit count", disabled: readOnly},
    {type: "switch", name: "isGlobalRule", labelKey: "experience:Standing rule"},
    {type: "textarea", name: "rule", labelKey: "experience:Rule", rows: 3, when: (ctx) => !!ctx.record.isGlobalRule},
    {type: "text", name: "name", labelKey: "general:Name", disabled: (ctx) => ctx.mode !== "add"},
    {type: "select", name: "store", labelKey: "general:Store", options: () => storeOptions},
    {type: "text", name: "user", labelKey: "general:User", disabled: readOnly},
    {type: "text", name: "chat", labelKey: "general:Chat", disabled: readOnly},
    {type: "text", name: "message", labelKey: "general:Message", disabled: readOnly},
    {
      type: "custom",
      name: "createdTime",
      labelKey: "general:Created time",
      render: (ctx) => <span className="text-sm text-muted-foreground">{Setting.getFormattedDate(ctx.record.createdTime)}</span>,
    },
  ];

  return (
    <SimpleEditPage
      titleKey="experience:Edit Experience"
      backTo="/experiences"
      deps={[experienceName]}
      fields={fields}
      fetch={() => ExperienceBackend.getExperience("admin", experienceName)}
      add={(record) => ExperienceBackend.addExperience(record)}
      update={(record) => ExperienceBackend.updateExperience("admin", experienceName, record)}
      editUrl={(record) => `/experiences/${record.name}`}
    />
  );
}
