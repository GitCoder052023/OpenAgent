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

import * as React from "react";
import i18next from "i18next";
import {ChevronLeft, ChevronRight, MessageSquare, Pencil, Trash2} from "lucide-react";
import * as CommentBackend from "@/backend/CommentBackend";
import * as ResourceBackend from "@/backend/ResourceBackend";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Loading} from "@/components/common/Loading";
import {ConfirmButton} from "@/components/common/ConfirmButton";
import {UserLabel} from "@/components/common/UserLabel";
import {CommentContent} from "@/components/comment/CommentContent";
import {CommentRichEditor} from "@/components/comment/CommentRichEditor";
import {isCommentContentEmpty, truncateCommentText} from "@/lib/comment-content";
import * as Setting from "@/lib/setting";
import {cn} from "@/lib/utils";

const MaxCommentLength = 1000;
const PageSize = 10;

function commentId(comment: any) {
  return `${comment.owner}/${comment.name}`;
}

function anchorId(comment: any) {
  return `comment-${comment.owner}-${comment.name}`;
}

function commentTime(time: string) {
  return (Setting.getFormattedDate(time) || "").split(".")[0].trim();
}

interface Editing {
  /** the comment being replied to or edited, as owner/name */
  id: string;
  kind: "reply" | "edit";
  value: string;
  submitting: boolean;
  /** for a reply: whose comment it answers */
  parent?: any;
}

interface ItemContext {
  account: any;
  targetOwner: string;
  editing: Editing | null;
  highlighted: string;
  uploadImage: (file: File) => Promise<any>;
  openReply: (comment: any) => void;
  openEdit: (comment: any) => void;
  setValue: (value: string) => void;
  submit: () => void;
  cancel: () => void;
  remove: (comment: any) => Promise<void>;
}

