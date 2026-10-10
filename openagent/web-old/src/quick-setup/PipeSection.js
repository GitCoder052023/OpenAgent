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
import {Input} from "antd";
import {LinkOutlined} from "@ant-design/icons";
import * as Setting from "../Setting";
import i18next from "i18next";
import {FieldRow, SectionTitle, SelectableCard, cardGridStyle, sectionStyle} from "./QuickSetupCommon";

function PipeSection({
  selectedPipeType, pipeSkipped,
  onSelectPipe, onSkipPipe,
  pipeToken, setPipeToken,
}) {
  const pipeTypes = Setting.getPipeTypeOptions();
  const meta = selectedPipeType ? Setting.getPipePlatformMetadata(selectedPipeType) : null;

  return (
    <div style={sectionStyle}>
      <SectionTitle
        number={2}
        title={i18next.t("setup:Connect a Messaging Platform")}
        subtitle={i18next.t("setup:Optional")}
      />
      <p style={{color: "var(--ant-color-text-secondary)", marginBottom: 16}}>
        {i18next.t("setup:Connect a messaging app so users can chat with your AI through Telegram, Discord, or WhatsApp. You can skip this step and set it up later.")}
      </p>

      <div style={{...cardGridStyle, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))"}}>
        {pipeTypes.map(p => (
          <SelectableCard
            key={p.id}
            logo={Setting.getProviderLogoURL({category: "Chat", type: p.id})}
            label={p.name}
            desc={Setting.getPipePlatformMetadata(p.id).desc}
            selected={selectedPipeType === p.id}
            onClick={() => onSelectPipe(p.id)}
          />
        ))}
        <div
          onClick={onSkipPipe}
          style={{
            border: "2px solid var(--ant-color-border)",
            borderRadius: 12,
            padding: "14px 12px",
            cursor: "pointer",
            background: pipeSkipped ? "var(--ant-color-fill-quaternary)" : "var(--ant-color-bg-container)",
            textAlign: "center",
            transition: "all 0.2s",
            userSelect: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{fontSize: 28, marginBottom: 8, opacity: 0.4}}>✕</div>
          <div style={{fontWeight: 600, fontSize: 13, marginBottom: 2}}>{i18next.t("general:Skip")}</div>
          <div style={{fontSize: 11, color: "var(--ant-color-text-secondary)"}}>{i18next.t("setup:Set up later")}</div>
        </div>
      </div>

      {meta && !pipeSkipped && (
        <div style={{borderTop: "1px solid var(--ant-color-border)", paddingTop: 20, marginTop: 4}}>
          <div style={{fontWeight: 600, fontSize: 15, marginBottom: 16}}>
            {i18next.t("setup:Configure")} {selectedPipeType}
          </div>

          <FieldRow
            label={meta.tokenLabel}
            hint={
              <span>
                {i18next.t("setup:How to get a token?")}&nbsp;
                <a href={meta.helpUrl} target="_blank" rel="noreferrer">
                  {i18next.t("setup:View guide")} <LinkOutlined />
                </a>
              </span>
            }
          >
            <Input.Password
              value={pipeToken}
              onChange={e => setPipeToken(e.target.value)}
              placeholder={meta.tokenPlaceholder}
              size="large"
            />
          </FieldRow>
        </div>
      )}
    </div>
  );
}

export default PipeSection;
