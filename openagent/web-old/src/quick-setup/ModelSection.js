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
import {Col, Input, Row, Select} from "antd";
import {LinkOutlined} from "@ant-design/icons";
import * as Setting from "../Setting";
import i18next from "i18next";
import {FieldRow, SectionTitle, SelectableCard, cardGridStyle, sectionStyle} from "./QuickSetupCommon";

const {Option} = Select;

function ModelSection({
  selectedModelType, onSelectModel,
  apiKey, setApiKey,
  clientId, setClientId,
  region, setRegion,
  subType, setSubType,
  providerUrl, setProviderUrl,
}) {
  const modelTypes = Setting.getQuickSetupModelTypes();
  const meta = selectedModelType ? Setting.getModelProviderMetadata(selectedModelType) : null;
  const modelList = selectedModelType && selectedModelType !== "OpenAI Compatible"
    ? Setting.getProviderSubTypeOptions("Model", selectedModelType)
    : [];

  return (
    <div style={sectionStyle}>
      <SectionTitle number={1} title={i18next.t("setup:Choose an AI Model")} />
      <div style={cardGridStyle}>
        {modelTypes.map(type => (
          <SelectableCard
            key={type}
            logo={Setting.getProviderLogoURL({category: "Model", type})}
            label={type}
            desc={Setting.getModelProviderMetadata(type).desc}
            selected={selectedModelType === type}
            onClick={() => onSelectModel(type)}
          />
        ))}
      </div>

      {meta && (
        <div style={{borderTop: "1px solid var(--ant-color-border)", paddingTop: 20, marginTop: 4}}>
          <div style={{fontWeight: 600, fontSize: 15, marginBottom: 16}}>
            {i18next.t("setup:Configure")} {selectedModelType}
          </div>

          <FieldRow label={i18next.t("general:Model")}>
            {modelList.length > 0 ? (
              <Select
                value={subType}
                onChange={setSubType}
                style={{width: "100%"}}
                showSearch
                allowClear={false}
                filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
              >
                {modelList.map(m => <Option key={m.id} value={m.id}>{m.name}</Option>)}
              </Select>
            ) : (
              <Input
                value={subType}
                onChange={e => setSubType(e.target.value)}
                placeholder={i18next.t("setup:Enter model name")}
              />
            )}
          </FieldRow>

          {meta.needsClientId && (
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <FieldRow label={selectedModelType === "Amazon Bedrock" ? "Access Key ID" : selectedModelType === "Azure" ? i18next.t("provider:Deployment name") : "Client ID"}>
                  <Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder={selectedModelType === "Azure" ? i18next.t("setup:Enter deployment name") : "AKIA..."} />
                </FieldRow>
              </Col>
            </Row>
          )}

          {meta.needsApiKey && (
            <FieldRow
              label={i18next.t("setup:API Key")}
              hint={i18next.t("setup:Your secret API key from the provider dashboard")}
            >
              <Input.Password
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
                size="large"
              />
            </FieldRow>
          )}

          {meta.needsRegion && (
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <FieldRow label={i18next.t("general:Region")}>
                  <Input value={region} onChange={e => setRegion(e.target.value)} placeholder="us-east-1" />
                </FieldRow>
              </Col>
            </Row>
          )}

          {meta.needsUrl && (
            <FieldRow
              label={selectedModelType === "Ollama" ? i18next.t("setup:Ollama Server URL") : i18next.t("setup:API Endpoint URL")}
              hint={selectedModelType === "Ollama" ? i18next.t("setup:Make sure Ollama is running locally before saving") : undefined}
            >
              <Input
                value={providerUrl}
                onChange={e => setProviderUrl(e.target.value)}
                placeholder={meta.urlPlaceholder || "https://"}
                prefix={<LinkOutlined />}
                size="large"
              />
            </FieldRow>
          )}
        </div>
      )}
    </div>
  );
}

export default ModelSection;
