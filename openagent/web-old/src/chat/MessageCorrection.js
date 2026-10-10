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

import React, {useMemo, useState} from "react";
import {Button, Checkbox, Input, Popconfirm, Select, Space, Tooltip} from "antd";
import {CheckCircleFilled, CheckOutlined, CloseOutlined, UndoOutlined} from "@ant-design/icons";
import i18next from "i18next";
import {diffText, getDiffStats} from "./diffText";

export const CORRECTION_CATEGORIES = ["Fact", "Style", "Format", "Scope"];

const getDiffColors = (isDark) => ({
  removeBg: isDark ? "rgba(248, 81, 73, 0.22)" : "#ffeef0",
  removeText: isDark ? "#ffb3ae" : "#82071e",
  insertBg: isDark ? "rgba(63, 185, 80, 0.22)" : "#e6ffec",
  insertText: isDark ? "#87e0a0" : "#0a5f2c",
  panelBg: isDark ? "#20242e" : "#fbfcfe",
  panelBorder: isDark ? "1px solid #333846" : "1px solid #e6eaf2",
  subtle: isDark ? "#8896b0" : "#8c96a8",
});

// CorrectionEditor lets a reader rewrite an AI answer in place. The extra fields are
// what turns a one-off fix into a reusable library entry, so they stay visible but
// optional.
export const CorrectionEditor = ({message, isDark, canSetGlobalRule, onSave, onCancel}) => {
  const [correctedText, setCorrectedText] = useState(message.correctedText || message.text || "");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("Fact");
  const [isGlobalRule, setIsGlobalRule] = useState(false);
  const [rule, setRule] = useState("");
  const [saving, setSaving] = useState(false);

  const colors = getDiffColors(isDark);
  const isUnchanged = correctedText.trim() === (message.correctedText || message.text || "").trim();

  const handleSave = () => {
    setSaving(true);
    Promise.resolve(onSave({
      correctedText,
      reason,
      category,
      isGlobalRule: canSetGlobalRule ? isGlobalRule : false,
      rule: canSetGlobalRule && isGlobalRule ? rule : "",
    })).finally(() => setSaving(false));
  };

  return (
    <div style={{
      width: "100%",
      background: isDark ? "#1e2130" : "#ffffff",
      border: colors.panelBorder,
      borderRadius: "12px",
      padding: "14px",
    }}>
      <div style={{fontSize: "13px", fontWeight: 600, marginBottom: "8px"}}>
        {i18next.t("experience:Correct this answer")}
      </div>
      <div style={{fontSize: "12px", color: colors.subtle, marginBottom: "10px"}}>
        {i18next.t("experience:Correct this answer - Tooltip")}
      </div>

      <Input.TextArea
        value={correctedText}
        onChange={e => setCorrectedText(e.target.value)}
        autoSize={{minRows: 4, maxRows: 18}}
        autoFocus
        style={{
          background: isDark ? "#252a3a" : "#f7f9fc",
          borderColor: isDark ? "#363d52" : "#dde3ed",
          borderRadius: "8px",
          fontSize: "14px",
          lineHeight: "1.7",
        }}
      />

      <div style={{display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap"}}>
        <Select
          size="small"
          value={category}
          onChange={setCategory}
          style={{width: "140px"}}
          options={CORRECTION_CATEGORIES.map(item => ({
            value: item,
            label: i18next.t(`experience:Category - ${item}`),
          }))}
        />
        <Input
          size="small"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={i18next.t("experience:Why was it wrong?")}
          style={{flex: 1, minWidth: "200px"}}
        />
      </div>

      {canSetGlobalRule && (
        <div style={{marginTop: "10px"}}>
          <Checkbox checked={isGlobalRule} onChange={e => setIsGlobalRule(e.target.checked)}>
            <span style={{fontSize: "12px"}}>{i18next.t("experience:Apply as a standing rule")}</span>
          </Checkbox>
          <div style={{fontSize: "11px", color: colors.subtle, marginLeft: "24px"}}>
            {i18next.t("experience:Apply as a standing rule - Tooltip")}
          </div>
          {isGlobalRule && (
            <Input
              size="small"
              value={rule}
              onChange={e => setRule(e.target.value)}
              placeholder={i18next.t("experience:Rule")}
              style={{marginTop: "8px"}}
            />
          )}
        </div>
      )}

      <div style={{display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px"}}>
        <Button size="small" icon={<CloseOutlined />} onClick={onCancel} style={{borderRadius: "20px"}}>
          {i18next.t("general:Cancel")}
        </Button>
        <Button
          type="primary"
          size="small"
          icon={<CheckOutlined />}
          loading={saving}
          disabled={correctedText.trim() === "" || isUnchanged}
          onClick={handleSave}
          style={{borderRadius: "20px"}}
        >
          {i18next.t("general:Save")}
        </Button>
      </div>
    </div>
  );
};

const DiffBlock = ({parts, colors}) => (
  <div style={{
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: "13px",
    lineHeight: "1.8",
  }}>
    {parts.map((part, index) => {
      if (part.type === "equal") {
        return <span key={index}>{part.text}</span>;
      }
      const isRemove = part.type === "remove";
      return (
        <span
          key={index}
          style={{
            background: isRemove ? colors.removeBg : colors.insertBg,
            color: isRemove ? colors.removeText : colors.insertText,
            textDecoration: isRemove ? "line-through" : "none",
            borderRadius: "3px",
            padding: "0 1px",
          }}
        >
          {part.text}
        </span>
      );
    })}
  </div>
);

// CorrectionBanner marks an answer that a human rewrote and, on demand, shows exactly
// what changed against the model's original output.
export const CorrectionBanner = ({message, isDark, canRevert, onRevert}) => {
  const [expanded, setExpanded] = useState(false);
  const colors = getDiffColors(isDark);

  const {parts, truncated} = useMemo(
    () => diffText(message.text || "", message.correctedText || ""),
    [message.text, message.correctedText]
  );
  const stats = useMemo(() => getDiffStats(parts), [parts]);

  return (
    <div style={{marginBottom: "10px"}}>
      <div style={{display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap"}}>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          background: colors.insertBg,
          color: colors.insertText,
          borderRadius: "10px",
          padding: "1px 9px",
          fontSize: "12px",
          fontWeight: 600,
        }}>
          <CheckCircleFilled style={{fontSize: "11px"}} />
          {i18next.t("experience:Corrected by a human")}
        </span>
        <span style={{fontSize: "11px", color: colors.subtle}}>
          +{stats.inserted} / -{stats.removed}
        </span>
        <Button
          type="link"
          size="small"
          style={{padding: 0, height: "auto", fontSize: "12px"}}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? i18next.t("experience:Hide changes") : i18next.t("experience:Show changes")}
        </Button>
        {canRevert && (
          <Popconfirm
            title={i18next.t("experience:Revert this correction?")}
            onConfirm={onRevert}
            okText={i18next.t("general:OK")}
            cancelText={i18next.t("general:Cancel")}
          >
            <Tooltip title={i18next.t("experience:Revert")} arrow={false}>
              <Button type="link" size="small" style={{padding: 0, height: "auto", fontSize: "12px"}} icon={<UndoOutlined />} />
            </Tooltip>
          </Popconfirm>
        )}
      </div>

      {expanded && (
        <div style={{
          marginTop: "8px",
          background: colors.panelBg,
          border: colors.panelBorder,
          borderRadius: "10px",
          padding: "10px 12px",
        }}>
          <div style={{fontSize: "11px", color: colors.subtle, marginBottom: "6px"}}>
            {truncated
              ? i18next.t("experience:The answers differ too much to align, showing both versions")
              : i18next.t("experience:Struck-through text was removed, highlighted text was added")}
          </div>
          <DiffBlock parts={parts} colors={colors} />

          <Space size="small" style={{marginTop: "10px"}}>
            <span style={{fontSize: "11px", color: colors.subtle}}>
              {i18next.t("experience:Original AI answer")}
            </span>
          </Space>
          <div style={{
            marginTop: "4px",
            padding: "8px 10px",
            borderLeft: `3px solid ${colors.removeText}`,
            background: colors.removeBg,
            borderRadius: "0 6px 6px 0",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: "12px",
            lineHeight: "1.7",
            opacity: 0.85,
          }}>
            {message.text}
          </div>
        </div>
      )}
    </div>
  );
};
