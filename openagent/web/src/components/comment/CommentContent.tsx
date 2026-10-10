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

import {sanitizeCommentHtml} from "@/lib/comment-content";
import {cn} from "@/lib/utils";

/** A comment's sanitized HTML. */
export function CommentContent({content, compact = false, className}: {content: string; compact?: boolean; className?: string}) {
  return (
    <div
      className={cn("comment-content", compact ? "my-1" : "mb-2 mt-1.5", className)}
      dangerouslySetInnerHTML={{__html: sanitizeCommentHtml(content)}}
    />
  );
}

export default CommentContent;
