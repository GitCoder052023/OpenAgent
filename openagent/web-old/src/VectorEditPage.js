// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
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
import Loading from "./common/Loading";
import {Button, Card, Col, Input, InputNumber, Row, Space} from "antd";
import i18next from "i18next";
import * as Setting from "./Setting";
import * as VectorBackend from "./backend/VectorBackend";
import Editor from "./common/Editor";

const {TextArea} = Input;

class VectorEditPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      classes: props,
      vectorName: props.match.params.vectorName,
      vector: null,
      isNewVector: props.location?.state?.isNewVector || false,
      mode: new URLSearchParams(props.location?.search || "").get("mode") || "edit",
    };
  }

  UNSAFE_componentWillMount() {
    this.getVector();
  }

  getVector() {
    VectorBackend.getVector("admin", this.props.match.params.vectorName)
      .then((res) => {
        if (res.data === null) {
          this.props.history.push("/404");
          return;
        }

        if (res.status === "ok") {
          this.setState({
            vector: res.data,
          });
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        }
      });
  }

  parseVectorField(key, value) {
    if (key === "data") {
      value = value.split(",").map(Number);
    }

    if ([""].includes(key)) {
      value = Setting.myParseInt(value);
    }
    return value;
  }

  updateVectorField(key, value) {
    value = this.parseVectorField(key, value);

    const vector = this.state.vector;
    vector[key] = value;
    this.setState({
      vector: vector,
    });
  }

  renderVectorField(label, control, span = 8) {
    return (
      <Col style={{marginTop: "12px"}} span={Setting.isMobile() ? 22 : span}>
        <div style={{marginBottom: "6px", color: "var(--ant-color-text-secondary)", fontWeight: 500, lineHeight: "22px", fontSize: "13px"}}>{label}</div>
        {control}
      </Col>
    );
  }

  renderVectorActions() {
    const isViewMode = this.state.mode === "view";
    if (isViewMode) {
      return null;
    }
    return (
      <Space wrap>
        <Button onClick={() => this.submitVectorEdit(false)}>{i18next.t("general:Save")}</Button>
        <Button type="primary" onClick={() => this.submitVectorEdit(true)}>{i18next.t("general:Save & Exit")}</Button>
        {this.state.isNewVector && <Button onClick={() => this.cancelVectorEdit()}>{i18next.t("general:Cancel")}</Button>}
      </Space>
    );
  }

  renderVector() {
    const vector = this.state.vector;
    const isViewMode = this.state.mode === "view";
    const rowGutter = [16, 8];
    const cardHeadStyle = {background: "transparent", borderBottom: "none", fontWeight: 600, fontSize: "15px", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"};
    const sectionCardStyle = {
      marginBottom: "16px",
      borderRadius: "14px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      padding: "18px",
    };
    const renderCardTitle = (title, desc) => (
      <div>
        <div style={{fontWeight: 600, fontSize: "15px"}}>{title}</div>
        {desc && <div style={{fontSize: "13px", color: "var(--ant-color-text-tertiary)", fontWeight: 400, marginTop: "2px"}}>{desc}</div>}
      </div>
    );

    return (
      <div>
        <div style={{marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <span style={{fontSize: "22px", fontWeight: 600}}>
            {isViewMode ? i18next.t("vector:View Vector") : i18next.t("vector:Edit Vector")}
          </span>
          <div style={{display: "flex", gap: "8px", marginRight: "4px"}}>
            {this.renderVectorActions()}
          </div>
        </div>

        <Card size="small" title={renderCardTitle(i18next.t("general:General Settings"), i18next.t("general:General Settings desc"))} style={sectionCardStyle} headStyle={cardHeadStyle}>
          <Row gutter={rowGutter}>
            {this.renderVectorField(
              Setting.getLabel(i18next.t("general:Name"), i18next.t("general:Name - Tooltip")),
              <Input value={vector.name} disabled={isViewMode} onChange={(e) => this.updateVectorField("name", e.target.value)} />,
              8
            )}
            {this.renderVectorField(
              Setting.getLabel(i18next.t("general:Display name"), i18next.t("general:Display name - Tooltip")),
              <Input value={vector.displayName} disabled={isViewMode} onChange={(e) => this.updateVectorField("displayName", e.target.value)} />,
              8
            )}
            {this.renderVectorField(
              Setting.getLabel(i18next.t("general:Store"), i18next.t("general:Store - Tooltip")),
              <Input value={vector.store} disabled={isViewMode} onChange={(e) => this.updateVectorField("store", e.target.value)} />,
              8
            )}
            {this.renderVectorField(
              Setting.getLabel(i18next.t("general:Provider"), i18next.t("general:Provider - Tooltip")),
              <Input value={vector.provider} disabled={isViewMode} onChange={(e) => this.updateVectorField("provider", e.target.value)} />,
              8
            )}
            {this.renderVectorField(
              Setting.getLabel(i18next.t("store:File"), i18next.t("store:File - Tooltip")),
              <Input value={vector.file} disabled={isViewMode} onChange={(e) => this.updateVectorField("file", e.target.value)} />,
              8
            )}
            {this.renderVectorField(
              Setting.getLabel(i18next.t("general:Size"), i18next.t("general:Size - Tooltip")),
              <InputNumber disabled={true} style={{width: "100%"}} value={vector.size} onChange={(value) => this.updateVectorField("size", value)} />,
              4
            )}
            {this.renderVectorField(
              Setting.getLabel(i18next.t("vector:Dimension"), i18next.t("vector:Dimension - Tooltip")),
              <InputNumber disabled={true} style={{width: "100%"}} value={vector.dimension} onChange={(value) => this.updateVectorField("dimension", value)} />,
              4
            )}
          </Row>
        </Card>

        <Card size="small" title={renderCardTitle(i18next.t("general:Content"), "")} style={sectionCardStyle} headStyle={cardHeadStyle}>
          <Row gutter={rowGutter}>
            {this.renderVectorField(
              Setting.getLabel(i18next.t("general:Text"), i18next.t("general:Text - Tooltip")),
              <Editor
                value={vector.text}
                lang="markdown"
                dark
                fillHeight
                fillWidth
                readOnly={isViewMode}
                onChange={(value) => {
                  if (!isViewMode) {
                    this.updateVectorField("text", value);
                  }
                }}
              />,
              24
            )}
            {this.renderVectorField(
              Setting.getLabel(i18next.t("general:Data"), i18next.t("general:Data - Tooltip")),
              <TextArea autoSize={{minRows: 1, maxRows: 15}} value={vector.data} disabled={isViewMode} onChange={(e) => this.updateVectorField("data", e.target.value)} />,
              24
            )}
          </Row>
        </Card>
      </div>
    );
  }

  submitVectorEdit(exitAfterSave) {
    const vector = Setting.deepCopy(this.state.vector);
    VectorBackend.updateVector(this.state.vector.owner, this.state.vectorName, vector)
      .then((res) => {
        if (res.status === "ok") {
          Setting.showMessage("success", i18next.t("general:Successfully saved"));
          this.setState({
            vectorName: this.state.vector.name,
            isNewVector: false,
          });

          if (exitAfterSave) {
            this.props.history.push("/vectors");
          } else {
            this.props.history.push(`/vectors/${this.state.vector.name}`);
            this.getVector();
          }
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${error}`);
      });
  }

  cancelVectorEdit() {
    if (this.state.isNewVector) {
      VectorBackend.deleteVector(this.state.vector)
        .then((res) => {
          if (res.status === "ok") {
            Setting.showMessage("success", i18next.t("general:Cancelled successfully"));
            this.props.history.push("/vectors");
          } else {
            Setting.showMessage("error", `${i18next.t("general:Failed to cancel")}: ${res.msg}`);
          }
        })
        .catch(error => {
          Setting.showMessage("error", `${i18next.t("general:Failed to cancel")}: ${error}`);
        });
    } else {
      this.props.history.push("/vectors");
    }
  }

  render() {
    return (
      <div style={{background: "var(--ant-color-bg-layout)", padding: "16px 20px 32px", minHeight: "100vh"}}>
        {this.state.vector !== null ? this.renderVector() : <Loading type="page" tip={i18next.t("general:Loading")} />}
      </div>
    );
  }
}

export default VectorEditPage;
