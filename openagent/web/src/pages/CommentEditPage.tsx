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

import i18next from "i18next";
import {useParams} from "react-router-dom";
import * as CommentBackend from "@/backend/CommentBackend";
import * as ResourceBackend from "@/backend/ResourceBackend";
import {Input} from "@/components/ui/input";
import {CommentRichEditor} from "@/components/comment/CommentRichEditor";
import {SimpleEditPage, type EditField} from "@/components/crud/SimpleEditPage";
import {useAccount} from "@/hooks/use-account";
import * as Setting from "@/lib/setting";

/** Everything but the body is decided by where and when the comment was posted. */
function lockedField(name: string, labelKey: string): EditField {
  return {type: "text", name, labelKey, disabled: () => true};
}

function lockedDate(name: string, labelKey: string): EditField {
  return {
    type: "custom",
    name,
    labelKey,
    render: (ctx) => <Input disabled value={Setting.getFormattedDate(ctx.record[name]) ?? ""} />,
  };
}

export default function CommentEditPage() {
  const {commentOwner = "", commentName = ""} = useParams();
  const {account} = useAccount();

  const fields: EditField[] = [
    lockedField("owner", "general:Owner"),
    lockedField("name", "general:Name"),
    lockedDate("createdTime", "general:Created time"),
    lockedDate("updatedTime", "general:Updated time"),
    lockedField("targetType", "comment:Target type"),
    lockedField("targetKey", "comment:Target key"),
    lockedField("parentOwner", "comment:Parent owner"),
    lockedField("parentName", "comment:Parent name"),
    lockedField("rootOwner", "comment:Root owner"),
    lockedField("rootName", "comment:Root name"),
    {
      type: "custom",
      name: "content",
      labelKey: "general:Content",
      block: true,
      render: (ctx, update) => (
        <CommentRichEditor
          value={ctx.record.content ?? ""}
          placeholder={i18next.t("store:Write a comment")}
          onChange={(value) => update("content", value)}
          uploadImage={(file) => ResourceBackend.uploadResource(account?.name || "", "chat", "comment", ctx.record.targetKey || ctx.record.name || "", file)}
        />
      ),
    },
  ];

  return (
    <SimpleEditPage
      titleKey="comment:Edit Comment"
      backTo="/comments"
      deps={[commentOwner, commentName]}
      fields={fields}
      fetch={() => CommentBackend.getComment(commentOwner, commentName)}
      add={(record) => CommentBackend.addComment(record)}
      update={(record) => CommentBackend.updateComment(commentOwner, commentName, record)}
    />
  );
}
