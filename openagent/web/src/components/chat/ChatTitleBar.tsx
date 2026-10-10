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
import {Image, Minus, Plus, Type} from "lucide-react";
import * as ChatBackend from "@/backend/ChatBackend";
import * as ProviderBackend from "@/backend/ProviderBackend";
import {Button} from "@/components/ui/button";
import {Switch} from "@/components/ui/switch";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {ProviderTypeLabel} from "@/components/common/ProviderLogo";
import {SearchableSelect} from "@/components/common/SearchableSelect";
import type {GenerationMode} from "@/lib/chat-stream";
import * as ProviderSetting from "@/lib/provider-setting";
import * as Setting from "@/lib/setting";

export const MAX_PANES = 4;

/** the store a chat (or a chat not started yet) talks to */
export function resolveStore(stores: any[], chat: any, draftStoreName?: string) {
  if (chat) {
    return stores.find((store) => store.name === chat.store) ?? null;
  }
  const current = Setting.getStoreCurrent();
  return (draftStoreName ? stores.find((store) => store.name === draftStoreName) : undefined)
    ?? (current ? stores.find((store) => store.name === current) : undefined)
    ?? stores.find((store) => store.isDefault)
    ?? null;
}

/** The default store's "child model providers", the models a reader may switch between. */
export function useChildModelProviders(defaultStore: any, owner: string, storeProvider?: string) {
  const [providers, setProviders] = React.useState<any[]>([]);
  const children: string[] = defaultStore?.childModelProviders ?? [];
  const key = children.join(",");

  React.useEffect(() => {
    if (children.length === 0) {
      setProviders([]);
      return;
    }
    let cancelled = false;
    ProviderBackend.getProviders(owner).then((res: any) => {
      if (cancelled || res.status !== "ok") {
        return;
      }
      const list = (res.data ?? []).filter((provider: any) => provider.category === "Model" && children.includes(provider.name));
      // the store's own model is always offered, child or not
      if (storeProvider && !list.some((provider: any) => provider.name === storeProvider)) {
        const own = (res.data ?? []).find((provider: any) => provider.name === storeProvider && provider.category === "Model");
        if (own) {
          list.unshift(own);
        }
      }
      setProviders(list);
    });
    return () => {
      cancelled = true;
    };
  }, [key, owner, storeProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  return providers;
}

export function providerOption(provider: any) {
  return {
    value: provider.name,
    keywords: `${provider.name} ${provider.displayName ?? ""}`,
    label: <ProviderTypeLabel category={provider.category} type={provider.type} text={ProviderSetting.getProviderDisplayName(provider)} />,
  };
}

export function storeOption(store: any) {
  return {
    value: store.name,
    keywords: `${store.name} ${store.displayName ?? ""}`,
    label: (
      <span className="flex min-w-0 items-center gap-2">
        <img src={Setting.getStoreIconUrl(store)} alt="" className="h-[18px] w-[18px] shrink-0 rounded object-cover" />
        <span className="truncate">{store.displayName || store.name}</span>
      </span>
    ),
  };
}

interface ChatTitleBarProps {
  chat: any;
  stores: any[];
  account: any;
  draftStoreName?: string;
  /** the model picked for a chat not started yet */
  draftProvider?: string | null;
  onDraftStoreChange: (storeName: string) => void;
  onDraftProviderChange: (providerName: string) => void;
  /** the chat was saved with a new store or model */
  onChatUpdated: (chat: any) => void;
  generationMode: GenerationMode;
  onGenerationModeChange: (mode: GenerationMode) => void;
  autoRead: boolean;
  onAutoReadChange: (value: boolean) => void;
  paneCount: number;
  onPaneCountChange: (count: number) => void;
  leading?: React.ReactNode;
}

/** The store, mode and model of the open chat, and the multi-pane controls for admins. */
export function ChatTitleBar(props: ChatTitleBarProps) {
  const {chat, stores, account, generationMode} = props;
  const [updating, setUpdating] = React.useState(false);
  const [, setCurrentStoreVersion] = React.useState(0);

  // the header's store picker changes which store a new chat goes to
  React.useEffect(() => {
    const onChange = () => setCurrentStoreVersion((v) => v + 1);
    window.addEventListener("storeChanged", onChange);
    return () => window.removeEventListener("storeChanged", onChange);
  }, []);

  const defaultStore = stores.find((store) => store.isDefault);
  const storeInfo = resolveStore(stores, chat, props.draftStoreName);
  const providers = useChildModelProviders(defaultStore, chat?.owner || account?.owner || "admin", storeInfo?.modelProvider);
  const modeProviders = providers.filter((provider) => (generationMode === "image") === Boolean(ProviderSetting.isImageGenerationModelProvider(provider)));
  const selectedProvider = (chat ? chat.modelProvider : props.draftProvider) || storeInfo?.modelProvider || modeProviders[0]?.name || "";

  // only the default store's child stores are on offer, plus the one in use
  const storeOptions = React.useMemo(() => {
    const children: string[] = defaultStore?.childStores ?? [];
    const list = children.length > 0 ? stores.filter((store) => children.includes(store.name)) : [];
    if (storeInfo && !list.some((store) => store.name === storeInfo.name)) {
      list.unshift(storeInfo);
    }
    return list;
  }, [stores, defaultStore, storeInfo]);

  const saveChat = async(patch: Record<string, any>) => {
    if (!chat || updating) {
      return;
    }
    setUpdating(true);
    const next = {...chat, ...patch};
    try {
      const res: any = await ChatBackend.updateChat(next.owner, next.name, next);
      if (res.status !== "ok") {
        throw new Error(res.msg);
      }
      props.onChatUpdated(next);
    } catch (error: any) {
      Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${error?.message ?? error}`);
    } finally {
      setUpdating(false);
    }
  };

  const changeStore = (name: string) => {
    const store = stores.find((item) => item.name === name);
    if (!store) {
      return;
    }
    if (!chat) {
      props.onDraftStoreChange(store.name);
      return;
    }
    saveChat({store: store.name, modelProvider: store.modelProvider || chat.modelProvider});
  };

  const changeProvider = (name: string) => {
    if (!chat) {
      props.onDraftProviderChange(name);
      return;
    }
    saveChat({modelProvider: name});
  };

  // a mode switch to one without the current model moves to that mode's first model
  React.useEffect(() => {
    if (updating || modeProviders.length === 0 || modeProviders.some((provider) => provider.name === selectedProvider)) {
      return;
    }
    changeProvider(modeProviders[0].name);
  }, [generationMode, modeProviders.map((p) => p.name).join(","), selectedProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  const canManagePanes = Setting.isLocalAdminUser(account);
  if (!storeInfo && providers.length === 0 && !canManagePanes) {
    return props.leading ? <div className="flex h-12 items-center border-b px-2">{props.leading}</div> : null;
  }

  const label = (key: string) => <span className="hidden text-xs font-medium text-muted-foreground md:inline">{i18next.t(key)}</span>;

  return (
    <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-1.5 border-b bg-muted/30 px-2 py-1.5">
      {props.leading}
      {storeInfo ? (
        <div className="flex items-center gap-2">
          {label("general:Store")}
          <div className="w-40 md:w-48">
            <SearchableSelect
              className="h-8 rounded-full"
              value={storeInfo.name}
              disabled={updating || storeOptions.length < 2}
              allowUnknownValue={false}
              options={storeOptions.map(storeOption)}
              onChange={changeStore}
            />
          </div>
        </div>
      ) : null}

      {providers.length > 0 ? (
        <>
          <div className="flex items-center gap-2">
            {label("chat:Mode")}
            <Tabs value={generationMode} onValueChange={(value) => props.onGenerationModeChange(value as GenerationMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="text" className="gap-1 px-2.5 text-xs" disabled={updating}><Type className="h-3.5 w-3.5" />{i18next.t("general:Text")}</TabsTrigger>
                <TabsTrigger value="image" className="gap-1 px-2.5 text-xs" disabled={updating}><Image className="h-3.5 w-3.5" />{i18next.t("general:Image")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2">
            {label("general:Model")}
            {modeProviders.length === 0 ? (
              <span className="text-[13px] text-muted-foreground">{i18next.t("chat:No models for this mode")}</span>
            ) : (
              <div className="w-48 md:w-60">
                <SearchableSelect className="h-8 rounded-full" value={selectedProvider} disabled={updating} allowUnknownValue={false} options={modeProviders.map(providerOption)} onChange={changeProvider} />
              </div>
            )}
          </div>
        </>
      ) : null}

      {storeInfo?.showAutoRead ? (
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {i18next.t("store:Auto read")}
          <Switch checked={props.autoRead} onCheckedChange={props.onAutoReadChange} />
        </label>
      ) : null}

      {canManagePanes ? (
        <div className="ml-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {i18next.t("chat:Panes")}: {props.paneCount}
          <Button variant="outline" size="iconSm" className="h-7 w-7 rounded-full" aria-label="+" disabled={props.paneCount >= MAX_PANES} onClick={() => props.onPaneCountChange(props.paneCount + 1)}><Plus /></Button>
          <Button variant="outline" size="iconSm" className="h-7 w-7 rounded-full" aria-label="-" disabled={props.paneCount <= 1} onClick={() => props.onPaneCountChange(props.paneCount - 1)}><Minus /></Button>
        </div>
      ) : null}
    </div>
  );
}
