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
import {Link2, Upload} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import * as Setting from "@/lib/setting";

interface ImageUrlInputProps {
  value: string;
  onChange: (value: string) => void;
  /** uploads the picked image and resolves to the API response, whose `data` is the URL */
  upload?: (file: File) => Promise<any>;
  /** what to preview when it differs from the stored value, such as a default logo */
  previewUrl?: string;
  disabled?: boolean;
}

/** A URL field for an image, with an upload button and a preview of what it points at. */
export function ImageUrlInput({value, onChange, upload, previewUrl, disabled}: ImageUrlInputProps) {
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async(file: File | undefined) => {
    if (!file || !upload) {
      return;
    }
    setUploading(true);
    try {
      const res = await upload(file);
      if (res.status === "ok") {
        onChange(res.data);
        Setting.showMessage("success", i18next.t("general:Successfully uploaded"));
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to upload")}: ${res.msg}`);
      }
    } catch (error: any) {
      Setting.showMessage("error", `${i18next.t("general:Failed to upload")}: ${error?.message ?? error}`);
    } finally {
      setUploading(false);
    }
  };

  const preview = value ? (previewUrl ?? value) : "";

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        </div>
        {upload ? (
          <>
            <Button variant="outline" disabled={disabled} loading={uploading} onClick={() => fileRef.current?.click()}>
              <Upload />
              {i18next.t("general:Upload")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </>
        ) : null}
      </div>
      {preview ? (
        <a href={preview} target="_blank" rel="noreferrer" className="inline-block rounded-md border bg-muted/40 p-1.5">
          <img src={preview} alt={value} className="h-[90px] max-w-full object-contain" />
        </a>
      ) : null}
    </div>
  );
}
