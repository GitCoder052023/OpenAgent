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

import React, {useState} from "react";
import {Spin} from "antd";
import {BulbOutlined, CheckCircleFilled, DownOutlined, LoadingOutlined} from "@ant-design/icons";
import i18next from "i18next";
import {renderText} from "../ChatMessageRender";

const ReasoningSection = ({reasonText, isReasoningPhase, isDark, themeColor}) => {
  const [expanded, setExpanded] = useState(true);

  if (!reasonText) {
    return null;
  }

  const isThinking = !!isReasoningPhase;
  const border = isDark ? "1px solid #2a2e3d" : "1px solid #e6eaf4";
  const bg = isDark ? "#191c26" : "#f7f9fd";
  const labelColor = isDark ? "#565e78" : "#9aa3b8";
  const nameColor = isDark ? "#dde3f5" : "#1a2340";
  const bodyBorderTop = isDark ? "1px solid #22263a" : "1px solid #eaeef8";

  return (
    <div style={{marginBottom: "14px"}}>
      {/* Section label */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        marginBottom: "8px",
        color: labelColor,
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}>
        <BulbOutlined style={{fontSize: "11px"}} />
        <span>{i18next.t("chat:Reasoning process")}</span>
      </div>

      {/* Card */}
      <div style={{
        borderRadius: "10px",
        border,
        background: bg,
        overflow: "hidden",
        transition: "box-shadow 0.15s",
      }}>
        {/* Header */}
        <div
          onClick={() => setExpanded(v => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "9px 13px",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {/* Icon */}
          <div style={{
            width: "28px",
            height: "28px",
            borderRadius: "7px",
            background: `${themeColor}1a`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <BulbOutlined style={{color: themeColor, fontSize: "13px"}} />
          </div>

          {/* Title */}
          <span style={{
            fontSize: "13px",
            fontWeight: 600,
            color: nameColor,
            flex: 1,
          }}>
            {i18next.t("chat:Reasoning process")}
          </span>

          {/* Status badge */}
          {isThinking ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              background: isDark ? "#22273a" : "#eff2fa",
              borderRadius: "20px",
              padding: "3px 9px 3px 7px",
              flexShrink: 0,
            }}>
              <Spin indicator={<LoadingOutlined style={{fontSize: "11px", color: themeColor}} spin />} />
              <span style={{fontSize: "11px", color: labelColor, fontWeight: 500, lineHeight: 1}}>
                {i18next.t("chat:Thinking")}
              </span>
            </div>
          ) : (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              background: isDark ? "#162516" : "#f0faf1",
              borderRadius: "20px",
              padding: "3px 9px 3px 7px",
              flexShrink: 0,
            }}>
              <CheckCircleFilled style={{fontSize: "11px", color: "#4ade80"}} />
              <span style={{fontSize: "11px", color: isDark ? "#4ade80" : "#16a34a", fontWeight: 500, lineHeight: 1}}>
                {i18next.t("chat:Done")}
              </span>
            </div>
          )}

          {/* Chevron */}
          <DownOutlined style={{
            fontSize: "10px",
            color: labelColor,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }} />
        </div>

        {/* Body */}
        {expanded && (
          <div style={{
            borderTop: bodyBorderTop,
            padding: "10px 13px 12px",
            fontSize: "13px",
            lineHeight: "1.7",
            color: isDark ? "#a0a8c0" : "#4b5572",
            maxHeight: "400px",
            overflowY: "auto",
          }}>
            {renderText(reasonText)}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReasoningSection;
