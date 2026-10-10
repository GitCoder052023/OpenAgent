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
import {CircleCheck, CloudDownload, RefreshCw, Search, Store} from "lucide-react";
import * as SkillBackend from "@/backend/SkillBackend";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Loading} from "@/components/common/Loading";
import * as Setting from "@/lib/setting";
import {isComposing} from "@/lib/utils";

const SearchDelayMs = 500;

interface SkillMarketplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstalled: (skillName: string) => void;
}

/** Browses the skill marketplaces the backend knows of and installs a skill from one. */
export function SkillMarketplaceDialog({open, onOpenChange, onInstalled}: SkillMarketplaceDialogProps) {
  const [sources, setSources] = React.useState<any[]>([]);
  const [source, setSource] = React.useState("");
  const [keyword, setKeyword] = React.useState("");
  const [skills, setSkills] = React.useState<any[] | null>(null);
  const [installed, setInstalled] = React.useState<Set<string>>(new Set());
  const [installing, setInstalling] = React.useState<Set<string>>(new Set());
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchId = React.useRef(0);

  const search = React.useCallback(async(src: string, kw: string) => {
    const id = ++searchId.current;
    setSkills(null);
    try {
      const res: any = await SkillBackend.getMarketplaceSkills(src, kw);
      if (id !== searchId.current) {
        return;
      }
      if (res.status === "ok") {
        setSkills(res.data ?? []);
      } else {
        setSkills([]);
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    } catch (error) {
      if (id === searchId.current) {
        setSkills([]);
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${error}`);
      }
    }
  }, []);

  // the sources and the installed names are read each time the dialog opens
  React.useEffect(() => {
    if (!open) {
      clearTimeout(timer.current);
      setKeyword("");
      setSkills(null);
      return;
    }
    SkillBackend.getMarketplaceSources().then((res: any) => {
      if (res.status === "ok" && res.data) {
        setSources(res.data);
        setSource((prev) => prev || res.data[0]?.id || "");
      }
    });
    SkillBackend.getSkills("admin").then((res: any) => {
      if (res.status === "ok") {
        setInstalled(new Set((res.data ?? []).map((skill: any) => skill.name)));
      }
    });
  }, [open]);

  React.useEffect(() => {
    if (open && source) {
      search(source, keyword);
    }
  }, [open, source]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const changeKeyword = (value: string) => {
    setKeyword(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(source, value), SearchDelayMs);
  };

  const install = async(item: any) => {
    setInstalling((prev) => new Set(prev).add(item.name));
    try {
      const res: any = await SkillBackend.installMarketplaceSkill(item);
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Successfully added"));
        onOpenChange(false);
        onInstalled(res.data.name);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${error}`);
    } finally {
      setInstalling((prev) => {
        const next = new Set(prev);
        next.delete(item.name);
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Store className="h-5 w-5" />{i18next.t("skill:Skill Marketplace")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={source} onValueChange={setSource} disabled={sources.length === 0}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {sources.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={i18next.t("skill:Search marketplace placeholder")}
              value={keyword}
              onChange={(e) => changeKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isComposing(e)) {
                  clearTimeout(timer.current);
                  search(source, keyword);
                }
              }}
            />
          </div>
          <Button variant="outline" loading={skills === null && Boolean(source)} disabled={!source} onClick={() => search(source, keyword)}>
            {skills === null && source ? null : <RefreshCw />}{i18next.t("general:Refresh")}
          </Button>
        </div>
        <div className="-mx-1 min-h-[240px] flex-1 overflow-y-auto px-1">
          {skills === null ? <Loading className="py-16" /> : skills.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{i18next.t("skill:No skills found")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {skills.map((item) => {
                const isInstalled = installed.has(item.name);
                return (
                  <Card key={`${item.source}-${item.name}`} className="flex flex-col">
                    <CardContent className="flex flex-1 flex-col gap-2 p-4">
                      <div className="flex items-start gap-2">
                        {item.emoji ? <span className="text-xl leading-none">{item.emoji}</span> : null}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium" title={item.displayName || item.name}>{item.displayName || item.name}</div>
                          {item.type ? <Badge variant="info" className="mt-1 text-[11px]">{item.type}</Badge> : null}
                        </div>
                        {isInstalled ? <Badge variant="success" className="shrink-0 text-[11px]">{i18next.t("skill:Installed")}</Badge> : null}
                      </div>
                      <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">{item.description || "—"}</p>
                      {item.tags?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.slice(0, 4).map((tag: string) => <Badge key={tag} variant="outline" className="text-[11px] font-normal">{tag}</Badge>)}
                        </div>
                      ) : null}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                        {item.homepage ? (
                          <a href={item.homepage} target="_blank" rel="noopener noreferrer" title={item.homepage} className="min-w-0 truncate text-xs text-primary underline-offset-4 hover:underline">
                            {item.homepage.replace(/^https?:\/\//, "")}
                          </a>
                        ) : <span />}
                        <Button size="sm" variant={isInstalled ? "outline" : "default"} loading={installing.has(item.name)} onClick={() => install(item)}>
                          {installing.has(item.name) ? null : isInstalled ? <CircleCheck /> : <CloudDownload />}
                          {isInstalled ? i18next.t("skill:Reinstall") : i18next.t("skill:Install")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        {skills && skills.length > 0 ? (
          <p className="text-right text-xs text-muted-foreground">{i18next.t("general:{total} in total").replace("{total}", String(skills.length))}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default SkillMarketplaceDialog;
