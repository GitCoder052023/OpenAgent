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

import i18next from "i18next";
import {Copy, RefreshCw} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import * as Setting from "@/lib/setting";

export function getOpenAiCompatibleBaseUrl() {
  // the dev server proxies nothing for third-party clients, so point them at the backend port
  const origin = window.location.port === "13001"
    ? window.location.origin.replace(":13001", ":14000")
    : window.location.origin;
  return `${origin}/api`;
}

export function getOpenAiCompatibleChatCompletionsUrl() {
  return `${getOpenAiCompatibleBaseUrl()}/v1/chat/completions`;
}

function generateApiKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return `sk-${Array.from(bytes, (b) => chars[b % chars.length]).join("")}`;
}

function CopyButton({value, disabled}: {value: string; disabled?: boolean}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="shrink-0"
      disabled={disabled || !value}
      aria-label={i18next.t("general:Copy")}
      onClick={() => Setting.copyToClipboard(value)}
    >
      <Copy className="h-4 w-4" />
    </Button>
  );
}

function Field({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

/**
 * The OpenAI-compatible endpoint this site exposes, and the key third-party
 * clients authenticate to it with.
 */
export function OpenAiCompatibleConfig({apiKey, disabled, onChange}: {apiKey: string; disabled?: boolean; onChange: (value: string) => void}) {
  const baseUrl = getOpenAiCompatibleBaseUrl();
  const chatCompletionsUrl = getOpenAiCompatibleChatCompletionsUrl();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_2fr]">
      <Field label={i18next.t("general:External API key")}>
        <Input type="password" value={apiKey ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        <CopyButton value={apiKey} disabled={disabled || apiKey === "***"} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={disabled} onClick={() => onChange(generateApiKey())}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{i18next.t("general:Generate a new key, copy it and save, it will not be shown again")}</TooltipContent>
        </Tooltip>
      </Field>
      <Field label={i18next.t("server:Base URL")}>
        <Input readOnly value={baseUrl} />
        <CopyButton value={baseUrl} />
      </Field>
      <Field label={i18next.t("general:Chat completions endpoint")}>
        <Input readOnly value={chatCompletionsUrl} />
        <CopyButton value={chatCompletionsUrl} />
      </Field>
    </div>
  );
}
