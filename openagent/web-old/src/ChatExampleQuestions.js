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
import {
  BulbOutlined,
  FireOutlined,
  GiftOutlined,
  HeartOutlined,
  IssuesCloseOutlined,
  QuestionOutlined,
  ReloadOutlined,
  SearchOutlined,
  TrophyOutlined
} from "@ant-design/icons";
import {Button} from "antd";
import i18next from "i18next";
import * as Setting from "./Setting";

const DEFAULT_ICONS = [
  {icon: QuestionOutlined, color: "#6366f1", bg: "#eef2ff"},
  {icon: IssuesCloseOutlined, color: "#3b82f6", bg: "#eff6ff"},
  {icon: BulbOutlined, color: "#10b981", bg: "#ecfdf5"},
  {icon: FireOutlined, color: "#f59e0b", bg: "#fffbeb"},
  {icon: HeartOutlined, color: "#ec4899", bg: "#fdf2f8"},
  {icon: GiftOutlined, color: "#8b5cf6", bg: "#f5f3ff"},
  {icon: TrophyOutlined, color: "#f59e0b", bg: "#fffbeb"},
  {icon: SearchOutlined, color: "#0ea5e9", bg: "#f0f9ff"},
];

class QuestionCard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {hovered: false};
    const idx = props.index % DEFAULT_ICONS.length;
    this.iconDef = DEFAULT_ICONS[idx];
  }

  render() {
    const {exampleQuestion, onClick} = this.props;
    const {hovered} = this.state;
    const {icon: Icon, color, bg} = this.iconDef;

    const hasImage = exampleQuestion.image && exampleQuestion.image.length > 0;

    return (
      <div
        onClick={onClick}
        onMouseEnter={() => this.setState({hovered: true})}
        onMouseLeave={() => this.setState({hovered: false})}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          gap: "12px",
          padding: "14px 16px",
          borderRadius: "12px",
          border: hovered ? `1.5px solid ${color}` : "1.5px solid #e5e7eb",
          backgroundColor: hovered ? bg : "#ffffff",
          cursor: "pointer",
          transition: "all 0.18s ease",
          boxShadow: hovered ? `0 4px 16px ${color}22` : "0 1px 4px rgba(0,0,0,0.06)",
          transform: hovered ? "translateY(-2px)" : "none",
        }}
      >
        <div style={{
          flexShrink: 0,
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          backgroundColor: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${color}33`,
        }}>
          {hasImage ? (
            <img
              src={exampleQuestion.image}
              alt="icon"
              style={{width: "20px", height: "20px", objectFit: "contain"}}
              referrerPolicy="no-referrer"
              onError={(e) => {e.target.style.display = "none";}}
            />
          ) : (
            <Icon style={{fontSize: "16px", color}} />
          )}
        </div>
        <div style={{flex: 1, minWidth: 0}}>
          {exampleQuestion.title && exampleQuestion.title !== exampleQuestion.text && (
            <div style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#374151",
              marginBottom: "4px",
              lineHeight: "1.4",
            }}>
              {exampleQuestion.title}
            </div>
          )}
          <div style={{
            fontSize: "13px",
            color: "#6b7280",
            lineHeight: "1.5",
            wordBreak: "break-word",
          }}>
            {exampleQuestion.text || exampleQuestion.title}
          </div>
        </div>
        <div style={{
          flexShrink: 0,
          color: hovered ? color : "#d1d5db",
          fontSize: "14px",
          marginTop: "2px",
          transition: "color 0.18s ease",
        }}>
          ↗
        </div>
      </div>
    );
  }
}

class ChatExampleQuestions extends React.Component {
  constructor(props) {
    super(props);
    this.state = {exampleQuestions: []};
  }

  componentDidMount() {
    this.selectExampleQuestions();
  }

  shouldComponentUpdate(nextProps, nextState) {
    return (
      this.state.exampleQuestions !== nextState.exampleQuestions ||
      JSON.stringify(this.props.exampleQuestions) !== JSON.stringify(nextProps.exampleQuestions)
    );
  }

  componentDidUpdate(prevProps) {
    if (JSON.stringify(prevProps.exampleQuestions) !== JSON.stringify(this.props.exampleQuestions)) {
      this.selectExampleQuestions();
    }
  }

  selectExampleQuestions = () => {
    const limit = Setting.isMobile() ? 4 : 6;
    const all = this.props.exampleQuestions;
    if (all.length <= limit) {
      this.setState({exampleQuestions: all});
    } else {
      this.setState({exampleQuestions: [...all].sort(() => 0.5 - Math.random()).slice(0, limit)});
    }
  };

  render() {
    const {exampleQuestions} = this.state;
    const isMobile = Setting.isMobile();
    const limit = isMobile ? 4 : 6;
    const canRefresh = this.props.exampleQuestions.length > limit;

    return (
      <div style={{
        position: "absolute",
        zIndex: 100,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "16px" : "24px",
        pointerEvents: "none",
      }}>
        <div style={{
          width: "100%",
          maxWidth: isMobile ? "100%" : "760px",
          pointerEvents: "auto",
        }}>
          {exampleQuestions.length > 0 && (
            <div style={{
              fontSize: "13px",
              color: "#9ca3af",
              textAlign: "center",
              marginBottom: "24px",
            }}>
              {i18next.t("store:Click a question to get started")}
            </div>
          )}

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: "10px",
          }}>
            {exampleQuestions.map((q, i) => (
              <QuestionCard
                key={`${q.text}-${i}`}
                exampleQuestion={q}
                index={i}
                onClick={() => this.props.sendMessage(q.text, "")}
              />
            ))}
          </div>

          {canRefresh && (
            <div style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "20px",
            }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={this.selectExampleQuestions}
                style={{
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#6b7280",
                  fontSize: "13px",
                  height: "36px",
                  padding: "0 16px",
                }}
              >
                {i18next.t("general:Refresh")}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default ChatExampleQuestions;
