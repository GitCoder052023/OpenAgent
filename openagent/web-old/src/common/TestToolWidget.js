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
import {Button, Col, Row, Select} from "antd";
import * as Setting from "../Setting";
import i18next from "i18next";
import * as ToolBackend from "../backend/ToolBackend";
import * as ProviderBackend from "../backend/ProviderBackend";
import Editor from "./Editor";
import ChatWidget from "./ChatWidget";

const {Option} = Select;

function tryFormatJson(str) {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch (e) {
    return str;
  }
}

function isValidToolTestJson(content) {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed.tool === "string" && parsed.tool.trim() !== "";
  } catch (e) {
    return false;
  }
}

function buildDefaultToolTestJson(tool) {
  const fns = Setting.getToolFunctions(tool);
  if (fns.length > 0) {
    return fns[0].testContent;
  }
  return JSON.stringify({tool: "", arguments: {}}, null, 2);
}

class TestToolWidget extends React.Component {
  constructor(props) {
    super(props);
    const guiFns = Setting.getToolFunctions({type: "gui"});
    const videoFns = Setting.getToolFunctions({type: "video_download"});
    this.state = {
      testButtonLoading: false,
      testResult: "",
      modelProviders: [],
      modelProvidersLoading: false,
      lastSyncedType: props.tool ? (props.tool.type || null) : null,
      lastSyncedSubType: props.tool ? (props.tool.subType || null) : null,
      selectedGuiTool: guiFns.length > 0 ? guiFns[0].name : "",
      selectedVideoTool: videoFns.length > 0 ? videoFns[0].name : "",
    };
  }

  componentDidMount() {
    this.syncFromTool(this.props.tool);
    this.loadModelProviders();
  }

  componentDidUpdate() {
    const {tool} = this.props;
    if (!tool) {
      return;
    }

    const currentType = tool.type || null;
    if (currentType !== this.state.lastSyncedType) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({lastSyncedType: currentType, lastSyncedSubType: tool.subType || null, testResult: ""});
      if (this.props.onUpdateTool) {
        this.props.onUpdateTool("testContent", buildDefaultToolTestJson(tool));
      }
      return;
    }

    if (tool.type === "office") {
      const currentSubType = tool.subType || null;
      if (currentSubType !== this.state.lastSyncedSubType) {
        // eslint-disable-next-line react/no-did-update-set-state
        this.setState({lastSyncedSubType: currentSubType});
        if (this.props.onUpdateTool) {
          this.props.onUpdateTool("testContent", buildDefaultToolTestJson(tool));
        }
        return;
      }
    }

