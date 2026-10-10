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
import {Menu, PanelLeftClose, PanelLeftOpen, XCircle} from "lucide-react";
import {useNavigate, useParams, useSearchParams} from "react-router-dom";
import * as ChatBackend from "@/backend/ChatBackend";
import * as MessageBackend from "@/backend/MessageBackend";
import * as StoreBackend from "@/backend/StoreBackend";
import {AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle} from "@/components/ui/alert-dialog";
import {Button} from "@/components/ui/button";
import {Sheet, SheetContent, SheetTitle} from "@/components/ui/sheet";
import {ChatBox, type ChatBoxHandle} from "@/components/chat/ChatBox";
import {ChatMenu} from "@/components/chat/ChatMenu";
import {ChatTitleBar, resolveStore} from "@/components/chat/ChatTitleBar";
import {MultiPaneChat} from "@/components/chat/MultiPaneChat";
import {Loading} from "@/components/common/Loading";
import {useAccount} from "@/hooks/use-account";
import {useIsMobile} from "@/hooks/use-mobile";
import {getPendingAnswer, loadGenerationMode, saveGenerationMode, streamAnswer, type GenerationMode} from "@/lib/chat-stream";
import * as Setting from "@/lib/setting";

const STATUS_POLL_MS = 2000;

function readMenuCollapsed() {
  try {
    return JSON.parse(localStorage.getItem("chatMenuCollapsed") ?? "false") === true;
  } catch {
    return false;
  }
}

