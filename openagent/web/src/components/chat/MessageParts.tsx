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

import * as React from "react";
import i18next from "i18next";
import FileSaver from "file-saver";
import {CheckCircle2, ChevronDown, Code2, Download, Lightbulb, Loader2, XCircle} from "lucide-react";
import * as MessageBackend from "@/backend/MessageBackend";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {MessageText} from "@/components/chat/MessageText";
import {FileTypeIcon, getFileExtension} from "@/components/common/FileTypeIcon";
import {TOOL_DELTA_PREVIEW_LIMIT, formatSuggestion, type ToolCall} from "@/lib/chat-stream";
import {cn} from "@/lib/utils";

export function ThinkingDots({label}: {label?: string}) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm font-semibold text-primary">
      {label || i18next.t("chat:Thinking")}
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{animationDelay: `${i * 0.16}s`}} />
        ))}
      </span>
    </div>
  );
}

function StateBadge({state}: {state: "running" | "done" | "error"}) {
  if (state === "running") {
    return <Badge variant="secondary" className="gap-1 font-normal"><Loader2 className="h-3 w-3 animate-spin" />{i18next.t("chat:Executing...")}</Badge>;
  }
  if (state === "error") {
    return <Badge variant="destructive" className="gap-1 font-normal"><XCircle className="h-3 w-3" />{i18next.t("general:Error")}</Badge>;
  }
  return <Badge variant="success" className="gap-1 font-normal"><CheckCircle2 className="h-3 w-3" />{i18next.t("chat:Done")}</Badge>;
}

/** a collapsible card, shared by the reasoning block and each tool call */
function DetailCard({icon: Icon, title, badge, defaultOpen, mono, children}: {
  icon: React.ElementType;
  title: React.ReactNode;
  badge: React.ReactNode;
  defaultOpen: boolean;
  mono?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/30">
      <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2 text-left" onClick={() => setOpen((v) => !v)}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" /></span>
        <span className={cn("min-w-0 flex-1 truncate text-[13px] font-semibold", mono && "font-mono")}>{title}</span>
        {badge}
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="border-t px-3 py-2.5">{children}</div> : null}
    </div>
  );
}

function SectionLabel({icon: Icon, children}: {icon: React.ElementType; children: React.ReactNode}) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3 w-3" />{children}
    </div>
  );
}

export function ReasoningSection({reasonText, isReasoningPhase}: {reasonText?: string; isReasoningPhase?: boolean}) {
  if (!reasonText) {
    return null;
  }
  return (
    <div className="mb-3.5">
      <SectionLabel icon={Lightbulb}>{i18next.t("chat:Reasoning process")}</SectionLabel>
      <DetailCard icon={Lightbulb} title={i18next.t("chat:Reasoning process")} badge={<StateBadge state={isReasoningPhase ? "running" : "done"} />} defaultOpen>
        <div className="max-h-96 overflow-y-auto text-[13px] text-muted-foreground">
          <MessageText text={reasonText} />
        </div>
      </DetailCard>
    </div>
  );
}

function prettyJson(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function CodeBlock({children}: {children: string}) {
  return <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-900 p-2.5 font-mono text-xs leading-relaxed text-zinc-100">{children}</pre>;
}

function ToolCallCard({toolCall}: {toolCall: ToolCall}) {
  const running = !toolCall.content;
  const label = (key: string) => <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{i18next.t(key)}</div>;
  return (
    <DetailCard icon={Code2} title={toolCall.name} mono badge={<StateBadge state={running ? "running" : toolCall.isError ? "error" : "done"} />} defaultOpen={running}>
      <div className="space-y-2.5">
        {toolCall.arguments ? (
          <div>
            {label("general:Arguments")}
            <CodeBlock>{running ? toolCall.arguments.slice(-TOOL_DELTA_PREVIEW_LIMIT) : prettyJson(toolCall.arguments)}</CodeBlock>
          </div>
        ) : null}
        {toolCall.content ? (
          <div>
            {label("general:Result")}
            <CodeBlock>{prettyJson(toolCall.content)}</CodeBlock>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />{i18next.t("chat:Executing...")}</div>
        )}
      </div>
    </DetailCard>
  );
}

export function ToolCallSection({toolCalls}: {toolCalls?: ToolCall[]}) {
  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }
  return (
    <div className="mb-3.5">
      <SectionLabel icon={Code2}>{toolCalls.length} {i18next.t("chat:Tool calls")}</SectionLabel>
      <div className="space-y-2">
        {toolCalls.map((toolCall, index) => <ToolCallCard key={index} toolCall={toolCall} />)}
      </div>
    </div>
  );
}

