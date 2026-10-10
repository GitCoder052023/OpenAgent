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
import {Alert, Button, Space, Tag, Typography} from "antd";
import {LinkOutlined} from "@ant-design/icons";
import i18next from "i18next";

const {Text, Paragraph} = Typography;

const sectionStyle = {
  background: "var(--ant-color-bg-container)",
  border: "1px solid var(--ant-color-border)",
  borderRadius: 16,
  padding: "28px 28px 20px",
  marginBottom: 24,
};

function SuccessView({savedProvider, savedPipe, onReset, onGoToChat, onViewProvider, onViewPipe}) {
  return (
    <div style={{maxWidth: 720, margin: "0 auto", padding: "32px 16px"}}>
      <Alert
        type="success"
        showIcon
        message={<span style={{fontSize: 16, fontWeight: 600}}>{i18next.t("setup:Setup complete!")}</span>}
        description={
          <div style={{marginTop: 8}}>
            <Paragraph>{i18next.t("setup:Your configuration has been saved. You can now start chatting or further customize your setup.")}</Paragraph>
            <Space wrap>
              <Button type="primary" onClick={onGoToChat}>{i18next.t("general:Chat")}</Button>
              <Button onClick={onViewProvider} icon={<LinkOutlined />}>
                {i18next.t("setup:View AI Model")}
              </Button>
              {savedPipe && (
                <Button onClick={onViewPipe} icon={<LinkOutlined />}>
                  {i18next.t("setup:View Pipe")}
                </Button>
              )}
              <Button onClick={onReset}>{i18next.t("setup:Setup another")}</Button>
            </Space>
          </div>
        }
        style={{borderRadius: 16, marginBottom: 24}}
      />

      <div style={sectionStyle}>
        <div style={{fontWeight: 600, fontSize: 15, marginBottom: 12}}>{i18next.t("setup:Created Resources")}</div>
        <div style={{display: "flex", flexDirection: "column", gap: 8}}>
          <div style={{display: "flex", alignItems: "center", gap: 8}}>
            <Tag color="blue">{i18next.t("setup:AI Model")}</Tag>
            <Text code>{savedProvider.name}</Text>
            <Text type="secondary">({savedProvider.type} / {savedProvider.subType})</Text>
          </div>
          {savedPipe && (
            <div style={{display: "flex", alignItems: "center", gap: 8}}>
              <Tag color="green">{i18next.t("general:Pipes")}</Tag>
              <Text code>{savedPipe.name}</Text>
              <Text type="secondary">({savedPipe.type})</Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SuccessView;
