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
import {CheckOutlined, EyeInvisibleOutlined, SettingOutlined} from "@ant-design/icons";
import i18next from "i18next";

export const storagePrefix = "openagent_virtual_figure";

export function getStoreStorageId(store) {
  if (!store) {
    return "default";
  }
  return `${store.owner || "default"}/${store.name || "default"}`;
}

export function getStorageKey(store, suffix) {
  return `${storagePrefix}:${getStoreStorageId(store)}:${suffix}`;
}

export function loadJson(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (_) {
    return defaultValue;
  }
}

export const getDefaultCollapsed = mode => mode === "Collapsed";

const statusLabelMap = {
  idle: {key: "figure:Idle", label: "Idle"},
  typing: {key: "figure:Typing", label: "Typing"},
  thinking: {key: "figure:Thinking", label: "Thinking"},
  replying: {key: "figure:Replying", label: "Replying"},
  error: {key: "figure:Error", label: "Error"},
  done: {key: "figure:Done", label: "Done"},
};

export function getStatusText(status) {
  const item = statusLabelMap[status] || statusLabelMap.idle;
  return i18next.t(item.key);
}

export function computeStatus({messageError, loading, messages, statusOverride, inputValue, isVoiceInput}) {
  if (messageError) {
    return "error";
  }
  if (loading) {
    const lastMessage = messages?.length > 0 ? messages[messages.length - 1] : null;
    if (lastMessage?.isReasoningPhase || (lastMessage?.reasonText && !lastMessage?.text)) {
      return "thinking";
    }
    return "replying";
  }
  if (statusOverride) {
    return statusOverride;
  }
  if ((inputValue || "").trim() !== "" || isVoiceInput) {
    return "typing";
  }
  return "idle";
}

function MenuItem({actionKey, label, icon, active, onAction}) {
  return (
    <button
      type="button"
      className={`chat-virtual-figure__menu-item${active ? " chat-virtual-figure__menu-item--active" : ""}`}
      onClick={() => onAction(actionKey)}
    >
      {icon ? <span className="chat-virtual-figure__menu-icon">{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}

function VirtualFigureMenu({size, statusText, onAction}) {
  return (
    <div className="chat-virtual-figure__menu" onPointerDown={(e) => e.stopPropagation()}>
      <div className="chat-virtual-figure__menu-status">{statusText}</div>
      <MenuItem actionKey="sizeSmall" label={i18next.t("figure:Small")} icon={size === "small" ? <CheckOutlined /> : null} active={size === "small"} onAction={onAction} />
      <MenuItem actionKey="sizeMedium" label={i18next.t("figure:Medium")} icon={size === "medium" ? <CheckOutlined /> : null} active={size === "medium"} onAction={onAction} />
      <MenuItem actionKey="sizeLarge" label={i18next.t("figure:Large")} icon={size === "large" ? <CheckOutlined /> : null} active={size === "large"} onAction={onAction} />
      <MenuItem actionKey="settings" label={i18next.t("figure:Figure settings")} icon={<SettingOutlined />} onAction={onAction} />
      <MenuItem actionKey="disable" label={i18next.t("figure:Disable figure")} icon={<EyeInvisibleOutlined />} onAction={onAction} />
    </div>
  );
}

export default VirtualFigureMenu;
