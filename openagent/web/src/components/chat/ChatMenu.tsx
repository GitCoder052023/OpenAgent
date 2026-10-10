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
import {Check, ChevronDown, LayoutGrid, Loader2, Pencil, Plus, Trash2, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {Input} from "@/components/ui/input";
import {ConfirmButton} from "@/components/common/ConfirmButton";
import * as Setting from "@/lib/setting";
import {cn, isComposing} from "@/lib/utils";

function StatusIndicator({chat}: {chat: any}) {
  if (chat.isGenerating) {
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />;
  }
  return (
    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
      <span className={cn("h-2 w-2 rounded-full border", chat.isUnread ? "border-primary bg-primary" : "border-muted-foreground/30")} />
    </span>
  );
}

interface ChatMenuProps {
  chats: any[];
  selectedName?: string;
  stores: any[];
  /** the store in the URL; new chats go there */
  currentStoreName?: string;
  onSelect: (chat: any) => void;
  onAdd: (store?: any) => void;
  onDelete: (chat: any) => void;
  onRename: (chat: any, displayName: string) => void;
}

/** The signed-in user's chats, grouped by category, and the "New Chat" button. */
export function ChatMenu({chats, selectedName, stores, currentStoreName, onSelect, onAdd, onDelete, onRename}: ChatMenuProps) {
  const [editing, setEditing] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const groups = React.useMemo(() => {
    const map = new Map<string, any[]>();
    chats.filter((chat) => chat.isHidden !== true).forEach((chat) => {
      map.set(chat.category, [...(map.get(chat.category) ?? []), chat]);
    });
    return [...map.entries()];
  }, [chats]);

  // a store of its own chats in the URL wins; otherwise the default store's child stores are offered
  const defaultStore = stores.find((store) => store.isDefault);
  const currentStore = currentStoreName ? stores.find((store) => store.name === currentStoreName) : undefined;
  const childStores = !currentStore && defaultStore?.childStores?.length ? stores.filter((store) => defaultStore.childStores.includes(store.name)) : [];

  const save = (chat: any) => {
    if (editName.trim() && editName !== chat.displayName) {
      onRename(chat, editName.trim());
    }
    setEditing(null);
  };

  const newChatButton = (
    <Button className="w-full shadow-sm" onClick={childStores.length > 0 ? undefined : () => onAdd(currentStore ?? defaultStore)}>
      <Plus />{i18next.t("chat:New Chat")}
      {childStores.length > 0 ? <ChevronDown className="ml-auto" /> : null}
    </Button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        {childStores.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{newChatButton}</DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
              {childStores.map((store) => (
                <DropdownMenuItem key={store.name} onSelect={() => onAdd(store)}>
                  <img src={Setting.getStoreIconUrl(store)} alt="" className="h-4 w-4 rounded object-cover" />
                  {store.displayName || store.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : newChatButton}
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
        {groups.map(([category, items]) => {
          const isCollapsed = collapsed.has(category);
          return (
            <div key={category}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(category)) {
                    next.delete(category);
                  } else {
                    next.add(category);
                  }
                  return next;
                })}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="flex-1 truncate text-left">{category}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isCollapsed && "-rotate-90")} />
              </button>
              {!isCollapsed ? items.map((chat) => {
                const selected = chat.name === selectedName;
                if (editing === chat.name) {
                  return (
                    <div key={chat.name} className="flex items-center gap-1 px-1 py-0.5">
                      <Input
                        autoFocus
                        className="h-8"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (isComposing(e)) {
                            return;
                          }
                          if (e.key === "Enter") {
                            save(chat);
                          } else if (e.key === "Escape") {
                            setEditing(null);
                          }
                        }}
                      />
                      <Button variant="ghost" size="iconSm" aria-label={i18next.t("general:Save")} onClick={() => save(chat)}><Check /></Button>
                      <Button variant="ghost" size="iconSm" aria-label={i18next.t("general:Cancel")} onClick={() => setEditing(null)}><X /></Button>
                    </div>
                  );
                }
                return (
                  <div
                    key={chat.name}
                    role="button"
                    tabIndex={0}
                    title={chat.displayName}
                    className={cn(
                      "group flex h-9 cursor-pointer items-center gap-2 rounded-md pl-3 pr-1 text-sm hover:bg-accent",
                      selected && "bg-accent font-medium",
                    )}
                    onClick={() => onSelect(chat)}
                    onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onSelect(chat)}
                  >
                    <StatusIndicator chat={chat} />
                    <span className="min-w-0 flex-1 truncate">{chat.displayName}</span>
                    <span className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        className="h-7 w-7"
                        aria-label={i18next.t("general:Edit")}
                        onClick={() => {
                          setEditName(chat.displayName);
                          setEditing(chat.name);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <ConfirmButton variant="ghost" size="iconSm" className="h-7 w-7 hover:text-destructive" destructive aria-label={i18next.t("general:Delete")} description={chat.displayName} onConfirm={() => onDelete(chat)}>
                        <Trash2 />
                      </ConfirmButton>
                    </span>
                  </div>
                );
              }) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