function CommentItem({comment, quoted, isReply, ctx}: {comment: any; quoted?: any; isReply?: boolean; ctx: ItemContext}) {
  const {account, editing} = ctx;
  const id = commentId(comment);
  const isAdmin = Setting.isAdminUser(account);
  const canReply = account && !Setting.isAnonymousUser(account);
  const canEdit = account && (account.name === comment.owner || isAdmin);
  const canDelete = account && (account.name === comment.owner || account.name === ctx.targetOwner || isAdmin);
  const editingThis = editing?.id === id && editing.kind === "edit";
  const replyingThis = editing?.id === id && editing.kind === "reply";
  const replies: any[] = comment.replies ?? [];
  const replyMap = new Map(replies.map((reply) => [commentId(reply), reply]));

  const editor = (placeholder: string, submitText: string) => (
    <CommentRichEditor
      value={editing?.value ?? ""}
      maxTextLength={MaxCommentLength}
      placeholder={placeholder}
      submitting={editing?.submitting}
      submitText={submitText}
      onChange={ctx.setValue}
      onSubmit={ctx.submit}
      onCancel={ctx.cancel}
      uploadImage={ctx.uploadImage}
    />
  );

  return (
    <div
      id={anchorId(comment)}
      className={cn("border-b transition-colors duration-300 last:border-b-0", isReply ? "py-2.5" : "py-3.5", ctx.highlighted === anchorId(comment) && "bg-muted")}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <UserLabel user={comment.owner} className="font-medium" />
        <span className="text-xs text-muted-foreground">{commentTime(comment.createdTime)}</span>
      </div>
      {quoted ? (
        <div className="mt-1.5 max-w-[360px] truncate border-r-2 pr-2 text-sm text-muted-foreground">
          : {truncateCommentText(quoted.content, 10)}
        </div>
      ) : null}
      {editingThis ? (
        <div className="my-2">{editor(i18next.t("store:Write a comment"), i18next.t("general:Save"))}</div>
      ) : (
        <CommentContent content={comment.content} />
      )}
      <div className="flex items-center gap-1">
        {canReply ? (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => ctx.openReply(comment)}>{i18next.t("store:Reply")}</Button>
        ) : null}
        {canEdit ? (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => ctx.openEdit(comment)}><Pencil />{i18next.t("general:Edit")}</Button>
        ) : null}
        {canDelete ? (
          <ConfirmButton variant="destructiveGhost" size="sm" className="h-7 px-2" onConfirm={() => ctx.remove(comment)}>
            <Trash2 />{i18next.t("general:Delete")}
          </ConfirmButton>
        ) : null}
      </div>
      {replyingThis ? (
        <div className="mt-2.5">{editor(`${i18next.t("message:Reply to")} @${comment.owner}`, i18next.t("store:Reply"))}</div>
      ) : null}
      {replies.length > 0 ? (
        <div className="mt-3 border-l-2 bg-muted/40 px-3">
          {replies.map((reply) => {
            // a reply to the root needs no quote; a reply to a reply shows what it answers
            const answersRoot = reply.parentOwner === comment.owner && reply.parentName === comment.name;
            return (
              <CommentItem
                key={commentId(reply)}
                comment={reply}
                quoted={answersRoot ? null : replyMap.get(`${reply.parentOwner}/${reply.parentName}`)}
                isReply
                ctx={ctx}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

interface CommentAreaProps {
  account: any;
  targetType: string;
  targetKey: string;
  /** the owner of what is commented on, who may delete any comment on it */
  targetOwner: string;
  disabled?: boolean;
  unavailableText?: string;
}

/** The comments under an agent or an issue: post, reply, edit and delete, ten roots a page. */
export function CommentArea({account, targetType, targetKey, targetOwner, disabled = false, unavailableText = ""}: CommentAreaProps) {
  const [comments, setComments] = React.useState<any[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [content, setContent] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [highlighted, setHighlighted] = React.useState("");
  const canComment = account && !Setting.isAnonymousUser(account);

  const load = React.useCallback((nextPage: number) => {
    if (disabled || !targetType || !targetKey) {
      return;
    }
    setLoading(true);
    CommentBackend.getComments(targetType, targetKey, nextPage, PageSize).then((res: any) => {
      if (res.status === "ok") {
        setComments(res.data ?? []);
        setTotal(res.data2 ?? 0);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    }).catch((error: any) => {
      Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${error}`);
    }).finally(() => setLoading(false));
  }, [disabled, targetKey, targetType]);

  React.useEffect(() => {
    setPage(1);
    setEditing(null);
    load(1);
  }, [load]);

  // a notification links to #comment-<owner>-<name>: scroll to it and flash it
  React.useEffect(() => {
    if (loading || comments.length === 0 || !window.location.hash.startsWith("#comment-")) {
      return undefined;
    }
    const id = decodeURIComponent(window.location.hash.slice(1));
    const element = document.getElementById(id);
    if (!element) {
      return undefined;
    }
    element.scrollIntoView({behavior: "smooth", block: "center"});
    setHighlighted(id);
    const timer = window.setTimeout(() => setHighlighted(""), 2400);
    return () => window.clearTimeout(timer);
  }, [comments, loading]);

  const uploadImage = (file: File) => ResourceBackend.uploadResource(account?.name || "", "chat", "comment", targetKey, file);

  const goTo = (nextPage: number) => {
    setEditing(null);
    setPage(nextPage);
    load(nextPage);
  };

  const submitComment = async() => {
    if (isCommentContentEmpty(content)) {
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await CommentBackend.addComment({targetType, targetKey, content: content.trim()});
      if (res.status === "ok") {
        setContent("");
        goTo(1);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${error}`);
    } finally {
      setSubmitting(false);
    }
  };

  const submitEditing = async() => {
    if (!editing || isCommentContentEmpty(editing.value)) {
      return;
    }
    const failKey = editing.kind === "reply" ? "general:Failed to add" : "general:Failed to save";
    setEditing({...editing, submitting: true});
    try {
      const res: any = editing.kind === "reply"
        ? await CommentBackend.addComment({targetType, targetKey, parentOwner: editing.parent.owner, parentName: editing.parent.name, content: editing.value.trim()})
        : await CommentBackend.updateComment(editing.parent.owner, editing.parent.name, {...editing.parent, content: editing.value.trim()});
      if (res.status === "ok") {
        setEditing(null);
        load(page);
        return;
      }
      Setting.showMessage("error", `${i18next.t(failKey)}: ${res.msg}`);
    } catch (error) {
      Setting.showMessage("error", `${i18next.t(failKey)}: ${error}`);
    }
    setEditing((prev) => (prev ? {...prev, submitting: false} : prev));
  };

  const remove = async(comment: any) => {
    const res: any = await CommentBackend.deleteComment(comment.owner, comment.name);
    if (res.status !== "ok") {
      Setting.showMessage("error", `${i18next.t("general:Failed to delete")}: ${res.msg}`);
      return;
    }
    // deleting the last root on a page steps back a page
    const isRoot = !comment.parentOwner && !comment.parentName;
    goTo(isRoot && comments.length === 1 && page > 1 ? page - 1 : page);
  };

  const ctx: ItemContext = {
    account,
    targetOwner,
    editing,
    highlighted,
    uploadImage,
    openReply: (comment) => setEditing({id: commentId(comment), kind: "reply", value: "", submitting: false, parent: comment}),
    openEdit: (comment) => setEditing({id: commentId(comment), kind: "edit", value: comment.content || "", submitting: false, parent: comment}),
    setValue: (value) => setEditing((prev) => (prev ? {...prev, value} : prev)),
    submit: submitEditing,
    cancel: () => setEditing(null),
    remove,
  };

  const pageCount = Math.ceil(total / PageSize);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4" />{i18next.t("general:Comments")}</CardTitle>
      </CardHeader>
      <CardContent>
        {disabled ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{unavailableText || i18next.t("store:Comments are unavailable")}</p>
        ) : (
          <div className="space-y-4">
            {canComment ? (
              <CommentRichEditor
                value={content}
                maxTextLength={MaxCommentLength}
                placeholder={i18next.t("store:Write a comment")}
                submitting={submitting}
                submitText={i18next.t("store:Add comment")}
                onChange={setContent}
                onSubmit={submitComment}
                uploadImage={uploadImage}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{i18next.t("store:Sign in to comment")}</p>
            )}
            {loading && comments.length === 0 ? <Loading /> : comments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{i18next.t("store:No comments yet")}</p>
            ) : (
              <div className={cn(loading && "opacity-60")}>
                {comments.map((comment) => <CommentItem key={commentId(comment)} comment={comment} ctx={ctx} />)}
              </div>
            )}
            {pageCount > 1 ? (
              <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                <Button variant="outline" size="iconSm" disabled={page <= 1} aria-label={i18next.t("general:Previous")} onClick={() => goTo(page - 1)}><ChevronLeft /></Button>
                <span className="tabular-nums">{page} / {pageCount}</span>
                <Button variant="outline" size="iconSm" disabled={page >= pageCount} aria-label={i18next.t("general:Next")} onClick={() => goTo(page + 1)}><ChevronRight /></Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CommentArea;
