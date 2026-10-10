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
import {Button, Col, Input, Row, Space, Tooltip} from "antd";
import {LinkOutlined, ReloadOutlined} from "@ant-design/icons";
import i18next from "i18next";
import * as Setting from "./Setting";
import CopyButton from "./common/CopyButton";
import {getOpenAiCompatibleBaseUrl, getOpenAiCompatibleChatCompletionsUrl} from "./OpenAiCompatibleSetting";

function ReadOnlyCopyInput({value}) {
  return (
    <Space.Compact style={{width: "100%"}}>
      <Input readOnly prefix={<LinkOutlined />} value={value} />
      <CopyButton value={value} />
    </Space.Compact>
  );
}

function generateApiKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return `sk-${Array.from(bytes, b => chars[b % chars.length]).join("")}`;
}

function OpenAiCompatibleConfig({apiKey, apiKeyDisabled = false, onApiKeyChange}) {
  const baseUrl = getOpenAiCompatibleBaseUrl();
  const chatCompletionsUrl = getOpenAiCompatibleChatCompletionsUrl();

  return (
    <div>
      <Space direction="vertical" size={4} style={{width: "100%"}}>
        <div style={{fontWeight: 600}}>{i18next.t("general:OpenAI compatible API")}</div>
        <div style={{color: "var(--ant-color-text-secondary)", fontSize: "13px"}}>{i18next.t("general:API integration hint")}</div>
      </Space>
      <Row gutter={48}>
        <Col style={{marginTop: "12px"}} span={Setting.isMobile() ? 22 : 6}>
          <div style={{marginBottom: "4px"}}>{i18next.t("general:External API key")}</div>
          <Space.Compact style={{width: "100%"}}>
            <Input.Password
              value={apiKey}
              disabled={apiKeyDisabled}
              onChange={onApiKeyChange}
            />
            <CopyButton value={apiKey} disabled={apiKeyDisabled || apiKey === "***"} />
            <Tooltip title={i18next.t("general:Generate a new key, copy it and save, it will not be shown again")}>
              <Button icon={<ReloadOutlined />} disabled={apiKeyDisabled} onClick={() => onApiKeyChange({target: {value: generateApiKey()}})} />
            </Tooltip>
          </Space.Compact>
        </Col>
        <Col style={{marginTop: "12px"}} span={Setting.isMobile() ? 22 : 6}>
          <div style={{marginBottom: "4px"}}>{i18next.t("server:Base URL")}</div>
          <ReadOnlyCopyInput value={baseUrl} />
        </Col>
        <Col style={{marginTop: "12px"}} span={Setting.isMobile() ? 22 : 12}>
          <div style={{marginBottom: "4px"}}>{i18next.t("general:Chat completions endpoint")}</div>
          <ReadOnlyCopyInput value={chatCompletionsUrl} />
        </Col>
      </Row>
    </div>
  );
}

export default OpenAiCompatibleConfig;
