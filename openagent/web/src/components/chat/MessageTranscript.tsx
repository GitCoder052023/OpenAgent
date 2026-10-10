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

import type * as React from "react";
import {Bot} from "lucide-react";
import {MessageText} from "@/components/chat/MessageText";
import {cn} from "@/lib/utils";

/**
 * A chat's messages as a read-only conversation, for the admin lists that show
 * what was said without opening the chat: the user on the right, the AI on the left.
 */
export function MessageTranscript({messages, className, style}: {messages: any[]; className?: string; style?: React.CSSProperties}) {
  return (
    <div className={cn("space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-2", className)} style={style}>
      {messages.map((message) => {
        const isAi = message.author === "AI";
        return (
          <div key={message.name} className={cn("flex gap-2", isAi ? "justify-start" : "justify-end")}>
            {isAi ? (
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <div className={cn("min-w-0 max-w-[85%] rounded-lg px-3 py-2", isAi ? "bg-card shadow-sm" : "bg-primary text-primary-foreground")}>
              {message.text ? <MessageText text={message.text} className={isAi ? undefined : "[&_a]:text-primary-foreground"} /> : null}
              {message.errorText ? <div className="mt-1 text-xs text-destructive">{message.errorText}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
