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
import {Upload} from "lucide-react";
import {Link, useNavigate} from "react-router-dom";
import * as FileBackend from "@/backend/FileBackend";
import * as ProviderBackend from "@/backend/ProviderBackend";
import * as StorageProviderBackend from "@/backend/StorageProviderBackend";
import {Button} from "@/components/ui/button";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {FileTypeIcon, ImageExtensions, getFileExtension} from "@/components/common/FileTypeIcon";
import {UserLabel} from "@/components/common/UserLabel";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {dateColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import {useAccount} from "@/hooks/use-account";
import {useRequestStore} from "@/hooks/use-request-store";
import * as ProviderSetting from "@/lib/provider-setting";
import * as Setting from "@/lib/setting";

/** The file's key inside its store, which is what its vectors record as their file. */
function getObjectKey(record: any) {
  return record.name.startsWith(`${record.store}_`) ? record.name.substring(record.store.length + 1) : record.name;
}

function UploadButton({onUploaded}: {onUploaded: () => void}) {
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const upload = async(files: File[]) => {
    if (files.length === 0) {
      return;
    }
    setUploading(true);
    try {
      // uploads land in the store picked in the header, or the default one under "All"
      const store = Setting.getStoreCurrent() || "";
      const results = await Promise.all(files.map((file) => FileBackend.uploadFile(file.name, file, store)));
      const failed = results.filter((res: any) => res.status !== "ok");
      failed.forEach((res: any) => Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`));
      if (failed.length === 0) {
        Setting.showMessage("success", i18next.t("general:Successfully uploaded"));
      }
      onUploaded();
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Button loading={uploading} onClick={() => fileRef.current?.click()}>
        <Upload />
        {i18next.t("general:Upload")}
      </Button>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </>
  );
}

export default function FileListPage() {
  const {account} = useAccount();
  const navigate = useNavigate();
  const store = useRequestStore();
  const [providers, setProviders] = React.useState<Record<string, any>>({});
  const [refreshing, setRefreshing] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!account) {
      return;
    }
    Promise.all([
      StorageProviderBackend.getStorageProviders(account.name),
      ProviderBackend.getProviders(account.name),
    ]).then(([storageRes, providerRes]: any[]) => {
      const map: Record<string, any> = {};
      [storageRes, providerRes].forEach((res) => {
        if (res.status === "ok") {
          (res.data ?? []).forEach((provider: any) => {
            map[provider.name] = provider;
          });
        }
      });
      setProviders(map);
    });
  }, [account]);

  const refreshVectors = async(record: any, refresh: () => void) => {
    setRefreshing((prev) => new Set(prev).add(record.name));
    try {
      const res: any = await FileBackend.refreshFileVectors(record);
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Vectors generated successfully"));
        refresh();
      } else {
        Setting.showMessage("error", `${i18next.t("general:Vectors failed to generate")}: ${res.msg}`);
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Vectors failed to generate")}: ${error}`);
    }
    setRefreshing((prev) => {
      const next = new Set(prev);
      next.delete(record.name);
      return next;
    });
  };

  const vectorsUrl = (record: any) => `/vectors?file=${encodeURIComponent(getObjectKey(record))}`;

  const columns: ColumnDef<any>[] = [
    {dataIndex: "owner", title: i18next.t("general:Owner"), width: 130, sortable: true, searchable: true, render: (value) => <UserLabel user={value} />},
    {
      dataIndex: "store",
      title: i18next.t("general:Store"),
      width: 150,
      sortable: true,
      searchable: true,
      link: (value, record) => (value ? `/stores/${record.owner}/${value}` : undefined),
    },
    {
      dataIndex: "storageProvider",
      title: i18next.t("store:Storage"),
      width: 120,
      sortable: true,
      searchable: true,
      render: (value) => {
        if (!value) {
          return null;
        }
        const provider = providers[value];
        const logoUrl = provider ? ProviderSetting.getProviderLogoURL(provider) : "";
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to={`/providers/${value}`} className="inline-flex underline-offset-4 hover:underline">
                {logoUrl ? <img src={logoUrl} alt={value} className="h-6 w-6 object-contain" /> : value}
              </Link>
            </TooltipTrigger>
            <TooltipContent>{value}</TooltipContent>
          </Tooltip>
        );
      },
    },
    dateColumn(),
    {
      dataIndex: "filename",
      title: i18next.t("file:Filename"),
      sortable: true,
      searchable: true,
      render: (value, record) => {
        const inner = (
          <span className="inline-flex items-center gap-1.5">
            <FileTypeIcon filename={value} />
            {value}
          </span>
        );
        return record.url ? <a href={record.url} target="_blank" rel="noreferrer" download className="underline-offset-4 hover:underline">{inner}</a> : inner;
      },
    },
    {dataIndex: "size", title: i18next.t("general:Size"), width: 110, sortable: true, render: (value) => <span className="tabular-nums">{Setting.getFormattedSize(value ?? 0)}</span>},
    {
      dataIndex: "vectorCount",
      title: i18next.t("store:Vector count"),
      width: 130,
      sortable: true,
      render: (value, record) => <Link to={vectorsUrl(record)} className="tabular-nums underline-offset-4 hover:underline">{value}</Link>,
    },
    {dataIndex: "tokenCount", title: i18next.t("chat:Token count"), width: 130, sortable: true, className: "tabular-nums"},
    {
      dataIndex: "preview",
      title: i18next.t("general:Preview"),
      width: 110,
      render: (_value, record) => (record.url && ImageExtensions.includes(getFileExtension(record.filename)) ? (
        <a href={record.url} target="_blank" rel="noreferrer">
          <img src={record.url} alt={record.filename} className="h-16 w-16 rounded object-contain" />
        </a>
      ) : null),
    },
  ];

  return (
    <CrudListPage
      title={i18next.t("general:Files")}
      columns={columns}
      fetch={(q) => FileBackend.getGlobalFiles(store, q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
      deps={[store]}
      rowKey={(r) => r.name}
      remove={(r) => FileBackend.deleteFile(r)}
      toolbar={({refresh}) => <UploadButton onUploaded={refresh} />}
      actionColumnWidth={300}
      rowActions={(record, _index, {refresh}) => [
        {key: "vectors", label: i18next.t("vector:View Vector"), onSelect: () => navigate(vectorsUrl(record))},
        Setting.isLocalAdminUser(account) ? {
          key: "refresh",
          label: i18next.t("general:Refresh Vectors"),
          loading: refreshing.has(record.name),
          onSelect: () => refreshVectors(record, refresh),
        } : null,
      ]}
    />
  );
}