/** "Thinking…", "Calling tool: x…": what the answer in progress is doing right now */
export function StatusStrip({message}: {message: any}) {
  const runningTool = message.toolCalls?.find((toolCall: ToolCall) => !toolCall.content);
  const text = runningTool ? `${i18next.t("chat:Calling tool")}: ${runningTool.name}` : message.statusText || i18next.t("chat:Thinking");
  return (
    <div className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-primary">
      <Loader2 className="h-3 w-3 animate-spin" />{text}
    </div>
  );
}

export interface GeneratedResource {
  uri: string;
  name?: string;
  mimeType?: string;
}

/** the files the tools produced (MCP resource links), for download under the answer */
export function extractGeneratedResources(toolCalls?: ToolCall[]): GeneratedResource[] {
  const resources: GeneratedResource[] = [];
  (toolCalls ?? []).forEach((toolCall) => {
    if (!toolCall.content) {
      return;
    }
    try {
      const content = JSON.parse(toolCall.content);
      if (Array.isArray(content)) {
        content.forEach((item) => {
          if (item?.type === "resource_link" && typeof item.uri === "string" && item.uri !== "") {
            resources.push(item);
          }
        });
      }
    } catch {
      // a tool result that is not JSON carries no resources
    }
  });
  return resources;
}

async function download(href: string, fileName: string) {
  try {
    const res = await fetch(href);
    if (!res.ok) {
      throw new Error(res.statusText);
    }
    FileSaver.saveAs(await res.blob(), fileName);
  } catch {
    window.open(href, "_blank", "noopener,noreferrer");
  }
}

export function GeneratedResourceList({resources}: {resources: GeneratedResource[]}) {
  if (resources.length === 0) {
    return null;
  }
  return (
    <div className="mb-3 max-w-2xl space-y-2">
      {resources.map((resource, index) => {
        const fileName = resource.name || resource.uri;
        const ext = getFileExtension(resource.name) || resource.mimeType?.split("/").pop() || "file";
        return (
          <div key={`${resource.uri}-${index}`} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <FileTypeIcon filename={fileName} className="h-9 w-9" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="truncate text-sm font-medium" title={fileName}>{fileName}</div>
              <Badge variant="secondary" className="font-normal uppercase">{ext}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => download(resource.uri, fileName)}><Download />{i18next.t("general:Download")}</Button>
          </div>
        );
      })}
    </div>
  );
}

export function MessageSuggestions({message, onSend}: {message: any; onSend: (text: string) => void}) {
  const suggestions = (message.suggestions ?? []).filter((suggestion: any) => suggestion.text?.trim());
  if (message.author !== "AI" || suggestions.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {message.suggestions.map((suggestion: any, index: number) => {
        if (!suggestion.text?.trim()) {
          return null;
        }
        const text = formatSuggestion(suggestion.text);
        return (
          <Button
            key={index}
            variant="secondary"
            className="h-auto whitespace-normal py-2 text-left font-normal"
            onClick={() => {
              onSend(text);
              // remembers which suggestion was taken, for the store's insights
              message.suggestions[index].isHit = true;
              MessageBackend.updateMessage(message.owner, message.name, message, true);
            }}
          >
            {text}
          </Button>
        );
      })}
    </div>
  );
}
