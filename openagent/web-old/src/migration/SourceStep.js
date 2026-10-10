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
import {Alert, Button, Card, Collapse, Input, Radio, Space, Tag, Typography, Upload} from "antd";
import {InboxOutlined} from "@ant-design/icons";
import i18next from "i18next";

const {Text, Paragraph} = Typography;

// What a bundle file looks like, shown to anyone importing from an agent that
// has no native adapter: they write this much JSON and the wizard does the rest.
const bundleExample = `{
  "source": "my-agent",
  "agents": [
    {"name": "main", "displayName": "Main", "prompt": "You are helpful.",
     "modelProvider": "openai", "skills": ["pdf"]}
  ],
  "providers": [
    {"name": "openai", "type": "OpenAI", "subType": "gpt-6-astra", "clientSecret": "sk-..."}
  ],
  "skills": [
    {"name": "pdf", "skillMd": "---\\nname: pdf\\n---\\nRead PDFs."}
  ],
  "mcpServers": [
    {"name": "fs", "command": "npx", "args": ["-y", "server-filesystem"]}
  ],
  "chats": [
    {"name": "c1", "agent": "main", "messages": [
      {"author": "user", "text": "hi"}, {"author": "AI", "text": "hello"}]}
  ]
}`;

// SourceStep picks which agent installation to import and how to reach it:
// a server-side directory scan, or an uploaded config file / .zip archive.
function SourceStep(props) {
  const {sources, sourceId, setSourceId, inputMode, setInputMode, path, setPath, file, setFile, scanning, onScan} = props;

  const selectedSource = sources.find(source => source.id === sourceId);

  // Switching sources re-fills the directory box with the new source's default
  // install location, but never overwrites a path the user typed themselves.
  function onSelectSource(id) {
    setSourceId(id);
    const source = sources.find(item => item.id === id);
    const isAutoFilled = path === "" || sources.some(item => item.defaultPath !== "" && item.defaultPath === path);
    if (source && isAutoFilled) {
      setPath(source.defaultPath);
    }
  }

  return (
    <div>
      <Card size="small" title={i18next.t("migration:Source agent")} style={{marginBottom: 16}}>
        <Radio.Group value={sourceId} onChange={e => onSelectSource(e.target.value)} style={{width: "100%"}}>
          <Space direction="vertical" style={{width: "100%"}}>
            <Radio value="">
              {i18next.t("migration:Auto-detect")}
              <Text type="secondary" style={{marginLeft: 8}}>{i18next.t("migration:Let OpenAgent recognize the format")}</Text>
            </Radio>
            {sources.map(source => (
              <Radio key={source.id} value={source.id}>
                {source.displayName}
                <Tag style={{marginLeft: 8}}>{source.id}</Tag>
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      </Card>

      <Card size="small" title={i18next.t("migration:Where is it")} style={{marginBottom: 16}}>
        <Radio.Group
          value={inputMode}
          onChange={e => setInputMode(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          style={{marginBottom: 16}}
          options={[
            {label: i18next.t("migration:Scan a directory on this server"), value: "path"},
            {label: i18next.t("migration:Upload a config file or archive"), value: "file"},
          ]}
        />

        {inputMode === "path" ? (
          <div>
            <Input
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder={selectedSource ? selectedSource.defaultPath : i18next.t("migration:e.g. /home/user/.openclaw")}
            />
            <Text type="secondary" style={{display: "block", marginTop: 8}}>
              {i18next.t("migration:The directory is read on the machine running OpenAgent, so this only works when the agent was installed there.")}
            </Text>
          </div>
        ) : (
          <div>
            <Upload.Dragger
              maxCount={1}
              beforeUpload={selected => {
                setFile(selected);
                return false;
              }}
              onRemove={() => setFile(null)}
              fileList={file ? [file] : []}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">{i18next.t("migration:Click or drag the config file here")}</p>
              <p className="ant-upload-hint">
                {selectedSource ? selectedSource.fileHint : i18next.t("migration:A config file, or a .zip of the whole agent directory to bring skills and chat history along.")}
              </p>
            </Upload.Dragger>
          </div>
        )}
      </Card>

      {sourceId === "bundle" && (
        <Collapse
          size="small"
          style={{marginBottom: 16}}
          items={[{
            key: "format",
            label: i18next.t("migration:What does a bundle file look like?"),
            children: (
              <div>
                <Paragraph type="secondary">
                  {i18next.t("migration:Every section is optional, so a file carrying nothing but chat history works too. Export this from any agent and its configuration lands in OpenAgent.")}
                </Paragraph>
                <pre style={{margin: 0, overflowX: "auto", fontSize: 12}}>{bundleExample}</pre>
              </div>
            ),
          }]}
        />
      )}

      <Alert
        type="info"
        showIcon
        style={{marginBottom: 16}}
        message={i18next.t("migration:Nothing is written yet")}
        description={i18next.t("migration:Scanning only reads the source and shows you a preview. You choose what to import on the next step.")}
      />

      <div style={{display: "flex", justifyContent: "flex-end"}}>
        <Button
          type="primary"
          size="large"
          loading={scanning}
          disabled={inputMode === "path" ? !path : !file}
          onClick={onScan}
        >
          {i18next.t("migration:Scan")}
        </Button>
      </div>
    </div>
  );
}

export default SourceStep;
