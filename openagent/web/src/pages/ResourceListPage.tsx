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
import {ImageOff, Upload} from "lucide-react";
import * as ResourceBackend from "@/backend/ResourceBackend";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {UserLabel} from "@/components/common/UserLabel";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {dateColumn, textColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import {useAccount} from "@/hooks/use-account";
import * as Setting from "@/lib/setting";

const CategoryVariants: Record<string, "info" | "success" | "warning"> = {
  avatar: "info",
  chat: "success",
  document: "warning",
};

function ImagePreview({url}: {url: string}) {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return <ImageOff className="h-6 w-6 text-muted-foreground" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="" className="max-h-16 w-20 rounded object-contain" onError={() => setFailed(true)} />
    </a>
  );
}

function UploadButton({onUploaded}: {onUploaded: () => void}) {
  const {account} = useAccount();
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const upload = async(file: File | undefined) => {
    if (!file || !account) {
      return;
    }
    setUploading(true);
    try {
      const res: any = await ResourceBackend.uploadResource(account.name, "avatar", "", "", file);
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Successfully uploaded"));
        onUploaded();
      } else {
        Setting.showMessage("error", res.msg);
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to upload")}: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Button loading={uploading} onClick={() => fileRef.current?.click()}>
        <Upload />
        {i18next.t("resource:Upload a file...")}
      </Button>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}

export default function ResourceListPage() {
  const columns: ColumnDef<any>[] = [
    textColumn({dataIndex: "name", title: i18next.t("general:Name"), width: 200, searchable: true}),
    dateColumn(),
    {
      dataIndex: "user",
      title: i18next.t("general:User"),
      width: 120,
      sortable: true,
      searchable: true,
      render: (value) => <UserLabel user={value} />,
    },
    {
      dataIndex: "category",
      title: i18next.t("general:Category"),
      width: 100,
      sortable: true,
      searchable: true,
      render: (value) => (value ? <Badge variant={CategoryVariants[value] ?? "secondary"}>{value}</Badge> : null),
    },
    textColumn({dataIndex: "fileName", title: i18next.t("store:File name"), searchable: true}),
    textColumn({dataIndex: "fileType", title: i18next.t("general:Type"), width: 90, searchable: true}),
    textColumn({dataIndex: "fileFormat", title: i18next.t("resource:Format"), width: 80, searchable: true}),
    {
      dataIndex: "fileSize",
      title: i18next.t("store:File size"),
      width: 100,
      sortable: true,
      render: (value) => <span className="tabular-nums">{Setting.getFriendlyFileSize(value ?? 0)}</span>,
    },
    {
      dataIndex: "preview",
      title: i18next.t("general:Preview"),
      width: 120,
      render: (_value, record) => {
        if (!record.url) {
          return null;
        }
        if (record.fileType === "image") {
          return <ImagePreview url={record.url} />;
        }
        if (record.fileType === "video") {
          return (
            <video width={80} controls>
              <source src={record.url} type="video/mp4" />
            </video>
          );
        }
        return null;
      },
    },
  ];

  return (
    <CrudListPage
      title={i18next.t("general:Resources")}
      columns={columns}
      fetch={(q) => ResourceBackend.getGlobalResources("", q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
      remove={(r) => ResourceBackend.deleteResource(r)}
      rowKey={(r) => r.name}
      toolbar={({refresh}) => <UploadButton onUploaded={refresh} />}
      actionColumnWidth={200}
      rowActions={(record) => [
        record.url ? {
          key: "copy",
          label: i18next.t("general:Copy Link"),
          onSelect: () => Setting.copyToClipboard(record.url),
        } : null,
      ]}
    />
  );
}
