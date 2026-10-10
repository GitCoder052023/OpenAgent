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
import dayjs from "dayjs";
import {ChevronRight, CloudUpload, Download, FileCheck2, Folder, FolderOpen, FolderPlus, FolderUp, Search, Trash2} from "lucide-react";
import * as PermissionBackend from "@/backend/PermissionBackend";
import * as TreeFileBackend from "@/backend/TreeFileBackend";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Checkbox} from "@/components/ui/checkbox";
import {Input} from "@/components/ui/input";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {ConfirmButton} from "@/components/common/ConfirmButton";
import {DescriptionList} from "@/components/common/DescriptionList";
import {FileTypeIcon, getFileExtension} from "@/components/common/FileTypeIcon";
import {FilePreview} from "@/components/store/FilePreview";
import * as Conf from "@/Conf";
import * as Setting from "@/lib/setting";
import {cn} from "@/lib/utils";

export interface TreeFile {
  key: string;
  title: string;
  isLeaf: boolean;
  size?: number;
  createdTime?: string;
  url?: string;
  children?: TreeFile[];
}

type Action = "Read" | "Write" | "Admin";

// expanding everything is only pleasant while the tree is small
const EXPAND_ALL_LIMIT = 300;

function walk(file: TreeFile, visit: (file: TreeFile, parent: TreeFile | null) => void, parent: TreeFile | null = null) {
  visit(file, parent);
  (file.children ?? []).forEach((child) => walk(child, visit, file));
}

function filterTree(file: TreeFile, search: string): TreeFile | null {
  if (file.isLeaf) {
    return file.title.includes(search) ? file : null;
  }
  const children = (file.children ?? []).map((child) => filterTree(child, search)).filter(Boolean) as TreeFile[];
  if (children.length > 0 || file.title.includes(search)) {
    return {...file, children};
  }
  return null;
}

// files named like "20220827_210300_CH~Logo.png" carry when they were collected and the subject
function parseCollectedName(filename: string) {
  const [prefix, rest] = filename.split("~");
  if (rest === undefined) {
    return null;
  }
  const match = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(prefix);
  const code = prefix.slice(-2);
  const subject = code === "MA" ? i18next.t("store:Math") : code === "CH" ? i18next.t("store:Chinese") : code === "NU" ? "" : code;
  return {
    collectedTime: match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}` : "",
    subject,
  };
}

function storeIdOf(store: any) {
  return `${store.owner}/${store.name}`;
}

/**
 * Asks for (or, as a store admin, grants) access to files through a Casdoor
 * permission, then opens it in Casdoor where its users are picked.
 */
async function addPermission(account: any, store: any, isAdmin: boolean, fileKeys: string[]) {
  const randomName = Setting.getRandomName();
  const now = dayjs().format();
  const permission = {
    owner: account.owner,
    name: `permission_${randomName}`,
    createdTime: now,
    displayName: `New Permission - ${randomName}`,
    users: isAdmin ? [] : [`${account.owner}/${account.name}`],
    roles: [],
    domains: [store.name],
    model: "casbin/user-model-built-in",
    resourceType: "TreeNode",
    resources: fileKeys,
    actions: ["Read"],
    effect: "Allow",
    isEnabled: true,
    submitter: account.name,
    approver: isAdmin ? account.name : "",
    approveTime: isAdmin ? now : "",
    state: isAdmin ? "Approved" : "Pending",
  };
  try {
    const res: any = await PermissionBackend.addPermission(permission);
    if (res.status === "ok") {
      Setting.openLink(Setting.getMyProfileUrl(account).replace("/account", `/permissions/${permission.owner}/${permission.name}`));
    } else {
      Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
    }
  } catch (error) {
    Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${error}`);
  }
}

