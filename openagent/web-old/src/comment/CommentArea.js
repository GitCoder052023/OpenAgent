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

import React, {useCallback, useEffect, useState} from "react";
import {Button, Card, Empty, List, Modal, Pagination, Space, Typography} from "antd";
import {CommentOutlined, DeleteOutlined, EditOutlined} from "@ant-design/icons";
import i18next from "i18next";
import * as CommentBackend from "../backend/CommentBackend";
import * as ResourceBackend from "../backend/ResourceBackend";
import * as Setting from "../Setting";
import UserLabel from "../common/UserLabel";
import CommentRichEditor from "./CommentRichEditor";
import CommentContent from "./CommentContent";
import {isCommentContentEmpty, truncateCommentText} from "./commentContentUtils";

const {Text} = Typography;
const maxCommentLength = 1000;
const pageSize = 10;

function getCommentId(comment) {
  return `${comment.owner}/${comment.name}`;
}

function getCommentAnchorId(comment) {
  return `comment-${comment.owner}-${comment.name}`;
}

function getCommentTime(time) {
  const formattedTime = Setting.getFormattedDate(time);
  if (!formattedTime) {
    return "";
  }
  return formattedTime.split(".")[0].trim();
}

function canDeleteComment(account, comment, targetOwner) {
  if (!account || !comment) {
    return false;
  }
  return account.name === comment.owner || account.name === targetOwner || Setting.isAdminUser(account);
}

function canEditComment(account, comment) {
  if (!account || !comment) {
    return false;
  }
  return account.name === comment.owner || Setting.isAdminUser(account);
}

function renderEditor({value, onChange, onSubmit, onCancel, submitting, placeholder, submitText, uploadImage}) {
  return (
    <CommentRichEditor
      value={value}
      maxTextLength={maxCommentLength}
      placeholder={placeholder}
      submitting={submitting}
      submitText={submitText}
      onChange={onChange}
      onSubmit={onSubmit}
      onCancel={onCancel}
      uploadImage={uploadImage}
    />
  );
}

function CommentActions({account, comment, targetOwner, onOpenReply, onOpenEdit, onDelete}) {
  const canComment = account && !Setting.isAnonymousUser(account);

  return (
    <Space size={12}>
      {canComment ? (
        <Button type="link" size="small" style={{padding: 0}} onClick={() => onOpenReply(comment)}>
          {i18next.t("store:Reply")}
        </Button>
      ) : null}
      {canEditComment(account, comment) ? (
        <Button type="link" size="small" icon={<EditOutlined />} style={{padding: 0}} onClick={() => onOpenEdit(comment)}>
          {i18next.t("general:Edit")}
        </Button>
      ) : null}
      {canDeleteComment(account, comment, targetOwner) ? (
        <Button type="link" danger size="small" icon={<DeleteOutlined />} style={{padding: 0}} onClick={() => onDelete(comment)}>
          {i18next.t("general:Delete")}
        </Button>
      ) : null}
    </Space>
  );
}

function ReplyQuote({parentComment}) {
  if (!parentComment) {
    return null;
  }

  return (
    <div style={{margin: "6px 0 4px"}}>
      <Text
        type="secondary"
        style={{
          display: "inline-block",
          maxWidth: "min(360px, 100%)",
          paddingRight: 8,
          borderRight: "2px solid var(--ant-color-border)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          verticalAlign: "bottom",
        }}
      >
        : {truncateCommentText(parentComment.content, 10)}
      </Text>
    </div>
  );
}

function InlineCommentEditor({value, onChange, onSubmit, onCancel, submitting, placeholder, uploadImage}) {
  return renderEditor({
    value,
    onChange,
    onSubmit,
    onCancel,
    submitting,
    placeholder,
    submitText: i18next.t("general:Save"),
    uploadImage,
  });
}

