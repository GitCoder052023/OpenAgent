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
import {CheckCircleFilled} from "@ant-design/icons";

export function SelectableCard({logo, label, desc, selected, onClick}) {
  const borderColor = selected ? "var(--ant-color-primary)" : "var(--ant-color-border)";
  const bgColor = selected ? "var(--ant-color-primary-bg)" : "var(--ant-color-bg-container)";

  return (
    <div
      onClick={onClick}
      style={{
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
        padding: "14px 12px",
        cursor: "pointer",
        background: bgColor,
        position: "relative",
        textAlign: "center",
        transition: "all 0.2s",
        userSelect: "none",
        minWidth: 120,
      }}
    >
      {selected && (
        <CheckCircleFilled style={{position: "absolute", top: 6, right: 6, color: "var(--ant-color-primary)", fontSize: 16}} />
      )}
      <div style={{height: 44, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8}}>
        {logo ? (
          <img src={logo} alt={label} style={{maxWidth: 44, maxHeight: 44, objectFit: "contain"}} />
        ) : (
          <div style={{width: 44, height: 44, borderRadius: 8, background: "var(--ant-color-fill-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "var(--ant-color-text-secondary)"}}>
            {label[0]}
          </div>
        )}
      </div>
      <div style={{fontWeight: 600, fontSize: 13, marginBottom: 2, lineHeight: 1.3}}>{label}</div>
      <div style={{fontSize: 11, color: "var(--ant-color-text-secondary)", lineHeight: 1.3}}>{desc}</div>
    </div>
  );
}

export function SectionTitle({number, title, subtitle}) {
  return (
    <div style={{marginBottom: 20}}>
      <div style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 4}}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--ant-color-primary)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 14,
          flexShrink: 0,
        }}>{number}</div>
        <span style={{fontSize: 18, fontWeight: 700}}>{title}</span>
        {subtitle && <Tag color="default" style={{marginLeft: 4, fontWeight: 400}}>{subtitle}</Tag>}
      </div>
    </div>
  );
}

export function FieldRow({label, children, hint}) {
  return (
    <div style={{marginBottom: 16}}>
      <div style={{marginBottom: 6, fontWeight: 500, fontSize: 14}}>{label}</div>
      {children}
      {hint && <div style={{marginTop: 4, fontSize: 12, color: "var(--ant-color-text-secondary)"}}>{hint}</div>}
    </div>
  );
}

export const sectionStyle = {
  background: "var(--ant-color-bg-container)",
  border: "1px solid var(--ant-color-border)",
  borderRadius: 16,
  padding: "28px 28px 20px",
  marginBottom: 24,
};

export const cardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
  gap: 12,
  marginBottom: 24,
};
