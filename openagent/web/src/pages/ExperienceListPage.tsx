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
import {Link} from "react-router-dom";
import * as ExperienceBackend from "@/backend/ExperienceBackend";
import {Badge} from "@/components/ui/badge";
import {SearchableSelect} from "@/components/common/SearchableSelect";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {boolColumn, dateColumn, linkColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import * as Setting from "@/lib/setting";

export const ExperienceStates = ["Draft", "Active", "Archived"];
export const ExperienceCategories = ["Fact", "Style", "Format", "Scope"];

function newExperience() {
  return {
    owner: "admin",
    name: `experience_${Setting.getRandomName()}`,
    createdTime: dayjs().format(),
    store: "",
    question: "",
    originalText: "",
    correctedText: "",
    reason: "",
    category: "Style",
    rule: "",
    isGlobalRule: true,
    state: "Draft",
  };
}

/** Reviewing is the whole point of the Draft state, so approving is one click in the list. */
function StateSelect({record}: {record: any}) {
  const [state, setState] = React.useState(record.state);

  const change = (value: string) => {
    const updated = {...record, state: value};
    ExperienceBackend.updateExperience(record.owner, record.name, updated).then((res: any) => {
      if (res.status === "ok") {
        record.state = value;
        setState(value);
        Setting.showMessage("success", i18next.t("general:Successfully saved"));
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
      }
    }).catch((error: any) => Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${error}`));
  };

  return (
    <SearchableSelect
      className="h-8"
      value={state}
      onChange={change}
      options={ExperienceStates.map((item) => ({value: item, label: i18next.t(`experience:State - ${item}`)}))}
    />
  );
}

function TwoLines({text}: {text: string}) {
  return <div className="line-clamp-2 max-w-[360px]" title={text}>{text}</div>;
}

export default function ExperienceListPage() {
  const columns: ColumnDef<any>[] = [
    linkColumn({dataIndex: "name", to: (r) => `/experiences/${r.name}`, width: 180}),
    {
      dataIndex: "store",
      title: i18next.t("general:Store"),
      width: 140,
      sortable: true,
      searchable: true,
      render: (value) => (value ? <Link to={`/stores/admin/${value}`} className="underline-offset-4 hover:underline">{value}</Link> : null),
    },
    {dataIndex: "question", title: i18next.t("experience:Question"), searchable: true, render: (value) => <TwoLines text={value} />},
    {dataIndex: "correctedText", title: i18next.t("experience:Corrected answer"), searchable: true, render: (value) => <TwoLines text={value} />},
    {
      dataIndex: "category",
      title: i18next.t("general:Category"),
      width: 110,
      filters: ExperienceCategories.map((item) => ({value: item, label: i18next.t(`experience:Category - ${item}`)})),
      render: (value) => (value ? <Badge variant="secondary">{i18next.t(`experience:Category - ${value}`)}</Badge> : null),
    },
    boolColumn({dataIndex: "isGlobalRule", title: i18next.t("experience:Standing rule")}),
    {dataIndex: "hitCount", title: i18next.t("experience:Hit count"), width: 100, sortable: true},
    {
      dataIndex: "state",
      title: i18next.t("general:State"),
      width: 140,
      filters: ExperienceStates.map((item) => ({value: item, label: i18next.t(`experience:State - ${item}`)})),
      render: (_value, record) => <StateSelect record={record} />,
    },
    dateColumn(),
  ];

  return (
    <CrudListPage
      title={i18next.t("general:Experiences")}
      columns={columns}
      fetch={(q) => ExperienceBackend.getExperiences("admin", q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
      newRecord={newExperience}
      editUrl={(r) => `/experiences/${r.name}`}
      remove={(r) => ExperienceBackend.deleteExperience(r)}
    />
  );
}