function ReplyItem({
  account,
  reply,
  parentComment,
  targetOwner,
  replyTo,
  replyValue,
  replySubmitting,
  replyToOwner,
  editingCommentId,
  editingValue,
  editingSubmitting,
  uploadImage,
  onOpenReply,
  onChangeReply,
  onSubmitReply,
  onCancelReply,
  onOpenEdit,
  onChangeEdit,
  onSubmitEdit,
  onCancelEdit,
  onDelete,
  highlightedCommentId,
}) {
  const replyId = getCommentId(reply);
  const isReplying = replyTo === replyId;
  const isEditing = editingCommentId === replyId;
  const isHighlighted = highlightedCommentId === getCommentAnchorId(reply);

  return (
    <div
      id={getCommentAnchorId(reply)}
      style={{
        padding: "10px 0",
        borderBottom: "1px solid var(--ant-color-border-secondary)",
        background: isHighlighted ? "var(--ant-color-fill-secondary)" : "transparent",
        transition: "background 0.3s",
      }}
    >
      <div style={{display: "flex", gap: 10, alignItems: "flex-start"}}>
        <UserLabel user={reply.owner} account={account} size={28} avatarOnly />
        <div style={{flex: 1, minWidth: 0}}>
          <Space size={8} wrap>
            <UserLabel user={reply.owner} account={account} showAvatar={false} strong />
            <Text type="secondary" style={{fontSize: 12}}>{getCommentTime(reply.createdTime)}</Text>
          </Space>
          <ReplyQuote parentComment={parentComment} />
          {isEditing ? (
            <div style={{margin: "6px 0 8px"}}>
              <InlineCommentEditor
                value={editingValue}
                onChange={onChangeEdit}
                onSubmit={() => onSubmitEdit(reply)}
                onCancel={onCancelEdit}
                submitting={editingSubmitting}
                placeholder={i18next.t("store:Write a comment")}
                uploadImage={uploadImage}
              />
            </div>
          ) : (
            <CommentContent content={reply.content} />
          )}
          <CommentActions account={account} comment={reply} targetOwner={targetOwner} onOpenReply={onOpenReply} onOpenEdit={onOpenEdit} onDelete={onDelete} />
          {isReplying ? (
            <div style={{marginTop: 10}}>
              {renderEditor({
                value: replyValue,
                onChange: onChangeReply,
                onSubmit: onSubmitReply,
                onCancel: onCancelReply,
                submitting: replySubmitting,
                placeholder: `${i18next.t("message:Reply to")} @${replyToOwner}`,
                submitText: i18next.t("store:Reply"),
                uploadImage,
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RootCommentItem({
  account,
  comment,
  targetOwner,
  replyTo,
  replyValue,
  replySubmitting,
  replyToOwner,
  editingCommentId,
  editingValue,
  editingSubmitting,
  uploadImage,
  onOpenReply,
  onChangeReply,
  onSubmitReply,
  onCancelReply,
  onOpenEdit,
  onChangeEdit,
  onSubmitEdit,
  onCancelEdit,
  onDelete,
  highlightedCommentId,
}) {
  const commentId = getCommentId(comment);
  const isReplying = replyTo === commentId;
  const isEditing = editingCommentId === commentId;
  const isHighlighted = highlightedCommentId === getCommentAnchorId(comment);
  const replyMap = new Map((comment.replies || []).map(reply => [getCommentId(reply), reply]));

  return (
    <div
      id={getCommentAnchorId(comment)}
      style={{
        padding: "14px 0",
        borderBottom: "1px solid var(--ant-color-border-secondary)",
        background: isHighlighted ? "var(--ant-color-fill-secondary)" : "transparent",
        transition: "background 0.3s",
      }}
    >
      <div style={{display: "flex", gap: 12, alignItems: "flex-start"}}>
        <UserLabel user={comment.owner} account={account} size={32} avatarOnly />
        <div style={{flex: 1, minWidth: 0}}>
          <Space size={8} wrap>
            <UserLabel user={comment.owner} account={account} showAvatar={false} strong />
            <Text type="secondary" style={{fontSize: 12}}>{getCommentTime(comment.createdTime)}</Text>
          </Space>
          {isEditing ? (
            <div style={{margin: "6px 0 8px"}}>
              <InlineCommentEditor
                value={editingValue}
                onChange={onChangeEdit}
                onSubmit={() => onSubmitEdit(comment)}
                onCancel={onCancelEdit}
                submitting={editingSubmitting}
                placeholder={i18next.t("store:Write a comment")}
                uploadImage={uploadImage}
              />
            </div>
          ) : (
            <CommentContent content={comment.content} />
          )}
          <CommentActions account={account} comment={comment} targetOwner={targetOwner} onOpenReply={onOpenReply} onOpenEdit={onOpenEdit} onDelete={onDelete} />
          {isReplying ? (
            <div style={{marginTop: 10}}>
              {renderEditor({
                value: replyValue,
                onChange: onChangeReply,
                onSubmit: onSubmitReply,
                onCancel: onCancelReply,
                submitting: replySubmitting,
                placeholder: `${i18next.t("message:Reply to")} @${replyToOwner}`,
                submitText: i18next.t("store:Reply"),
                uploadImage,
              })}
            </div>
          ) : null}
          {comment.replies && comment.replies.length > 0 ? (
            <div style={{marginTop: 12, padding: "0 12px", borderLeft: "2px solid var(--ant-color-border-secondary)", backgroundColor: "var(--ant-color-fill-quaternary)"}}>
              {comment.replies.map(reply => (
                <ReplyItem
                  key={getCommentId(reply)}
                  account={account}
                  reply={reply}
                  parentComment={reply.parentOwner === comment.owner && reply.parentName === comment.name ? null : replyMap.get(`${reply.parentOwner}/${reply.parentName}`)}
                  targetOwner={targetOwner}
                  replyTo={replyTo}
                  replyValue={replyValue}
                  replySubmitting={replySubmitting}
                  replyToOwner={replyToOwner}
                  editingCommentId={editingCommentId}
                  editingValue={editingValue}
                  editingSubmitting={editingSubmitting}
                  uploadImage={uploadImage}
                  onOpenReply={onOpenReply}
                  onChangeReply={onChangeReply}
                  onSubmitReply={onSubmitReply}
                  onCancelReply={onCancelReply}
                  onOpenEdit={onOpenEdit}
                  onChangeEdit={onChangeEdit}
                  onSubmitEdit={onSubmitEdit}
                  onCancelEdit={onCancelEdit}
                  onDelete={onDelete}
                  highlightedCommentId={highlightedCommentId}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CommentArea({account, targetType, targetKey, targetOwner, disabled = false, unavailableText = ""}) {
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [replyToOwner, setReplyToOwner] = useState("");
  const [replyToParentOwner, setReplyToParentOwner] = useState("");
  const [replyToParentName, setReplyToParentName] = useState("");
  const [replyValue, setReplyValue] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingValue, setEditingValue] = useState("");
  const [editingSubmitting, setEditingSubmitting] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState("");
  const canComment = account && !Setting.isAnonymousUser(account);

  const loadComments = useCallback((nextPage) => {
    if (disabled || !targetType || !targetKey) {
      return;
    }
    setLoading(true);
    CommentBackend.getComments(targetType, targetKey, nextPage, pageSize)
      .then(res => {
        if (res.status === "ok") {
          setComments(res.data || []);
          setTotal(res.data2 || 0);
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${error}`);
      })
      .finally(() => setLoading(false));
  }, [disabled, targetKey, targetType]);

  useEffect(() => {
    setPage(1);
    setReplyTo("");
    setReplyToOwner("");
    setReplyValue("");
    setEditingCommentId("");
    setEditingValue("");
    loadComments(1);
  }, [loadComments]);

  useEffect(() => {
    if (loading || comments.length === 0 || !window.location.hash.startsWith("#comment-")) {
      return undefined;
    }
    const anchorId = decodeURIComponent(window.location.hash.slice(1));
    const element = document.getElementById(anchorId);
    if (!element) {
      return undefined;
    }
    element.scrollIntoView({behavior: "smooth", block: "center"});
    setHighlightedCommentId(anchorId);
    const timer = window.setTimeout(() => setHighlightedCommentId(""), 2400);
    return () => window.clearTimeout(timer);
  }, [comments, loading]);

  const uploadImage = file => {
    return ResourceBackend.uploadResource(account?.name || "", "chat", "comment", targetKey, file);
  };

  const closeReply = () => {
    setReplyTo("");
    setReplyToOwner("");
    setReplyToParentOwner("");
    setReplyToParentName("");
    setReplyValue("");
  };

  const closeEdit = () => {
    setEditingCommentId("");
    setEditingValue("");
  };

  const submitComment = () => {
    if (isCommentContentEmpty(content)) {
      return;
    }
    const trimmedContent = content.trim();
    setSubmitting(true);
    CommentBackend.addComment({targetType, targetKey, content: trimmedContent})
      .then(res => {
        if (res.status === "ok") {
          setContent("");
          setPage(1);
          loadComments(1);
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${error}`);
      })
      .finally(() => setSubmitting(false));
  };

  const openReply = comment => {
    closeEdit();
    setReplyTo(getCommentId(comment));
    setReplyToOwner(comment.owner);
    setReplyToParentOwner(comment.owner);
    setReplyToParentName(comment.name);
    setReplyValue("");
  };

  const submitReply = () => {
    if (isCommentContentEmpty(replyValue) || replyTo === "") {
      return;
    }
    const trimmedContent = replyValue.trim();
    setReplySubmitting(true);
    CommentBackend.addComment({targetType, targetKey, parentOwner: replyToParentOwner, parentName: replyToParentName, content: trimmedContent})
      .then(res => {
        if (res.status === "ok") {
          closeReply();
          loadComments(page);
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${error}`);
      })
      .finally(() => setReplySubmitting(false));
  };

  const openEdit = comment => {
    closeReply();
    setEditingCommentId(getCommentId(comment));
    setEditingValue(comment.content || "");
  };

  const submitEdit = comment => {
    if (isCommentContentEmpty(editingValue)) {
      return;
    }
    setEditingSubmitting(true);
    CommentBackend.updateComment(comment.owner, comment.name, {...comment, content: editingValue.trim()})
      .then(res => {
        if (res.status === "ok") {
          closeEdit();
          loadComments(page);
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${error}`);
      })
      .finally(() => setEditingSubmitting(false));
  };

  const deleteComment = comment => {
    Modal.confirm({
      title: i18next.t("general:Sure to delete?"),
      onOk: () => {
        CommentBackend.deleteComment(comment.owner, comment.name)
          .then(res => {
            if (res.status === "ok") {
              const deletingRootComment = comment.parentOwner === "" && comment.parentName === "";
              const nextPage = deletingRootComment && comments.length === 1 && page > 1 ? page - 1 : page;
              closeReply();
              closeEdit();
              setPage(nextPage);
              loadComments(nextPage);
            } else {
              Setting.showMessage("error", `${i18next.t("general:Failed to delete")}: ${res.msg}`);
            }
          })
          .catch(error => {
            Setting.showMessage("error", `${i18next.t("general:Failed to delete")}: ${error}`);
          });
      },
    });
  };

  return (
    <Card
      title={
        <div style={{display: "flex", alignItems: "center", gap: 8}}>
          <CommentOutlined />
          <span>{i18next.t("general:Comments")}</span>
        </div>
      }
      styles={{body: {padding: "20px 24px"}}}
    >
      {disabled ? (
        <Empty description={unavailableText || i18next.t("store:Comments are unavailable")} />
      ) : (
        <div style={{display: "grid", gap: 18}}>
          {canComment ? renderEditor({
            value: content,
            onChange: setContent,
            onSubmit: submitComment,
            submitting,
            placeholder: i18next.t("store:Write a comment"),
            submitText: i18next.t("store:Add comment"),
            uploadImage,
          }) : (
            <Text type="secondary">{i18next.t("store:Sign in to comment")}</Text>
          )}
          <List
            loading={loading}
            dataSource={comments}
            locale={{emptyText: <Empty description={i18next.t("store:No comments yet")} />}}
            renderItem={comment => (
              <RootCommentItem
                key={getCommentId(comment)}
                account={account}
                comment={comment}
                targetOwner={targetOwner}
                replyTo={replyTo}
                replyValue={replyValue}
                replySubmitting={replySubmitting}
                replyToOwner={replyToOwner}
                editingCommentId={editingCommentId}
                editingValue={editingValue}
                editingSubmitting={editingSubmitting}
                uploadImage={uploadImage}
                onOpenReply={openReply}
                onChangeReply={setReplyValue}
                onSubmitReply={submitReply}
                onCancelReply={closeReply}
                onOpenEdit={openEdit}
                onChangeEdit={setEditingValue}
                onSubmitEdit={submitEdit}
                onCancelEdit={closeEdit}
                onDelete={deleteComment}
                highlightedCommentId={highlightedCommentId}
              />
            )}
          />
          {total > pageSize ? (
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger={false}
              onChange={nextPage => {
                closeReply();
                closeEdit();
                setPage(nextPage);
                loadComments(nextPage);
              }}
              style={{textAlign: "right"}}
            />
          ) : null}
        </div>
      )}
    </Card>
  );
}

export default CommentArea;
