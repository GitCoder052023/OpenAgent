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
import "katex/dist/katex.min.css";
import "highlight.js/styles/atom-one-dark-reasonable.css";
import {renderMessageHtml} from "@/lib/message-render";
import {cn} from "@/lib/utils";

/** A message body rendered from markdown, with math and highlighted code. */
export function MessageText({text, className}: {text: string; className?: string}) {
  const html = React.useMemo(() => renderMessageHtml(text), [text]);
  return <div className={cn("message-text", className)} dangerouslySetInnerHTML={{__html: html}} />;
}
