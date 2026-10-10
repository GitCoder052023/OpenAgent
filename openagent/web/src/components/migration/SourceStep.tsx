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
import {ChevronRight, FileUp, Info, X} from "lucide-react";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "@/components/ui/collapsible";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {cn} from "@/lib/utils";

/**
 * What a bundle file looks like, shown to anyone importing from an agent that
 * has no native adapter: they write this much JSON and the wizard does the rest.
 */
const bundleExample = `{
  "source": "my-agent",
  "agents": [
    {"name": "main", "displayName": "Main", "prompt": "You are helpful.",
     "modelProvider": "openai", "skills": ["pdf"]}
  ],
  "providers": [
    {"name": "openai", "type": "OpenAI", "subType": "gpt-6-astra", "clientSecret": "sk-..."}
  ],
  "skills": [
    {"name": "pdf", "skillMd": "---\\nname: pdf\\n---\\nRead PDFs."}
  ],
  "mcpServers": [
    {"name": "fs", "command": "npx", "args": ["-y", "server-filesystem"]}
  ],
  "chats": [
    {"name": "c1", "agent": "main", "messages": [
      {"author": "user", "text": "hi"}, {"author": "AI", "text": "hello"}]}
  ]
}`;

export interface SourceStepProps {
  sources: any[];
  sourceId: string;
  setSourceId: (id: string) => void;
  inputMode: string;
  setInputMode: (mode: string) => void;
  path: string;
  setPath: (path: string) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  scanning: boolean;
  onScan: () => void;
}

/** Picks which agent installation to import and how to reach it: a directory on this server, or an upload. */
export function SourceStep({sources, sourceId, setSourceId, inputMode, setInputMode, path, setPath, file, setFile, scanning, onScan}: SourceStepProps) {
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const selectedSource = sources.find((source) => source.id === sourceId);

  // switching sources refills the directory with that source's default location,
  // but never overwrites a path the user typed themselves
  const selectSource = (id: string) => {
    setSourceId(id);
    const source = sources.find((item) => item.id === id);
    const isAutoFilled = path === "" || sources.some((item) => item.defaultPath !== "" && item.defaultPath === path);
    if (source && isAutoFilled) {
      setPath(source.defaultPath);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{i18next.t("migration:Source agent")}</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={sourceId} onValueChange={selectSource} className="gap-2.5">
            <Label className="flex cursor-pointer items-center gap-2 font-normal">
              <RadioGroupItem value="" />
              {i18next.t("migration:Auto-detect")}
              <span className="text-muted-foreground">{i18next.t("migration:Let OpenAgent recognize the format")}</span>
            </Label>
            {sources.map((source) => (
              <Label key={source.id} className="flex cursor-pointer items-center gap-2 font-normal">
                <RadioGroupItem value={source.id} />
                {source.displayName}
                <Badge variant="outline" className="font-mono font-normal">{source.id}</Badge>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{i18next.t("migration:Where is it")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={inputMode} onValueChange={setInputMode}>
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="path">{i18next.t("migration:Scan a directory on this server")}</TabsTrigger>
              <TabsTrigger value="file">{i18next.t("migration:Upload a config file or archive")}</TabsTrigger>
            </TabsList>
          </Tabs>
          {inputMode === "path" ? (
            <div className="space-y-2">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder={selectedSource ? selectedSource.defaultPath : i18next.t("migration:e.g. /home/user/.openclaw")}
              />
              <p className="text-sm text-muted-foreground">
                {i18next.t("migration:The directory is read on the machine running OpenAgent, so this only works when the agent was installed there.")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  setFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className={cn(
                  "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors hover:border-primary/60",
                  dragging && "border-primary bg-accent/40",
                )}
              >
                <FileUp className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">{i18next.t("migration:Click or drag the config file here")}</span>
                <span className="text-xs text-muted-foreground">
                  {selectedSource ? selectedSource.fileHint : i18next.t("migration:A config file, or a .zip of the whole agent directory to bring skills and chat history along.")}
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              {file ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                  <span className="truncate">{file.name}</span>
                  <Button variant="ghost" size="iconSm" aria-label={i18next.t("general:Delete")} onClick={() => setFile(null)}>
                    <X />
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {sourceId === "bundle" ? (
        <Collapsible className="rounded-md border">
          <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium">
            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
            {i18next.t("migration:What does a bundle file look like?")}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-4 pb-4">
            <p className="text-sm text-muted-foreground">
              {i18next.t("migration:Every section is optional, so a file carrying nothing but chat history works too. Export this from any agent and its configuration lands in OpenAgent.")}
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{bundleExample}</pre>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <Alert>
        <Info />
        <AlertTitle>{i18next.t("migration:Nothing is written yet")}</AlertTitle>
        <AlertDescription>{i18next.t("migration:Scanning only reads the source and shows you a preview. You choose what to import on the next step.")}</AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Button size="lg" loading={scanning} disabled={inputMode === "path" ? !path : !file} onClick={onScan}>
          {i18next.t("migration:Scan")}
        </Button>
      </div>
    </div>
  );
}
