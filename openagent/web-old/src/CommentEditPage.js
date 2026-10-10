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
import {Button, Card, Col, Input, Row, Space} from "antd";
import * as CommentBackend from "./backend/CommentBackend";
import * as ResourceBackend from "./backend/ResourceBackend";
import * as Setting from "./Setting";
import CommentRichEditor from "./comment/CommentRichEditor";
import i18next from "i18next";

class CommentEditPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      classes: props,
      commentOwner: props.match.params.commentOwner,
      commentName: props.match.params.commentName,
      comment: null,
    };
  }

  UNSAFE_componentWillMount() {
    this.getComment();
  }

  getComment() {
    CommentBackend.getComment(this.state.commentOwner, this.state.commentName)
      .then((res) => {
        if (res.status === "ok") {
          this.setState({comment: res.data});
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        }
      });
  }

  updateCommentField(key, value) {
    const comment = this.state.comment;
    comment[key] = value;
    this.setState({comment});
  }

  submitCommentEdit(willExit) {
    const {comment, commentOwner, commentName} = this.state;
    CommentBackend.updateComment(commentOwner, commentName, comment)
      .then((res) => {
        if (res.status === "ok") {
          Setting.showMessage("success", i18next.t("general:Successfully saved"));
          if (willExit) {
            this.props.history.push("/comments");
          }
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
      });
  }

  uploadCommentImage = file => {
    const {account} = this.props;
    const {comment} = this.state;
    return ResourceBackend.uploadResource(account?.name || "", "chat", "comment", comment?.targetKey || comment?.name || "", file);
  };

  renderCommentField(label, control, span = 8) {
    return (
      <Col style={{marginTop: "12px"}} span={Setting.isMobile() ? 22 : span}>
        <div style={{marginBottom: "6px", color: "var(--ant-color-text-secondary)", fontWeight: 500, lineHeight: "22px", fontSize: "13px"}}>{label}</div>
        {control}
      </Col>
    );
  }

  renderComment() {
    const {comment} = this.state;
    const rowGutter = [16, 8];
    const cardHeadStyle = {background: "transparent", borderBottom: "none", fontWeight: 600, fontSize: "15px"};
    const sectionCardStyle = {
      marginBottom: "16px",
      borderRadius: "14px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      padding: "18px",
    };

    return (
      <div>
        <div style={{marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <span style={{fontSize: "22px", fontWeight: 600}}>{i18next.t("comment:Edit Comment")}</span>
          <Space>
            <Button onClick={() => this.submitCommentEdit(false)}>{i18next.t("general:Save")}</Button>
            <Button type="primary" onClick={() => this.submitCommentEdit(true)}>{i18next.t("general:Save & Exit")}</Button>
          </Space>
        </div>

        <Card size="small" title={i18next.t("general:Basic Information")} style={sectionCardStyle} headStyle={cardHeadStyle}>
          <Row gutter={rowGutter}>
            {this.renderCommentField(
              i18next.t("general:Owner"),
              <Input disabled value={comment.owner} />
            )}
            {this.renderCommentField(
              i18next.t("general:Name"),
              <Input disabled value={comment.name} />
            )}
            {this.renderCommentField(
              i18next.t("general:Created time"),
              <Input disabled value={Setting.getFormattedDate(comment.createdTime)} />
            )}
            {this.renderCommentField(
              i18next.t("general:Updated time"),
              <Input disabled value={Setting.getFormattedDate(comment.updatedTime)} />
            )}
            {this.renderCommentField(
              i18next.t("comment:Target type"),
              <Input disabled value={comment.targetType} />
            )}
            {this.renderCommentField(
              i18next.t("comment:Target key"),
              <Input disabled value={comment.targetKey} />,
              16
            )}
          </Row>
        </Card>

        <Card size="small" title={i18next.t("comment:Reply info")} style={sectionCardStyle} headStyle={cardHeadStyle}>
          <Row gutter={rowGutter}>
            {this.renderCommentField(
              i18next.t("comment:Parent owner"),
              <Input disabled value={comment.parentOwner} />
            )}
            {this.renderCommentField(
              i18next.t("comment:Parent name"),
              <Input disabled value={comment.parentName} />
            )}
            {this.renderCommentField(
              i18next.t("comment:Root owner"),
              <Input disabled value={comment.rootOwner} />
            )}
            {this.renderCommentField(
              i18next.t("comment:Root name"),
              <Input disabled value={comment.rootName} />
            )}
          </Row>
        </Card>

        <Card size="small" title={i18next.t("general:Content")} style={sectionCardStyle} headStyle={cardHeadStyle}>
          <Row gutter={rowGutter}>
            {this.renderCommentField(
              i18next.t("general:Content"),
              <CommentRichEditor
                value={comment.content}
                placeholder={i18next.t("store:Write a comment")}
                submitText={i18next.t("general:Save")}
                onChange={value => this.updateCommentField("content", value)}
                uploadImage={this.uploadCommentImage}
              />,
              24
            )}
          </Row>
        </Card>
      </div>
    );
  }

  render() {
    if (this.state.comment === null) {
      return <Loading />;
    }

    return (
      <div style={{padding: "20px"}}>
        {this.renderComment()}
      </div>
    );
  }
}

export default CommentEditPage;
