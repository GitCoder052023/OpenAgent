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

import React from "react";
import {Tag} from "antd";
import i18next from "i18next";

// The five categories a bundle can carry, in the order they are applied.
export const migrationCategories = ["skill", "provider", "server", "agent", "chat"];

// Each category maps onto one OpenAgent entity, and each entity has its own
// admin page -- so an imported row can link straight to the thing it created.
const categoryMeta = {
  skill: {label: "general:Skills", color: "purple", path: name => `/skills/${name}`},
  provider: {label: "general:Providers", color: "geekblue", path: name => `/providers/${name}`},
  server: {label: "general:MCP Servers", color: "cyan", path: name => `/servers/${name}`},
  agent: {label: "general:Agents", color: "green", path: name => `/stores/admin/${name}`},
  chat: {label: "general:Chats", color: "orange", path: name => `/chats/${name}`},
};

export function getCategoryLabel(category) {
  const meta = categoryMeta[category];
  return meta ? i18next.t(meta.label) : category;
}

export function getCategoryPath(category, name) {
  const meta = categoryMeta[category];
  return meta ? meta.path(name) : null;
}

export function renderCategoryTag(category) {
  const meta = categoryMeta[category];
  return <Tag color={meta ? meta.color : "default"}>{getCategoryLabel(category)}</Tag>;
}

export function renderActionTag(action) {
  if (action === "create") {
    return <Tag color="success">{i18next.t("migration:Create")}</Tag>;
  }
  if (action === "overwrite") {
    return <Tag color="warning">{i18next.t("migration:Overwrite")}</Tag>;
  }
  return <Tag>{i18next.t("general:Skip")}</Tag>;
}

// countApplicable counts what a run would actually write: rows the plan is not
// already skipping, minus the ones the user has unticked in the table.
export function countApplicable(items, selectedKeys) {
  if (!items) {
    return 0;
  }
  return items.filter(item => item.action !== "skip" && selectedKeys.includes(item.key)).length;
}
