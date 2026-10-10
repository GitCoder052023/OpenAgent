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
import Loading from "./common/Loading";
import {Button, Card, Col, Input, InputNumber, Row, Select, Space, Switch} from "antd";
import * as ExperienceBackend from "./backend/ExperienceBackend";
import * as StoreBackend from "./backend/StoreBackend";
import * as Setting from "./Setting";
import i18next from "i18next";
import {diffText} from "./chat/diffText";

const EXPERIENCE_STATES = ["Draft", "Active", "Archived"];
const EXPERIENCE_CATEGORIES = ["Fact", "Style", "Format", "Scope"];

class ExperienceEditPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      classes: props,
      experienceName: props.match.params.experienceName,
      experience: null,
      stores: [],
      isNewExperience: props.location?.state?.isNewExperience || false,
    };
  }

  UNSAFE_componentWillMount() {
    this.getExperience();
    this.getStores();
  }

  getStores() {
    StoreBackend.getStores("admin")
      .then((res) => {
        if (res.status === "ok") {
          this.setState({stores: res.data || []});
        }
      });
  }

  getExperience() {
    ExperienceBackend.getExperience("admin", this.state.experienceName)
      .then((res) => {
        if (res.status === "ok") {
          this.setState({experience: res.data});
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        }
      });
  }

  updateExperienceField(key, value) {
    const experience = this.state.experience;
    experience[key] = value;
    this.setState({experience});
  }

  renderExperienceField(label, control, span = 8, style = {}) {
    return (
      <Col style={{marginTop: "12px", ...style}} span={Setting.isMobile() ? 22 : span}>
        <div style={{marginBottom: "6px", color: "var(--ant-color-text-secondary)", fontWeight: 500, lineHeight: "22px", fontSize: "13px"}}>{label}</div>
        {control}
      </Col>
    );
  }

  // The point of the library is the delta between what the model said and what a human
  // wanted, so the edit page leads with that delta rather than with metadata.
  renderDiff(experience) {
    const isDark = Setting.getIsDark();
    const {parts, truncated} = diffText(experience.originalText || "", experience.correctedText || "");
    const removeBg = isDark ? "rgba(248, 81, 73, 0.22)" : "#ffeef0";
    const removeText = isDark ? "#ffb3ae" : "#82071e";
    const insertBg = isDark ? "rgba(63, 185, 80, 0.22)" : "#e6ffec";
    const insertText = isDark ? "#87e0a0" : "#0a5f2c";

    if (!experience.originalText && !experience.correctedText) {
      return null;
    }

    return (
      <div>
        <div style={{fontSize: "12px", color: "var(--ant-color-text-tertiary)", marginBottom: "8px"}}>
          {truncated
            ? i18next.t("experience:The answers differ too much to align, showing both versions")
            : i18next.t("experience:Struck-through text was removed, highlighted text was added")}
        </div>
        <div style={{whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "13px", lineHeight: "1.8"}}>
          {parts.map((part, index) => {
            if (part.type === "equal") {
              return <span key={index}>{part.text}</span>;
            }
            const isRemove = part.type === "remove";
            return (
              <span
                key={index}
                style={{
                  background: isRemove ? removeBg : insertBg,
                  color: isRemove ? removeText : insertText,
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
      </div>
    );
  }

  renderExperience() {
    const experience = this.state.experience;
    const rowGutter = [16, 8];
    const cardHeadStyle = {background: "transparent", borderBottom: "none", fontWeight: 600, fontSize: "15px"};
    const sectionCardStyle = {
      marginBottom: "16px",
      borderRadius: "14px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      padding: "18px",
    };

    const renderCardTitle = (title, desc) => (
      <div>
        <div style={{fontWeight: 600, fontSize: "15px"}}>{title}</div>
        <div style={{fontSize: "13px", color: "var(--ant-color-text-tertiary)", fontWeight: 400, marginTop: "2px"}}>{desc}</div>
      </div>
    );

    return (
      <div>
        <div style={{marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <span style={{fontSize: "22px", fontWeight: 600}}>{i18next.t("experience:Edit Experience")}</span>
          <div style={{display: "flex", gap: "8px", marginRight: "4px"}}>
            <Space wrap>
              <Button onClick={() => this.submitExperienceEdit(false)}>{i18next.t("general:Save")}</Button>
              <Button type="primary" onClick={() => this.submitExperienceEdit(true)}>{i18next.t("general:Save & Exit")}</Button>
              {this.state.isNewExperience && <Button onClick={() => this.cancelExperienceEdit()}>{i18next.t("general:Cancel")}</Button>}
            </Space>
          </div>
        </div>

        <Card size="small" title={renderCardTitle(i18next.t("experience:The correction"), i18next.t("experience:The correction desc"))} style={sectionCardStyle} headStyle={cardHeadStyle}>
          <Row gutter={rowGutter}>
            {this.renderExperienceField(
              i18next.t("experience:Question"),
              <Input.TextArea autoSize={{minRows: 2, maxRows: 6}} value={experience.question} onChange={e => {
                this.updateExperienceField("question", e.target.value);
              }} />,
              24
            )}
            {this.renderExperienceField(
              i18next.t("experience:Original AI answer"),
              <Input.TextArea autoSize={{minRows: 3, maxRows: 12}} value={experience.originalText} onChange={e => {
                this.updateExperienceField("originalText", e.target.value);
              }} />,
              12
            )}
            {this.renderExperienceField(
              i18next.t("experience:Corrected answer"),
              <Input.TextArea autoSize={{minRows: 3, maxRows: 12}} value={experience.correctedText} onChange={e => {
                this.updateExperienceField("correctedText", e.target.value);
              }} />,
              12
            )}
            {this.renderExperienceField(
              i18next.t("experience:Why was it wrong?"),
              <Input.TextArea autoSize={{minRows: 2, maxRows: 4}} value={experience.reason} onChange={e => {
                this.updateExperienceField("reason", e.target.value);
              }} />,
              24
            )}
            <Col span={Setting.isMobile() ? 22 : 24} style={{marginTop: "12px"}}>
              {this.renderDiff(experience)}
            </Col>
          </Row>
        </Card>

        <Card size="small" title={renderCardTitle(i18next.t("experience:How it is used"), i18next.t("experience:How it is used desc"))} style={sectionCardStyle} headStyle={cardHeadStyle}>
          <Row gutter={rowGutter}>
            {this.renderExperienceField(
              i18next.t("general:Category"),
              <Select style={{width: "100%"}} value={experience.category} onChange={value => {
                this.updateExperienceField("category", value);
              }} options={EXPERIENCE_CATEGORIES.map(item => ({value: item, label: i18next.t(`experience:Category - ${item}`)}))} />,
              8
            )}
            {this.renderExperienceField(
              i18next.t("general:State"),
              <Select style={{width: "100%"}} value={experience.state} onChange={value => {
                this.updateExperienceField("state", value);
              }} options={EXPERIENCE_STATES.map(item => ({value: item, label: i18next.t(`experience:State - ${item}`)}))} />,
              8
            )}
            {this.renderExperienceField(
              i18next.t("experience:Hit count"),
              <InputNumber style={{width: "100%"}} disabled value={experience.hitCount} />,
              8
            )}
            {this.renderExperienceField(
              Setting.getLabel(i18next.t("experience:Standing rule"), i18next.t("experience:Standing rule - Tooltip")),
              <Switch checked={experience.isGlobalRule} onChange={checked => {
                this.updateExperienceField("isGlobalRule", checked);
              }} />,
              8
            )}
            {experience.isGlobalRule ? this.renderExperienceField(
              Setting.getLabel(i18next.t("experience:Rule"), i18next.t("experience:Rule - Tooltip")),
              <Input.TextArea autoSize={{minRows: 2, maxRows: 6}} value={experience.rule} onChange={e => {
                this.updateExperienceField("rule", e.target.value);
              }} />,
              16
            ) : null}
          </Row>
        </Card>

        <Card size="small" title={renderCardTitle(i18next.t("experience:Source - title"), i18next.t("experience:Source desc"))} style={sectionCardStyle} headStyle={cardHeadStyle}>
          <Row gutter={rowGutter}>
            {this.renderExperienceField(
              i18next.t("general:Name"),
              <Input disabled value={experience.name} />,
              8
            )}
            {this.renderExperienceField(
              Setting.getLabel(i18next.t("general:Store"), i18next.t("experience:Experience store - Tooltip")),
              <Select
                virtual={false}
                showSearch
                style={{width: "100%"}}
                value={experience.store || undefined}
                placeholder={i18next.t("experience:Experience store - Tooltip")}
                onChange={value => {
                  this.updateExperienceField("store", value);
                }}
                options={this.state.stores.map(item => ({value: item.name, label: `${item.displayName} (${item.name})`}))}
              />,
              8
            )}
            {this.renderExperienceField(
              i18next.t("general:User"),
              <Input disabled value={experience.user} />,
              8
            )}
            {this.renderExperienceField(
              i18next.t("general:Chat"),
              <Input disabled value={experience.chat} />,
              8
            )}
            {this.renderExperienceField(
              i18next.t("general:Message"),
              <Input disabled value={experience.message} />,
              8
            )}
            {this.renderExperienceField(
              i18next.t("general:Created time"),
              <Input disabled value={Setting.getFormattedDate(experience.createdTime)} />,
              8
            )}
          </Row>
        </Card>
      </div>
    );
  }

  submitExperienceEdit(exitAfterSave) {
    const experience = Setting.deepCopy(this.state.experience);
    ExperienceBackend.updateExperience(this.state.experience.owner, this.state.experienceName, experience)
      .then((res) => {
        if (res.status === "ok") {
          Setting.showMessage("success", i18next.t("general:Successfully saved"));
          this.setState({
            experienceName: this.state.experience.name,
            isNewExperience: false,
          });

          if (exitAfterSave) {
            this.props.history.push("/experiences");
          } else {
            this.props.history.push(`/experiences/${this.state.experience.name}`);
          }
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${error}`);
      });
  }

  cancelExperienceEdit() {
    if (this.state.isNewExperience) {
      ExperienceBackend.deleteExperience(this.state.experience)
        .then((res) => {
          if (res.status === "ok") {
            Setting.showMessage("success", i18next.t("general:Cancelled successfully"));
            this.props.history.push("/experiences");
          } else {
            Setting.showMessage("error", `${i18next.t("general:Failed to cancel")}: ${res.msg}`);
          }
        })
        .catch(error => {
          Setting.showMessage("error", `${i18next.t("general:Failed to cancel")}: ${error}`);
        });
    } else {
      this.props.history.push("/experiences");
    }
  }

  render() {
    return (
      <div style={{background: "var(--ant-color-bg-layout)", padding: "16px 20px 32px", minHeight: "100vh"}}>
        {
          this.state.experience !== null ? this.renderExperience() : <Loading type="page" tip={i18next.t("general:Loading")} />
        }
      </div>
    );
  }
}

export default ExperienceEditPage;