    if (this.state.modelProviders.length === 0 && !this.state.modelProvidersLoading) {
      this.loadModelProviders();
    }
  }

  loadModelProviders() {
    this.setState({modelProvidersLoading: true});
    ProviderBackend.getProviders("admin")
      .then((res) => {
        if (res.status === "ok") {
          this.setState({modelProviders: res.data.filter(p => p.category === "Model"), modelProvidersLoading: false});
        } else {
          this.setState({modelProvidersLoading: false});
        }
      });
  }

  syncFromTool(tool) {
    const {onUpdateTool} = this.props;
    if (!tool) {
      return;
    }
    const needsDefault = !tool.testContent ||
      tool.testContent.trim() === "" ||
      !isValidToolTestJson(tool.testContent);
    if (needsDefault && onUpdateTool) {
      onUpdateTool("testContent", buildDefaultToolTestJson(tool));
    } else if (onUpdateTool && tool.testContent) {
      const formatted = tryFormatJson(tool.testContent);
      if (formatted !== tool.testContent) {
        onUpdateTool("testContent", formatted);
      }
    }
    if (tool.resultSummary) {
      this.setState({testResult: tool.resultSummary});
    }
    if (tool.type === "gui" && this.state.selectedGuiTool.startsWith("gui_")) {
      const guiFns = Setting.getToolFunctions({type: "gui"});
      this.setState({selectedGuiTool: guiFns.length > 0 ? guiFns[0].name : ""});
    }
  }

  async sendTestTool(tool, originalTool) {
    let parsed;
    try {
      parsed = JSON.parse(tool.testContent);
    } catch (e) {
      Setting.showMessage("error", `${i18next.t("provider:Invalid tool test JSON")}: ${e.message}`);
      return;
    }
    if (!parsed || typeof parsed.tool !== "string" || parsed.tool.trim() === "") {
      Setting.showMessage("error", i18next.t("provider:Tool test JSON must include tool"));
      return;
    }

    this.setState({testButtonLoading: true, testResult: ""});

    try {
      const res = await ToolBackend.testTool(tool);
      if (res.status === "ok") {
        let out;
        if (typeof res.data === "string") {
          try {
            out = JSON.stringify(JSON.parse(res.data), null, 2);
          } catch (e) {
            out = res.data;
          }
        } else {
          out = JSON.stringify(res.data, null, 2);
        }
        this.setState({testResult: out});
        Setting.showMessage("success", i18next.t("general:Success"));
        if (this.props.onUpdateTool) {
          this.props.onUpdateTool("resultSummary", out);
        }
        await ToolBackend.updateTool(tool.owner, tool.name, {...tool, resultSummary: out});
      } else {
        Setting.showMessage("error", res.msg || i18next.t("general:Failed to save"));
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error.message}`);
    } finally {
      this.setState({testButtonLoading: false});
    }
  }

  render() {
    const {tool, originalTool, onUpdateTool, account} = this.props;
    const {modelProviders} = this.state;
    const selectedModelProvider = tool.modelProvider || "";

    if (!tool) {
      return null;
    }

    const guiFunctions = Setting.getToolFunctions({type: "gui"});
    const videoFunctions = Setting.getToolFunctions({type: "video_download"});

    return (
      <React.Fragment>
        <Row style={{marginTop: "20px"}}>
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {Setting.getLabel(i18next.t("provider:Tool test"), i18next.t("provider:Tool test JSON - Tooltip"))} :
          </Col>
          <Col span={10}>
            {tool.type === "gui" && (
              <div style={{marginBottom: "8px"}}>
                <div style={{marginBottom: "4px"}}>
                  {Setting.getLabel(i18next.t("provider:Tool function"), i18next.t("provider:Tool function - Tooltip"))} :
                </div>
                <Select
                  style={{width: "100%"}}
                  value={this.state.selectedGuiTool}
                  onChange={(value) => {
                    this.setState({selectedGuiTool: value});
                    const fn = guiFunctions.find(f => f.name === value);
                    if (fn) {
                      onUpdateTool("testContent", fn.testContent);
                    }
                  }}
                >
                  {guiFunctions.map((f) => (
                    <Option key={f.name} value={f.name}>{`${f.name} — ${f.description}`}</Option>
                  ))}
                </Select>
              </div>
            )}
            {tool.type === "video_download" && (
              <div style={{marginBottom: "8px"}}>
                <div style={{marginBottom: "4px"}}>
                  {Setting.getLabel(i18next.t("provider:Tool function"), i18next.t("provider:Tool function - Tooltip"))} :
                </div>
                <Select
                  style={{width: "100%"}}
                  value={this.state.selectedVideoTool}
                  onChange={(value) => {
                    this.setState({selectedVideoTool: value});
                    const fn = videoFunctions.find(f => f.name === value);
                    if (fn) {
                      onUpdateTool("testContent", fn.testContent);
                    }
                  }}
                >
                  {videoFunctions.map((f) => (
                    <Option key={f.name} value={f.name}>{`${f.name} — ${f.description}`}</Option>
                  ))}
                </Select>
              </div>
            )}
            <Editor
              value={tool.testContent}
              lang="json"
              height="150px"
              dark
              onChange={value => {onUpdateTool("testContent", value);}}
            />
          </Col>
          <Col span={6}>
            <Button
              style={{marginLeft: "10px", marginBottom: "5px"}}
              type="primary"
              loading={this.state.testButtonLoading}
              disabled={!tool.testContent || tool.testContent.trim() === ""}
              onClick={() => this.sendTestTool(tool, originalTool)}
            >
              {i18next.t("provider:Invoke tool")}
            </Button>
          </Col>
        </Row>
        <Row style={{marginTop: "10px"}}>
          <Col span={2}></Col>
          <Col span={10}>
            <div style={{marginBottom: "5px"}}><strong>{i18next.t("provider:Tool result")}:</strong></div>
            <Editor
              value={this.state.testResult}
              lang="json"
              height="150px"
              dark
              readOnly
            />
          </Col>
        </Row>
        <Row style={{marginTop: "20px"}}>
          <Col style={{marginTop: "5px"}} span={(Setting.isMobile()) ? 22 : 2}>
            {Setting.getLabel(i18next.t("provider:Chat test"), i18next.t("provider:Chat test - Tooltip"))} :
          </Col>
          <Col span={20}>
            <Row style={{marginBottom: "10px"}}>
              <Col span={24}>
                <Select
                  style={{width: "100%"}}
                  placeholder={i18next.t("provider:Select model provider")}
                  value={selectedModelProvider || undefined}
                  onChange={(value) => onUpdateTool("modelProvider", value)}
                  showSearch
                  filterOption={(input, option) =>
                    option.children[1].toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {modelProviders.map((mp, index) => (
                    <Option key={index} value={mp.name}>
                      <img width={20} height={20} style={{marginBottom: "3px", marginRight: "10px"}}
                        src={Setting.getProviderLogoURL({category: mp.category, type: mp.type})}
                        alt={mp.name} />
                      {mp.displayName || mp.name}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>
            <Row style={{marginBottom: "10px"}}>
              <Col span={24}>
                <div style={{marginBottom: "4px"}}>
                  {Setting.getLabel(i18next.t("tool:Prompt examples"), i18next.t("tool:Prompt examples - Tooltip"))} :
                </div>
                <Select virtual={false} mode="tags" style={{width: "100%"}}
                  value={tool.promptExamples}
                  onChange={(value) => onUpdateTool("promptExamples", value)}
                />
              </Col>
            </Row>
            {selectedModelProvider ? (
              <ChatWidget
                key={`${tool.name}-${selectedModelProvider}`}
                chatName={`chat_tool_${tool.name}`}
                displayName={`${tool.name} - Chat Test`}
                category="ToolTest"
                modelProvider={selectedModelProvider}
                tool={tool.name}
                account={account}
                height="600px"
                showHeader={true}
                showNewChatButton={true}
                exampleQuestions={(tool.promptExamples || []).map(ex => ({title: ex, text: ex, image: ""}))}
              />
            ) : (
              <div style={{
                width: "100%",
                height: "100px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #d9d9d9",
                borderRadius: "6px",
                color: "#999",
              }}>
                {i18next.t("provider:Please select a model provider first")}
              </div>
            )}
          </Col>
        </Row>
      </React.Fragment>
    );
  }
}

export default TestToolWidget;