function IconAction({label, onClick, children}: {label: string; onClick?: () => void; children: React.ReactNode}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="iconSm"
          className="h-6 w-6"
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function FolderTable({files, onOpen}: {files: TreeFile[]; onOpen: (file: TreeFile) => void}) {
  const rows = [...files].sort((a, b) => Number(a.isLeaf) - Number(b.isLeaf) || a.title.localeCompare(b.title));
  const collected = rows.map((file) => parseCollectedName(file.title));
  const showCollected = collected.some(Boolean);

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{i18next.t("store:File name")}</TableHead>
            <TableHead className="w-24">{i18next.t("general:Category")}</TableHead>
            <TableHead className="w-24">{i18next.t("store:File type")}</TableHead>
            <TableHead className="w-24 text-right">{i18next.t("store:File size")}</TableHead>
            <TableHead className="w-40">{i18next.t("general:Created time")}</TableHead>
            {showCollected ? <TableHead className="w-40">{i18next.t("store:Collected time")}</TableHead> : null}
            {showCollected ? <TableHead className="w-20">{i18next.t("store:Subject")}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{i18next.t("general:No data")}</TableCell></TableRow>
          ) : rows.map((file, index) => (
            <TableRow key={file.key} className="cursor-pointer" onClick={() => onOpen(file)}>
              <TableCell>
                <span className="flex min-w-0 items-center gap-2">
                  {file.isLeaf ? <FileTypeIcon filename={file.title} /> : <Folder className="h-[18px] w-[18px] shrink-0 text-amber-500" />}
                  <span className="truncate">{file.title}</span>
                </span>
              </TableCell>
              <TableCell>{i18next.t(file.isLeaf ? "store:File" : "store:Folder")}</TableCell>
              <TableCell className="font-mono text-xs">{file.isLeaf ? getFileExtension(file.title) : ""}</TableCell>
              <TableCell className="text-right tabular-nums">{file.isLeaf ? Setting.getFriendlyFileSize(file.size ?? 0) : ""}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground">{Setting.getFormattedDate(file.createdTime)}</TableCell>
              {showCollected ? <TableCell className="tabular-nums text-muted-foreground">{Setting.getFormattedDate(collected[index]?.collectedTime)}</TableCell> : null}
              {showCollected ? <TableCell>{collected[index]?.subject}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface FileTreeProps {
  store: any;
  account: any;
  /** a file to open right away, from the ?fileKey= of a shared link */
  initialFileKey?: string | null;
  onRefresh: () => void;
}

/** A store's knowledge files: browse, preview, upload, delete and ask for access. */
export function FileTree({store, account, initialFileKey, onRefresh}: FileTreeProps) {
  const root: TreeFile = store.fileTree;
  const isStoreAdmin = Setting.isLocalAndStoreAdminUser(account);
  const storeId = storeIdOf(store);

  const index = React.useMemo(() => {
    const files = new Map<string, TreeFile>();
    const parents = new Map<string, string | null>();
    walk(root, (file, parent) => {
      files.set(file.key, file);
      parents.set(file.key, parent?.key ?? null);
    });
    return {files, parents};
  }, [root]);

  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    const keys = new Set<string>([root.key]);
    if (index.files.size <= EXPAND_ALL_LIMIT) {
      index.files.forEach((file) => !file.isLeaf && keys.add(file.key));
    } else {
      (root.children ?? []).forEach((file) => !file.isLeaf && keys.add(file.key));
    }
    return keys;
  });
  const knownKeys = React.useRef(new Set(index.files.keys()));
  // a folder that appears after a refresh is one just created or uploaded, so it opens
  React.useEffect(() => {
    const added = [...index.files.values()].filter((file) => !file.isLeaf && !knownKeys.current.has(file.key));
    knownKeys.current = new Set(index.files.keys());
    if (added.length > 0) {
      setExpanded((prev) => new Set([...prev, ...added.map((file) => file.key)]));
    }
  }, [index]);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [dragOverKey, setDragOverKey] = React.useState<string | null>(null);
  const [newFolder, setNewFolder] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [permissionMap, setPermissionMap] = React.useState<Record<string, any[]> | null>(null);
  const uploadTarget = React.useRef<TreeFile | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const folderInput = React.useRef<HTMLInputElement>(null);

  // only store managers may read the permissions; the endpoint refuses everyone else
  React.useEffect(() => {
    if (!isStoreAdmin) {
      return;
    }
    PermissionBackend.getPermissions(Conf.AuthConfig.organizationName).then((res: any) => {
      if (res.status !== "ok") {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        return;
      }
      const map: Record<string, any[]> = {};
      (res.data ?? [])
        .filter((permission: any) => permission.domains?.[0] === store.name && permission.users?.length !== 0)
        .forEach((permission: any) => {
          (map[permission.resources[0]] ??= []).push(permission);
        });
      setPermissionMap(map);
    });
  }, [isStoreAdmin, store.name]);

  React.useEffect(() => {
    if (!initialFileKey) {
      return;
    }
    const key = initialFileKey.replace(/^\/+/, "").replace(/\/+$/, "");
    if (index.files.get(key)?.isLeaf) {
      setSelectedKey(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFileKey]);

  const can = (key: string, action: Action): boolean => {
    if (isStoreAdmin) {
      return true;
    }
    const userId = `${account.owner}/${account.name}`;
    // a grant on a folder covers everything under it; Write implies Read, Admin implies both
    const grants = (granted: string) => action === "Read" || (action === "Write" && granted !== "Read") || (action === "Admin" && granted === "Admin");
    for (let current: string | null = key; current !== null; current = index.parents.get(current) ?? null) {
      const ok = (permissionMap?.[current] ?? []).some((permission) =>
        permission.state === "Approved" && permission.isEnabled && permission.users.includes(userId) && grants(permission.actions[0]));
      if (ok) {
        return true;
      }
    }
    return false;
  };

  const descendants = (file: TreeFile) => {
    const keys: string[] = [];
    walk(file, (item) => keys.push(item.key));
    return keys;
  };

  const toggleCheck = (file: TreeFile, value: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      descendants(file).forEach((key) => (value ? next.add(key) : next.delete(key)));
      return next;
    });
    setSelectedKey(null);
  };

  // what to act on: a checked folder covers its checked contents
  const topChecked = [...checked]
    .filter((key) => {
      for (let parent = index.parents.get(key) ?? null; parent !== null; parent = index.parents.get(parent) ?? null) {
        if (checked.has(parent)) {
          return false;
        }
      }
      return true;
    })
    .map((key) => index.files.get(key))
    .filter(Boolean) as TreeFile[];

  const deleteFile = async(file: TreeFile) => {
    try {
      const res: any = await TreeFileBackend.deleteFile(storeId, file.key, file.isLeaf);
      if (res.status === "ok" && res.data === true) {
        return true;
      }
      Setting.showMessage("error", `${i18next.t("general:Failed to delete")}: ${res.msg ?? ""}`);
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to delete")}: ${error}`);
    }
    return false;
  };

  const deleteFiles = async(files: TreeFile[]) => {
    const results = await Promise.all(files.map(deleteFile));
    if (results.some(Boolean)) {
      Setting.showMessage("success", i18next.t("general:Successfully deleted"));
      setChecked(new Set());
      setSelectedKey(null);
      onRefresh();
    }
  };

  const uploadFiles = async(folder: TreeFile, files: File[]) => {
    if (files.length === 0) {
      return;
    }
    setExpanded((prev) => new Set(prev).add(folder.key));
    const results = await Promise.all(files.map((file) =>
      TreeFileBackend.addFile(storeId, folder.key, true, file.name, file).catch((error: any) => ({status: "error", msg: String(error)}))));
    const failed = results.filter((res: any) => res.status !== "ok");
    failed.forEach((res: any) => Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`));
    if (failed.length === 0) {
      Setting.showMessage("success", i18next.t("general:Successfully uploaded"));
    }
    onRefresh();
  };

  const addFolder = async(folder: TreeFile) => {
    const name = newFolder.trim();
    if (!name) {
      return;
    }
    try {
      const res: any = await TreeFileBackend.addFile(storeId, folder.key, false, name, null);
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Successfully added"));
        setNewFolder("");
        onRefresh();
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${error}`);
    }
  };

  const pickUpload = (folder: TreeFile, directory: boolean) => {
    uploadTarget.current = folder;
    (directory ? folderInput : fileInput).current?.click();
  };

  const select = (file: TreeFile) => {
    if (!can(file.key, "Read")) {
      Setting.showMessage("error", i18next.t("store:Sorry, you are unauthorized to access this file or folder"));
      return;
    }
    setChecked(new Set());
    setSelectedKey(file.key);
  };

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "Delete" && checked.size > 0 && !["INPUT", "TEXTAREA"].includes(target.tagName) && !target.isContentEditable) {
        e.preventDefault();
        setConfirmDelete(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [checked]);

  const searching = search !== "";
  const visibleRoot = searching ? filterTree(root, search) : root;
  const selected = selectedKey ? index.files.get(selectedKey) ?? null : null;

  const renderPermissions = (file: TreeFile, readable: boolean) => {
    const userId = `${account.owner}/${account.name}`;
    return (permissionMap?.[file.key] ?? [])
      .filter((permission) => readable || permission.users.includes(userId))
      .flatMap((permission) => permission.users.map((user: string) => (
        <Badge
          key={`${permission.name}-${user}`}
          variant={permission.state === "Approved" ? "success" : permission.state === "Pending" ? "outline" : "secondary"}
          className="cursor-pointer px-1.5 py-0 text-[11px] font-normal"
          onClick={(e) => {
            e.stopPropagation();
            Setting.openLink(Setting.getMyProfileUrl(account).replace("/account", `/permissions/${permission.owner}/${permission.name}`));
          }}
        >
          {user.split("/")[1]} · {permission.actions[0]}
        </Badge>
      )));
  };

  const renderNode = (file: TreeFile, depth: number): React.ReactNode => {
    const readable = can(file.key, "Read");
    const writable = can(file.key, "Write");
    const admin = can(file.key, "Admin");
    const isOpen = searching || expanded.has(file.key);
    const children = file.children ?? [];
    const childChecked = !file.isLeaf && children.length > 0 && descendants(file).some((key) => key !== file.key && checked.has(key));
    const checkState = checked.has(file.key) ? true : childChecked ? "indeterminate" : false;
    const dropKey = file.isLeaf ? index.parents.get(file.key) ?? null : file.key;
    const dropFolder = dropKey ? index.files.get(dropKey) : undefined;

    return (
      <div key={file.key}>
        <div
          className={cn(
            "group flex h-8 cursor-pointer items-center gap-1.5 rounded-md pr-1 text-sm hover:bg-accent",
            selectedKey === file.key && "bg-accent font-medium",
            dragOverKey !== null && dragOverKey === dropKey && "bg-primary/10 ring-1 ring-primary/40",
            !readable && !writable && !admin && "text-muted-foreground",
          )}
          style={{paddingLeft: depth * 16 + 4}}
          onClick={() => select(file)}
          onDragOver={(e) => {
            if (dropFolder && can(dropFolder.key, "Write")) {
              e.preventDefault();
              setDragOverKey(dropKey);
            }
          }}
          onDragLeave={() => setDragOverKey(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverKey(null);
            if (dropFolder) {
              uploadFiles(dropFolder, Array.from(e.dataTransfer.files ?? []));
            }
          }}
        >
          {file.isLeaf ? <span className="w-4 shrink-0" /> : (
            <button
              type="button"
              className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground"
              aria-label={isOpen ? "Collapse" : "Expand"}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(file.key)) {
                    next.delete(file.key);
                  } else {
                    next.add(file.key);
                  }
                  return next;
                });
              }}
            >
              <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
            </button>
          )}
          <Checkbox checked={checkState} onClick={(e) => e.stopPropagation()} onCheckedChange={(value) => toggleCheck(file, value === true)} />
          {file.isLeaf
            ? <FileTypeIcon filename={file.title} />
            : isOpen ? <FolderOpen className="h-[18px] w-[18px] shrink-0 text-amber-500" /> : <Folder className="h-[18px] w-[18px] shrink-0 text-amber-500" />}
          <span className="min-w-0 truncate">{file.title}</span>
          {file.isLeaf ? <span className="shrink-0 text-xs text-muted-foreground">{Setting.getFriendlyFileSize(file.size ?? 0)}</span> : null}
          <span className="flex min-w-0 flex-wrap gap-1">{renderPermissions(file, readable)}</span>
          <span className="ml-auto flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {file.isLeaf && readable && file.url ? (
              <IconAction label={i18next.t("general:Download")} onClick={() => Setting.openLink(file.url!)}><Download /></IconAction>
            ) : null}
            {!file.isLeaf && writable ? (
              <>
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="iconSm" className="h-6 w-6" aria-label={i18next.t("store:New folder")} onClick={(e) => e.stopPropagation()}>
                          <FolderPlus />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{i18next.t("store:New folder")}</TooltipContent>
                  </Tooltip>
                  <PopoverContent className="w-64" onClick={(e) => e.stopPropagation()}>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        addFolder(file);
                      }}
                    >
                      <Input autoFocus placeholder={i18next.t("store:New folder")} value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
                      <Button type="submit" disabled={!newFolder.trim()}>{i18next.t("general:OK")}</Button>
                    </form>
                  </PopoverContent>
                </Popover>
                <IconAction label={i18next.t("store:Upload file")} onClick={() => pickUpload(file, false)}><CloudUpload /></IconAction>
                <IconAction label={i18next.t("store:Upload folder")} onClick={() => pickUpload(file, true)}><FolderUp /></IconAction>
              </>
            ) : null}
            {writable && file.key !== root.key ? (
              <span onClick={(e) => e.stopPropagation()}>
                <ConfirmButton variant="ghost" size="iconSm" className="h-6 w-6 text-destructive" aria-label={i18next.t("general:Delete")} destructive description={file.title} onConfirm={() => deleteFiles([file])}>
                  <Trash2 />
                </ConfirmButton>
              </span>
            ) : null}
            <IconAction label={i18next.t(admin ? "store:Add Permission" : "store:Apply for Permission")} onClick={() => addPermission(account, store, admin, [file.key])}>
              <FileCheck2 />
            </IconAction>
          </span>
        </div>
        {!file.isLeaf && isOpen ? children.map((child) => renderNode(child, depth + 1)) : null}
      </div>
    );
  };

  const renderRight = () => {
    if (topChecked.length > 0) {
      const fileCount = topChecked.filter((file) => file.isLeaf).length;
      const folderCount = topChecked.length - fileCount;
      return (
        <div className="flex h-full flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b p-3 text-sm">
            <span className="mr-auto">{fileCount} {i18next.t("store:files and")} {folderCount} {i18next.t("store:folders are checked")}</span>
            <Button size="sm" variant="outline" onClick={() => topChecked.filter((file) => file.isLeaf && file.url).forEach((file) => Setting.openLink(file.url!))}>
              <Download />{i18next.t("general:Download")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)}><Trash2 />{i18next.t("general:Delete")}</Button>
            {isStoreAdmin ? (
              <Button size="sm" variant="outline" onClick={() => addPermission(account, store, true, topChecked.map((file) => file.key))}>
                <FileCheck2 />{i18next.t("store:Add Permission")}
              </Button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1"><FolderTable files={topChecked} onOpen={select} /></div>
        </div>
      );
    }
    if (!selected) {
      return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{i18next.t("store:Please select a file or folder")}</div>;
    }
    if (!selected.isLeaf) {
      return <FolderTable files={selected.children ?? []} onOpen={select} />;
    }
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1"><FilePreview key={selected.key} filename={selected.title} url={selected.url ?? ""} /></div>
        <div className="border-t p-3">
          <DescriptionList
            columns={3}
            items={[
              {label: i18next.t("store:File name"), children: selected.title},
              {label: i18next.t("store:File size"), children: Setting.getFriendlyFileSize(selected.size ?? 0)},
              {label: i18next.t("general:Created time"), children: Setting.getFormattedDate(selected.createdTime)},
            ]}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="grid h-[calc(100vh-10rem)] min-h-[480px] grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,2fr)_5fr]">
      <Card className="flex min-h-0 flex-col overflow-hidden">
        <div className="relative border-b p-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={i18next.t("store:Please input your search term")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedKey(null);
            }}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-1">
          {visibleRoot ? renderNode(visibleRoot, 0) : <p className="p-4 text-center text-sm text-muted-foreground">{i18next.t("general:No data")}</p>}
        </div>
      </Card>
      <Card className="min-h-0 overflow-hidden">{renderRight()}</Card>

      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (uploadTarget.current) {
            uploadFiles(uploadTarget.current, Array.from(e.target.files ?? []));
          }
          e.target.value = "";
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        className="hidden"
        {...{webkitdirectory: "", directory: ""}}
        onChange={(e) => {
          if (uploadTarget.current) {
            uploadFiles(uploadTarget.current, Array.from(e.target.files ?? []));
          }
          e.target.value = "";
        }}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18next.t("general:Confirm deletion")}</AlertDialogTitle>
            <AlertDialogDescription>{i18next.t("store:Are you sure you want to delete the selected items?")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{i18next.t("general:Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteFiles(topChecked.filter((file) => file.key !== root.key))}
            >
              {i18next.t("general:Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
