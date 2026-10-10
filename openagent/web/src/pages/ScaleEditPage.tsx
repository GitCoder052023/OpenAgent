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
import {useParams} from "react-router-dom";
import * as ScaleBackend from "@/backend/ScaleBackend";
import {SimpleEditPage, type EditField} from "@/components/crud/SimpleEditPage";
import {useAccount} from "@/hooks/use-account";
import * as Setting from "@/lib/setting";

export default function ScaleEditPage() {
  const {owner = "", scaleName = ""} = useParams();
  const {account} = useAccount();

  const fields: EditField[] = [
    {type: "text", name: "name", labelKey: "general:Name", required: true},
    {type: "text", name: "displayName", labelKey: "general:Display name"},
    {
      type: "select",
      name: "state",
      labelKey: "general:State",
      // only an admin decides whether a scale is offered to everyone
      when: () => Setting.isAdminUser(account),
      options: () => [
        {value: "Public", label: i18next.t("video:Public")},
        {value: "Hidden", label: i18next.t("video:Hidden")},
      ],
    },
    {type: "textarea", name: "text", label: i18next.t("general:Text"), rows: 12, block: true},
  ];

  return (
    <SimpleEditPage
      titleKey="task:Edit Scale"
      backTo="/scales"
      deps={[owner, scaleName]}
      fields={fields}
      transform={(record) => ({...record, state: record.state || "Public"})}
      fetch={() => ScaleBackend.getScale(owner, scaleName)}
      add={(record) => ScaleBackend.addScale(record)}
      remove={(record) => ScaleBackend.deleteScale(record)}
      update={(record) => ScaleBackend.updateScale(owner, scaleName, record)}
      editUrl={(record) => `/scales/${record.owner}/${record.name}`}
    />
  );
}
