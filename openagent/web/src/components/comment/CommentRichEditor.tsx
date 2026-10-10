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
import {ImagePlus, MessageSquare, Smile, X} from "lucide-react";
import {EditorContent, useEditor, type Editor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import FileHandler from "@tiptap/extension-file-handler";
import Placeholder from "@tiptap/extension-placeholder";
import {Button} from "@/components/ui/button";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {Loading} from "@/components/common/Loading";
import {useTheme} from "@/hooks/use-theme";
import {getCommentTextLength, isCommentContentEmpty, sanitizeCommentHtml} from "@/lib/comment-content";
import * as Setting from "@/lib/setting";
import {cn} from "@/lib/utils";

const allowedImageTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];

// the picker carries every emoji's data, so it is fetched the first time it opens
const EmojiPicker = React.lazy(() => import("emoji-picker-react"));

function getImageUrlFromResponse(res: any) {
  if (typeof res === "string") {
    return res;
  }
  if (res && res.status === "ok") {
    return res.data || res.fileUrl || "";
  }
  return "";
}

export interface CommentRichEditorProps {
  value: string;
  placeholder?: string;
  maxTextLength?: number;
  submitting?: boolean;
  submitText?: React.ReactNode;
  onChange?: (value: string) => void;
  /** shows the submit button; the edit page saves through its own Save instead */
  onSubmit?: () => void;
  onCancel?: () => void;
  /** uploads a pasted, dropped or picked image and resolves to its URL (or an API response holding it) */
  uploadImage?: (file: File) => Promise<any>;
  className?: string;
}

/** The comment box: paragraphs, lists, links, images and emoji, saved as sanitized HTML. */
export function CommentRichEditor({
  value,
  placeholder,
  maxTextLength = 1000,
  submitting = false,
  submitText,
  onChange,
  onSubmit,
  onCancel,
  uploadImage,
  className,
}: CommentRichEditorProps) {
  const {resolvedTheme} = useTheme();
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const uploadRef = React.useRef(uploadImage);
  uploadRef.current = uploadImage;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const insertImages = async(editor: Editor, files: File[], pos?: number) => {
    const images = files.filter((file) => allowedImageTypes.includes(file.type));
    if (images.length !== files.length) {
      Setting.showMessage("error", i18next.t("comment:Only image files are supported"));
    }
    if (images.length === 0 || !uploadRef.current) {
      return;
    }

    setUploading(true);
    try {
      for (const file of images) {
        const url = getImageUrlFromResponse(await uploadRef.current(file));
        if (!url) {
          Setting.showMessage("error", i18next.t("general:Failed to upload"));
          continue;
        }
        const chain = editor.chain().focus();
        (typeof pos === "number" ? chain.setTextSelection(pos) : chain).setImage({src: url, alt: file.name}).run();
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
      Image.configure({inline: false, allowBase64: false}),
      FileHandler.configure({
        allowedMimeTypes: allowedImageTypes,
        onPaste: (currentEditor, files) => insertImages(currentEditor, files),
        onDrop: (currentEditor, files, pos) => insertImages(currentEditor, files, pos),
      }),
      Placeholder.configure({placeholder}),
    ],
    content: sanitizeCommentHtml(value),
    onUpdate: ({editor: currentEditor}) => onChangeRef.current?.(sanitizeCommentHtml(currentEditor.getHTML())),
    editorProps: {
      attributes: {"aria-label": placeholder || i18next.t("general:Content")},
    },
  });

  // a value set from outside (cleared after submit, loaded later) replaces the content
  React.useEffect(() => {
    if (!editor) {
      return;
    }
    const next = sanitizeCommentHtml(value);
    if (next !== editor.getHTML()) {
      editor.commands.setContent(next, {emitUpdate: false});
    }
  }, [editor, value]);

  const textLength = getCommentTextLength(value);
  const disabled = isCommentContentEmpty(value) || textLength > maxTextLength || uploading || submitting;

  return (
    <div className={cn("overflow-hidden rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring", className)}>
      <EditorContent editor={editor} className="comment-editor px-3 py-2" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/40 px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="iconSm" aria-label={i18next.t("general:Emoji")} onMouseDown={(e) => e.preventDefault()}>
                    <Smile />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>{i18next.t("general:Emoji")}</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-auto p-0">
              <React.Suspense fallback={<div className="flex h-[360px] w-[320px] items-center justify-center"><Loading /></div>}>
                <EmojiPicker
                  width={320}
                  height={360}
                  theme={(resolvedTheme === "dark" ? "dark" : "light") as any}
                  autoFocusSearch={false}
                  previewConfig={{showPreview: false}}
                  onEmojiClick={(emojiData) => {
                    editor?.chain().focus(null, {scrollIntoView: false}).insertContent(emojiData.emoji).run();
                    setEmojiOpen(false);
                  }}
                />
              </React.Suspense>
            </PopoverContent>
          </Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                aria-label={i18next.t("general:Image")}
                loading={uploading}
                disabled={!uploadImage}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{i18next.t("general:Image")}</TooltipContent>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept={allowedImageTypes.join(",")}
            multiple
            className="hidden"
            onChange={(e) => {
              if (editor) {
                insertImages(editor, Array.from(e.target.files || []));
              }
              e.target.value = "";
            }}
          />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className={cn("text-xs tabular-nums", textLength > maxTextLength ? "text-destructive" : "text-muted-foreground")}>
            {textLength} / {maxTextLength}
          </span>
          {onCancel ? (
            <Button variant="outline" size="sm" onClick={onCancel}>
              <X />
              {i18next.t("general:Cancel")}
            </Button>
          ) : null}
          {onSubmit ? (
            <Button size="sm" disabled={disabled} loading={submitting || uploading} onClick={onSubmit}>
              <MessageSquare />
              {submitText || i18next.t("store:Add comment")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default CommentRichEditor;
