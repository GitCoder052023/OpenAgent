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
import dayjs from "dayjs";
import * as SkillBackend from "@/backend/SkillBackend";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import * as Setting from "@/lib/setting";

const PreviewChars = 600;

interface LoadSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (skillName: string) => void;
}

/** Reads a skill folder on the server (SKILL.md and references/), previews it and saves it as a skill. */
export function LoadSkillDialog({open, onOpenChange, onImported}: LoadSkillDialogProps) {
  const [path, setPath] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [preview, setPreview] = React.useState<any>(null);

  React.useEffect(() => {
    if (!open) {
      setPath("");
      setPreview(null);
      setLoading(false);
    }
  }, [open]);

  const load = async() => {
    const trimmed = path.trim();
    if (!trimmed) {
      Setting.showMessage("error", i18next.t("skill:Please enter a path"));
      return;
    }
    setLoading(true);
    setPreview(null);
    try {
      const res: any = await SkillBackend.loadSkill(trimmed);
      if (res.status === "ok") {
        setPreview(res.data);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to load")}: ${res.msg}`);
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to load")}: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const importSkill = async() => {
    if (!preview) {
      return;
    }
    const skill = {...preview, owner: "admin", createdTime: dayjs().format()};
    setImporting(true);
    try {
      const res: any = await SkillBackend.addSkill(skill);
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Successfully added"));
        onOpenChange(false);
        onImported(skill.name);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${error}`);
    } finally {
      setImporting(false);
    }
  };

  const content: string = preview?.content ?? "";
  const references: any[] = preview?.references ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{i18next.t("skill:Load Existing Skill")}</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="skill-folder-path">{i18next.t("skill:Skill folder path")}</Label>
            <Input
              id="skill-folder-path"
              className="font-mono"
              placeholder={i18next.t("skill:Skill folder path placeholder")}
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
                setPreview(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
            <p className="text-xs text-muted-foreground">{i18next.t("skill:Skill folder path hint")}</p>
          </div>
          {preview && !loading ? (
            <div className="space-y-3 rounded-md border p-4 text-sm">
              <div className="font-medium">
                {preview.emoji ? <span className="mr-2">{preview.emoji}</span> : null}
                {preview.name}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{i18next.t("general:Description")}</div>
                <p className="whitespace-pre-wrap">{preview.description || "—"}</p>
              </div>
              {preview.homepage ? (
                <div>
                  <div className="text-xs text-muted-foreground">{i18next.t("skill:Homepage")}</div>
                  <a href={preview.homepage} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline-offset-4 hover:underline">{preview.homepage}</a>
                </div>
              ) : null}
              <div>
                <div className="text-xs text-muted-foreground">{i18next.t("skill:References")}</div>
                {references.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {references.map((ref) => <Badge key={ref.name} variant="outline" className="font-mono">{ref.name}</Badge>)}
                  </div>
                ) : <span className="text-muted-foreground">—</span>}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{i18next.t("skill:Content preview")}</div>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-xs">
                  {content.slice(0, PreviewChars)}{content.length > PreviewChars ? "\n…" : ""}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{i18next.t("general:Cancel")}</Button>
          <Button variant="outline" loading={loading} disabled={!path.trim()} onClick={load}>{i18next.t("skill:Load")}</Button>
          <Button loading={importing} disabled={!preview} onClick={importSkill}>{i18next.t("skill:Import to Database")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LoadSkillDialog;
