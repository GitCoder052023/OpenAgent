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
import {Check, CheckCircle2, Undo2, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {ConfirmButton} from "@/components/common/ConfirmButton";
import {SearchableSelect} from "@/components/common/SearchableSelect";
import {diffText, getDiffStats} from "@/lib/diff-text";

const CATEGORIES = ["Fact", "Style", "Format", "Scope"];

export interface CorrectionPayload {
  correctedText: string;
  reason: string;
  category: string;
  isGlobalRule: boolean;
  rule: string;
}

/**
 * Rewrites an AI answer in place. The reason, category and rule are what turn a
 * one-off fix into an entry of the experience library, so they are offered but optional.
 */
export function CorrectionEditor({message, canSetGlobalRule, onSave, onCancel}: {
  message: any;
  canSetGlobalRule: boolean;
  onSave: (payload: CorrectionPayload) => Promise<unknown>;
  onCancel: () => void;
}) {
  const original = message.correctedText || message.text || "";
  const [correctedText, setCorrectedText] = React.useState(original);
  const [reason, setReason] = React.useState("");
  const [category, setCategory] = React.useState("Fact");
  const [isGlobalRule, setIsGlobalRule] = React.useState(false);
  const [rule, setRule] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const save = async() => {
    setSaving(true);
    try {
      await onSave({
        correctedText,
        reason,
        category,
        isGlobalRule: canSetGlobalRule && isGlobalRule,
        rule: canSetGlobalRule && isGlobalRule ? rule : "",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-3 rounded-xl border bg-card p-4">
      <div>
        <div className="text-sm font-semibold">{i18next.t("experience:Correct this answer")}</div>
        <div className="text-xs text-muted-foreground">{i18next.t("experience:Correct this answer - Tooltip")}</div>
      </div>
      <Textarea autoFocus rows={8} value={correctedText} onChange={(e) => setCorrectedText(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <div className="w-40">
          <SearchableSelect
            value={category}
            allowUnknownValue={false}
            options={CATEGORIES.map((value) => ({value, label: i18next.t(`experience:Category - ${value}`)}))}
            onChange={setCategory}
          />
        </div>
        <Input className="min-w-[200px] flex-1" value={reason} placeholder={i18next.t("experience:Why was it wrong?")} onChange={(e) => setReason(e.target.value)} />
      </div>
      {canSetGlobalRule ? (
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={isGlobalRule} onCheckedChange={(value) => setIsGlobalRule(value === true)} />
            {i18next.t("experience:Apply as a standing rule")}
          </label>
          <div className="pl-6 text-[11px] text-muted-foreground">{i18next.t("experience:Apply as a standing rule - Tooltip")}</div>
          {isGlobalRule ? <Input value={rule} placeholder={i18next.t("experience:Rule")} onChange={(e) => setRule(e.target.value)} /> : null}
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}><X />{i18next.t("general:Cancel")}</Button>
        <Button size="sm" loading={saving} disabled={correctedText.trim() === "" || correctedText.trim() === original.trim()} onClick={save}>
          <Check />{i18next.t("general:Save")}
        </Button>
      </div>
    </div>
  );
}

/** Marks an answer a person rewrote and shows, on demand, what changed against the model's own. */
export function CorrectionBanner({message, canRevert, onRevert}: {message: any; canRevert: boolean; onRevert: () => void}) {
  const [expanded, setExpanded] = React.useState(false);
  const {parts, truncated} = React.useMemo(() => diffText(message.text || "", message.correctedText || ""), [message.text, message.correctedText]);
  const stats = React.useMemo(() => getDiffStats(parts), [parts]);

  return (
    <div className="mb-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 font-semibold text-success">
          <CheckCircle2 className="h-3 w-3" />{i18next.t("experience:Corrected by a human")}
        </span>
        <span className="text-muted-foreground">+{stats.inserted} / -{stats.removed}</span>
        <button type="button" className="text-primary hover:underline" onClick={() => setExpanded(!expanded)}>
          {i18next.t(expanded ? "experience:Hide changes" : "experience:Show changes")}
        </button>
        {canRevert ? (
          <ConfirmButton variant="ghost" size="iconSm" className="h-5 w-5" aria-label={i18next.t("experience:Revert")} title={i18next.t("experience:Revert this correction?")} onConfirm={onRevert}>
            <Undo2 className="!h-3 !w-3" />
          </ConfirmButton>
        ) : null}
      </div>
      {expanded ? (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-[13px]">
          <div className="text-[11px] text-muted-foreground">
            {i18next.t(truncated ? "experience:The answers differ too much to align, showing both versions" : "experience:Struck-through text was removed, highlighted text was added")}
          </div>
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {parts.map((part: any, index: number) => part.type === "equal" ? <span key={index}>{part.text}</span> : (
              <span
                key={index}
                className={part.type === "remove"
                  ? "rounded-sm bg-destructive/15 text-destructive line-through"
                  : "rounded-sm bg-success/15 text-success"}
              >
                {part.text}
              </span>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground">{i18next.t("experience:Original AI answer")}</div>
          <div className="whitespace-pre-wrap break-words rounded-r-md border-l-2 border-destructive bg-destructive/10 px-2.5 py-2 text-xs opacity-90">{message.text}</div>
        </div>
      ) : null}
    </div>
  );
}