/** The default account password must be changed before anything else. */
function UnsafePasswordDialog({account}: {account: any}) {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-destructive" />{i18next.t("account:Please Modify Your Password")}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>{i18next.t("account:The system has detected that you are using the default password, which is not secure. You need to modify your password immediately. Here are the instructions")}:</p>
              <p>{i18next.t("account:1. Go to your setting page by clicking on the below \"My Account\" button.")}</p>
              <p>{i18next.t("account:2. Click \"Modify password...\" button to change your password. Then close the setting page.")}</p>
              <p>{i18next.t("account:3. Go back to this page and refresh it by pressing F5 key. This alert message should be gone.")}</p>
              <p>{i18next.t("account:4. If you encounter any issues, please contact your administrator.")}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-center pt-2">
          <Button onClick={() => Setting.openLink(Setting.isBasicLoginMode(account) ? "/account" : Setting.getMyProfileUrl(account))}>{i18next.t("account:My Account")}</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The chat. On an agent's page it is embedded with that agent's store: it then
 * keeps the chosen chat to itself instead of moving the page to the chat's URL.
 */
export default function ChatPage({embeddedStore}: {embeddedStore?: string} = {}) {
  const params = useParams();
  const chatName = embeddedStore ? undefined : params.chatName;
  const urlStore = embeddedStore ?? params.storeName;
  const [searchParams] = useSearchParams();
  const isRaw = searchParams.get("isRaw") !== null;
  // embedded, or in the bare ?isRaw page another site frames, the URL stays as it was opened
  const keepsUrl = Boolean(embeddedStore) || isRaw;
  const routerNavigate = useNavigate();
  const navigate = React.useCallback((to: string, options?: {replace?: boolean}) => {
    if (!keepsUrl) {
      routerNavigate(to, options);
    }
  }, [keepsUrl, routerNavigate]);
  const {account} = useAccount();
  const isMobile = useIsMobile();

  // a store in the URL becomes the selected store; otherwise the remembered one is kept.
  // An agent's page only borrows the chat, so it leaves the selection alone.
  const [storeName, setStoreName] = React.useState(() => urlStore || Setting.getStoreCurrent() || "");
  React.useEffect(() => {
    // setStore tells every store listener at once, so it waits until this render is done
    if (urlStore && !embeddedStore) {
      Setting.setStore(urlStore);
    }
  }, [urlStore, embeddedStore]);

  const [chats, setChats] = React.useState<any[] | null>(null);
  const [chat, setChat] = React.useState<any>(undefined);
  const [messages, setMessages] = React.useState<any[] | null>(null);
  const [messageLoading, setMessageLoading] = React.useState(false);
  const [messageError, setMessageError] = React.useState(false);
  const [stores, setStores] = React.useState<any[]>([]);
  const [draftStoreName, setDraftStoreName] = React.useState<string | undefined>(storeName || undefined);
  const [draftModelProvider, setDraftModelProvider] = React.useState<string | null>(null);
  const [generationMode, setGenerationMode] = React.useState<GenerationMode>("text");
  const [autoRead, setAutoRead] = React.useState(false);
  const [paneCount, setPaneCount] = React.useState(1);
  const [menuCollapsed, setMenuCollapsed] = React.useState(readMenuCollapsed);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const chatBox = React.useRef<ChatBoxHandle>(null);
  const urlMessageSent = React.useRef(false);
  // answers still streaming when the page goes away are let go; coming back picks them up again
  const streams = React.useRef(new Set<() => void>());
  React.useEffect(() => () => streams.current.forEach((stop) => stop()), []);

  // stream callbacks and polling outlive renders, so they read the latest state through refs
  const chatRef = React.useRef<any>(undefined);
  chatRef.current = chat;
  const chatsRef = React.useRef<any[] | null>(null);
  chatsRef.current = chats;
  const autoReadRef = React.useRef(autoRead);
  autoReadRef.current = autoRead;

  const chatUrl = React.useCallback((name?: string, store?: string) => {
    if (!urlStore) {
      return name ? `/chat/${name}` : "/chat";
    }
    const target = store || urlStore;
    return name ? `/admin/${target}/chat/${name}` : `/admin/${target}/chat`;
  }, [urlStore]);

  const patchChat = React.useCallback((name: string, patch: Record<string, any>) => {
    setChats((prev) => prev?.map((item) => (item.name === name ? {...item, ...patch} : item)) ?? prev);
    setChat((prev: any) => (prev?.name === name ? {...prev, ...patch} : prev));
  }, []);

  const markRead = React.useCallback((target: any) => {
    if (!target?.isUnread || target.isGenerating) {
      return;
    }
    ChatBackend.updateChat(target.owner, target.name, {...target, isUnread: false}).then((res: any) => {
      if (res.status === "ok") {
        patchChat(target.name, {isUnread: false});
      }
    }).catch((error: any) => Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${error}`));
  }, [patchChat]);

  const isCurrent = (target: any) => chatRef.current?.name === target?.name;

  const loadMessages = React.useCallback(async(target: any, options: {skipPending?: boolean} = {}) => {
    setMessageError(false);
    const res: any = await MessageBackend.getChatMessages("admin", target.name);
    if (!isCurrent(target)) {
      return;
    }
    const list: any[] = res.data ?? [];
    setMessages(list);
    markRead(target);
    const pending = getPendingAnswer(list);
    if (!pending) {
      setMessageLoading(false);
      return;
    }
    if (options.skipPending || pending.errorText) {
      setMessageLoading(false);
      setMessageError(Boolean(pending.errorText));
      return;
    }
    setMessageLoading(true);
    const replaceLast = (message: any) => {
      if (isCurrent(target)) {
        setMessages((prev) => (prev ? [...prev.slice(0, -1), message] : prev));
      }
    };
    const finish = () => {
      patchChat(target.name, {isGenerating: false});
      const latest = chatsRef.current?.find((item) => item.name === target.name);
      if (latest && isCurrent(target)) {
        markRead({...latest, isGenerating: false});
      }
    };
    const stop = streamAnswer(target, list, pending, {
      onUpdate: replaceLast,
      onTitle: (title) => patchChat(target.name, {displayName: title, needTitle: false}),
      onDone: (message) => {
        streams.current.delete(stop);
        finish();
        if (!isCurrent(target)) {
          return;
        }
        replaceLast(message);
        setMessageLoading(false);
        setMessageError(false);
        if (autoReadRef.current) {
          chatBox.current?.read(message);
        }
      },
      onError: (message) => {
        streams.current.delete(stop);
        finish();
        if (!isCurrent(target)) {
          return;
        }
        replaceLast(message);
        setMessageLoading(false);
        setMessageError(true);
      },
    });
    streams.current.add(stop);
  }, [markRead, patchChat]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = React.useCallback((target: any, replace = false) => {
    chatRef.current = target;
    setChat(target);
    setMessages([]);
    setMessageError(false);
    setMessageLoading(false);
    setDraftStoreName(target.store);
    setGenerationMode(loadGenerationMode(target.owner, target.name));
    setMenuOpen(false);
    navigate(chatUrl(target.name, target.store), {replace});
    loadMessages(target);
  }, [chatUrl, loadMessages, navigate]);

  const fetchChats = React.useCallback(async() => {
    if (!account) {
      return [];
    }
    const res: any = await ChatBackend.getChats(account.name, storeName, -1, -1, "user", account.name, "", "");
    if (res.status !== "ok") {
      Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      return null;
    }
    setChats(res.data ?? []);
    return res.data ?? [];
  }, [account, storeName]);

  // without a store in the URL, the header's store picker scopes the chat list
  React.useEffect(() => {
    if (urlStore) {
      return;
    }
    const onChange = () => setStoreName(Setting.getStoreCurrent() || "");
    window.addEventListener("storeChanged", onChange);
    return () => window.removeEventListener("storeChanged", onChange);
  }, [urlStore]);

  const listedStore = React.useRef(storeName);
  React.useEffect(() => {
    if (listedStore.current === storeName) {
      return;
    }
    listedStore.current = storeName;
    if (!chatRef.current) {
      setDraftStoreName(storeName || undefined);
      setDraftModelProvider(null);
    }
    fetchChats();
  }, [storeName, fetchChats]);

  // first load: the chat in the URL, else the newest one
  React.useEffect(() => {
    StoreBackend.getGlobalStores().then((res: any) => {
      if (res.status === "ok") {
        setStores(res.data ?? []);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
      }
    });
    fetchChats().then((list) => {
      if (!list) {
        setChats([]);
        return;
      }
      // a question in the URL starts a chat of its own
      const newMessage = searchParams.get("newMessage");
      if (newMessage?.trim()) {
        setMessages([]);
        if (!urlMessageSent.current) {
          urlMessageSent.current = true;
          sendMessageRef.current(newMessage, "", false);
        }
        return;
      }
      const target = (chatName && list.find((item: any) => item.name === chatName)) || list[0];
      if (target) {
        select(target, target.name !== chatName);
      } else {
        setMessages([]);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // back and forward move between chats
  React.useEffect(() => {
    if (!chats || !chatName || chatName === chatRef.current?.name) {
      return;
    }
    const target = chats.find((item) => item.name === chatName);
    if (target) {
      select(target, true);
    }
  }, [chatName]); // eslint-disable-line react-hooks/exhaustive-deps

  // a chat answering in the background is watched until it finishes
  React.useEffect(() => {
    const polling = new Set<string>();
    let errorShown = false;
    const timer = window.setInterval(() => {
      (chatsRef.current ?? []).filter((item) => item.isGenerating).forEach((item) => {
        const key = `${item.owner}/${item.name}`;
        if (polling.has(key)) {
          return;
        }
        polling.add(key);
        ChatBackend.getChatStatus(item.owner, item.name).then((res: any) => {
          if (res.status !== "ok") {
            if (!errorShown) {
              Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
              errorShown = true;
            }
            return;
          }
          errorShown = false;
          const status = res.data;
          const finished = !status.isGenerating;
          if (finished && isCurrent(item)) {
            setMessageLoading(false);
            loadMessages({...item, ...status}, {skipPending: true});
            if (status.isUnread) {
              markRead({...item, ...status});
              return;
            }
          }
          if (status.isGenerating !== item.isGenerating || status.isUnread !== item.isUnread) {
            patchChat(item.name, {isGenerating: status.isGenerating, isUnread: status.isUnread});
          }
        }).catch((error: any) => {
          if (!errorShown) {
            Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${error}`);
            errorShown = true;
          }
        }).finally(() => polling.delete(key));
      });
    }, STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadMessages, markRead, patchChat]); // eslint-disable-line react-hooks/exhaustive-deps

  // the first pane may have been chatted in, so the single view reloads when the panes close
  const previousPaneCount = React.useRef(paneCount);
  React.useEffect(() => {
    if (previousPaneCount.current > 1 && paneCount === 1 && chatRef.current) {
      loadMessages(chatRef.current);
    }
    previousPaneCount.current = paneCount;
  }, [paneCount, loadMessages]);

  const defaultStore = stores.find((store) => store.isDefault);
  const currentStore = chat ? resolveStore(stores, chat) : resolveStore(stores, null, draftStoreName || storeName || undefined);

  const sendMessage = async(text: string, fileName: string, webSearchEnabled: boolean) => {
    if (!account) {
      return;
    }
    const current = chatRef.current;
    const message: any = {
      owner: "admin",
      name: `message_${Setting.getRandomName()}`,
      createdTime: dayjs().format(),
      organization: account.owner,
      store: current?.store,
      user: account.name,
      chat: current?.name,
      replyTo: "",
      author: account.name,
      text,
      isHidden: false,
      isDeleted: false,
      isAlerted: false,
      isRegenerated: false,
      fileName,
      webSearchEnabled,
      modelProvider: current?.modelProvider,
    };
    if (!current) {
      message.store = draftStoreName || storeName || urlStore || undefined;
      if (draftModelProvider) {
        message.modelProvider = draftModelProvider;
      }
    }
    if (!message.modelProvider) {
      message.modelProvider = message.store ? stores.find((store) => store.name === message.store)?.modelProvider : defaultStore?.modelProvider;
    }

    setMessageLoading(true);
    try {
      const res: any = await MessageBackend.addMessage(message);
      if (res.status !== "ok") {
        setMessageLoading(false);
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
        return;
      }
      // a first message creates the chat; the model picked for the draft is kept on it
      const created = res.data;
      if (draftModelProvider) {
        created.modelProvider = draftModelProvider;
        await ChatBackend.updateChat(created.owner, created.name, created).catch(() => undefined);
      }
      saveGenerationMode(created.owner, created.name, generationMode);
      chatRef.current = created;
      setChat(created);
      setDraftStoreName(created.store);
      setDraftModelProvider(null);
      navigate(chatUrl(created.name, created.store));
      fetchChats();
      loadMessages(created);
    } catch (error) {
      setMessageLoading(false);
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
    }
  };
  const sendMessageRef = React.useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  const cancel = async() => {
    const last = messages?.[messages.length - 1];
    if (!last || last.author !== "AI" || !messageLoading) {
      return;
    }
    MessageBackend.closeMessageEventSource(last.owner, last.name, true);
    try {
      const res: any = await MessageBackend.updateMessage(last.owner, last.name, last);
      if (res.status !== "ok") {
        Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
        return;
      }
      setMessageLoading(false);
      if (chat) {
        patchChat(chat.name, {isGenerating: false});
        const latest = chatsRef.current?.find((item) => item.name === chat.name);
        if (latest) {
          markRead({...latest, isGenerating: false});
        }
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
    }
  };

  const addChat = (store?: any) => {
    const target = store?.name || storeName || urlStore || defaultStore?.name || "";
    navigate(chatUrl(undefined, target));
    chatRef.current = undefined;
    setChat(undefined);
    setMessages([]);
    setMessageError(false);
    setMessageLoading(false);
    setMenuOpen(false);
    setDraftStoreName(target);
    setDraftModelProvider(null);
    setGenerationMode("text");
    requestAnimationFrame(() => chatBox.current?.focus());
  };

  const deleteChat = async(target: any) => {
    try {
      const res: any = await ChatBackend.deleteChat(target);
      if (res.status !== "ok") {
        Setting.showMessage("error", `${i18next.t("general:Failed to delete")}: ${res.msg}`);
        return;
      }
      Setting.showMessage("success", i18next.t("general:Successfully deleted"));
      const list = chats ?? [];
      const index = list.findIndex((item) => item.name === target.name);
      const rest = list.filter((item) => item.name !== target.name);
      setChats(rest);
      if (!isCurrent(target)) {
        return;
      }
      const next = rest[Math.min(index, rest.length - 1)];
      if (next) {
        select(next);
      } else {
        chatRef.current = undefined;
        setChat(undefined);
        setMessages([]);
        navigate(chatUrl());
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
    }
  };

  const renameChat = async(target: any, displayName: string) => {
    const res: any = await ChatBackend.updateChat("admin", target.name, {...target, displayName}).catch((error: any) => ({status: "error", msg: String(error)}));
    if (res.status === "ok") {
      patchChat(target.name, {displayName});
      Setting.showMessage("success", i18next.t("general:Successfully saved"));
    } else {
      Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
    }
  };

  const onChatUpdated = (updated: any) => {
    patchChat(updated.name, updated);
    if (updated.store !== chatRef.current?.store) {
      navigate(chatUrl(updated.name, updated.store), {replace: true});
    }
  };

  if (!account || chats === null) {
    return <Loading className="h-full" />;
  }

  const menu = (
    <ChatMenu
      chats={chats}
      selectedName={chat?.name}
      stores={stores}
      currentStoreName={storeName || undefined}
      onSelect={(target) => select(target)}
      onAdd={addChat}
      onDelete={deleteChat}
      onRename={renameChat}
    />
  );

  const menuToggle = isRaw ? null : isMobile ? (
    <Button variant="ghost" size="iconSm" aria-label={i18next.t("general:Chats")} onClick={() => setMenuOpen(true)}><Menu /></Button>
  ) : (
    <Button
      variant="ghost"
      size="iconSm"
      aria-label={i18next.t("general:Chats")}
      onClick={() => {
        const next = !menuCollapsed;
        setMenuCollapsed(next);
        localStorage.setItem("chatMenuCollapsed", JSON.stringify(next));
      }}
    >
      {menuCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
    </Button>
  );

  const multiPane = paneCount > 1 && chat;

  return (
    <div className="flex h-full min-h-0">
      {account.password === "#NeedToModify#" ? <UnsafePasswordDialog account={account} /> : null}

      {!isMobile && !isRaw && !menuCollapsed ? <aside className="w-64 shrink-0 border-r bg-muted/30">{menu}</aside> : null}
      {isMobile ? (
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">{i18next.t("general:Chats")}</SheetTitle>
            <div className="h-full pt-10">{menu}</div>
          </SheetContent>
        </Sheet>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {!multiPane ? (
          <ChatTitleBar
            chat={chat}
            stores={stores}
            account={account}
            draftStoreName={draftStoreName}
            draftProvider={draftModelProvider}
            onDraftStoreChange={(name) => {
              setDraftStoreName(name);
              setDraftModelProvider(null);
            }}
            onDraftProviderChange={setDraftModelProvider}
            onChatUpdated={onChatUpdated}
            generationMode={generationMode}
            onGenerationModeChange={(mode) => {
              setGenerationMode(mode);
              saveGenerationMode(chat?.owner, chat?.name, mode);
            }}
            autoRead={autoRead}
            onAutoReadChange={setAutoRead}
            paneCount={paneCount}
            onPaneCountChange={setPaneCount}
            leading={menuToggle}
          />
        ) : null}
        <div className="min-h-0 flex-1">
          {multiPane ? (
            <MultiPaneChat
              stores={stores}
              account={account}
              initialChat={chat}
              paneCount={paneCount}
              onPaneCountChange={setPaneCount}
              onChatUpdate={(updated) => patchChat(updated.name, updated)}
            />
          ) : (
            <ChatBox
              ref={chatBox}
              messages={messages}
              loading={messageLoading}
              messageError={messageError}
              store={currentStore}
              chat={chat}
              account={account}
              showVirtualFigure
              autoFocus={!embeddedStore}
              sendMessage={sendMessage}
              onMessageEdit={(updated) => {
                patchChat(updated.name, updated);
                fetchChats();
                loadMessages(updated);
              }}
              onCancel={cancel}
              onStoreUpdate={(updated) => setStores((prev) => prev.map((store) => (store.owner === updated.owner && store.name === updated.name ? updated : store)))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
