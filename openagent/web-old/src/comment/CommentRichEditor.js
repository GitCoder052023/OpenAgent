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

import React, {useEffect, useRef, useState} from "react";
import {Button, Popover, Space, Tooltip, Typography} from "antd";
import {CloseOutlined, CommentOutlined, PictureOutlined, SmileOutlined} from "@ant-design/icons";
import {EditorContent, useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import FileHandler from "@tiptap/extension-file-handler";
import Placeholder from "@tiptap/extension-placeholder";
import EmojiPicker from "emoji-picker-react";
import i18next from "i18next";
import * as Setting from "../Setting";
import {getCommentTextLength, isCommentContentEmpty, sanitizeCommentHtml} from "./commentContentUtils";
import "./CommentRichEditor.css";

const {Text} = Typography;
const allowedImageTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function getEditorContent(value) {
  return sanitizeCommentHtml(value || "");
}

function getImageUrlFromResponse(res) {
  if (typeof res === "string") {
    return res;
  }
  if (res && res.status === "ok") {
    return res.data || res.fileUrl || "";
  }
  return "";
}

function CommentRichEditor({
  value,
  placeholder,
  maxTextLength = 1000,
  submitting = false,
  submitText,
  onChange,
  onSubmit,
  onCancel,
  uploadImage,
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const scrollPositionRef = useRef({x: 0, y: 0});
  const latestUploadImage = useRef(uploadImage);

  useEffect(() => {
    latestUploadImage.current = uploadImage;
  }, [uploadImage]);

  const insertImages = async(editor, files, pos) => {
    const images = files.filter(file => allowedImageTypes.includes(file.type));
    if (images.length !== files.length) {
      Setting.showMessage("error", i18next.t("comment:Only image files are supported"));
    }
    if (images.length === 0 || !latestUploadImage.current) {
      return;
    }

    setUploading(true);
    try {
      for (const file of images) {
        const result = await latestUploadImage.current(file);
        const fileUrl = getImageUrlFromResponse(result);
        if (!fileUrl) {
          Setting.showMessage("error", i18next.t("general:Failed to upload"));
          continue;
        }
        if (typeof pos === "number") {
          editor.chain().focus().setTextSelection(pos).setImage({src: fileUrl, alt: file.name}).run();
        } else {
          editor.chain().focus().setImage({src: fileUrl, alt: file.name}).run();
        }
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to upload")}: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: false,
        heading: false,
        italic: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      FileHandler.configure({
        allowedMimeTypes: allowedImageTypes,
        onPaste: (currentEditor, files) => insertImages(currentEditor, files),
        onDrop: (currentEditor, files, pos) => insertImages(currentEditor, files, pos),
      }),
      Placeholder.configure({placeholder}),
    ],
    content: getEditorContent(value),
    onUpdate: ({editor: currentEditor}) => {
      onChange?.(sanitizeCommentHtml(currentEditor.getHTML()));
    },
    editorProps: {
      attributes: {
        "aria-label": placeholder || i18next.t("general:Content"),
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const nextContent = getEditorContent(value);
    if (nextContent !== editor.getHTML()) {
      editor.commands.setContent(nextContent, false);
    }
  }, [editor, value]);

  const textLength = getCommentTextLength(value);
  const disabled = isCommentContentEmpty(value) || textLength > maxTextLength || uploading || submitting;

  const rememberScrollPosition = () => {
    scrollPositionRef.current = {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0,
    };
  };

  const restoreScrollPosition = () => {
    const {x, y} = scrollPositionRef.current;
    requestAnimationFrame(() => {
      window.scrollTo(x, y);
      requestAnimationFrame(() => window.scrollTo(x, y));
    });
  };

  const handleEmojiOpenChange = open => {
    rememberScrollPosition();
    setEmojiOpen(open);
    restoreScrollPosition();
  };

  return (
    <div>
      <div className="comment-rich-editor-shell">
        <EditorContent editor={editor} className="comment-rich-editor-content" />
        <div className="comment-rich-editor-toolbar">
          <div className="comment-rich-editor-tools">
            <Popover
              open={emojiOpen}
              onOpenChange={handleEmojiOpenChange}
              trigger="click"
              placement="bottomLeft"
              content={
                <EmojiPicker
                  width={320}
                  height={360}
                  autoFocusSearch={false}
                  previewConfig={{showPreview: false}}
                  onEmojiClick={(emojiData) => {
                    rememberScrollPosition();
                    editor?.chain().focus(null, {scrollIntoView: false}).insertContent(emojiData.emoji).run();
                    setEmojiOpen(false);
                    restoreScrollPosition();
                  }}
                />
              }
            >
              <Tooltip title={i18next.t("general:Emoji")}>
                <Button type="text" size="small" icon={<SmileOutlined />} onMouseDown={e => e.preventDefault()} />
              </Tooltip>
            </Popover>
            <Tooltip title={i18next.t("general:Image")}>
              <Button type="text" size="small" icon={<PictureOutlined />} loading={uploading} onClick={() => fileInputRef.current?.click()} />
            </Tooltip>
            <input
              ref={fileInputRef}
              type="file"
              accept={allowedImageTypes.join(",")}
              multiple
              style={{display: "none"}}
              onChange={e => {
                insertImages(editor, Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
          </div>
          <div className="comment-rich-editor-actions">
            <Text type={textLength > maxTextLength ? "danger" : "secondary"}>{textLength} / {maxTextLength}</Text>
            <Space size={8}>
              {onCancel ? (
                <Button size="small" icon={<CloseOutlined />} onClick={onCancel}>
                  {i18next.t("general:Cancel")}
                </Button>
              ) : null}
              {onSubmit ? (
                <Button type="primary" size="small" icon={<CommentOutlined />} disabled={disabled} loading={submitting || uploading} onClick={onSubmit}>
                  {submitText || i18next.t("store:Add comment")}
                </Button>
              ) : null}
            </Space>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommentRichEditor;
