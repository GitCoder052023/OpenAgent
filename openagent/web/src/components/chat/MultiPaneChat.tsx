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
import {Minus, Plus, Send} from "lucide-react";
import * as ChatBackend from "@/backend/ChatBackend";
import * as MessageBackend from "@/backend/MessageBackend";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {ChatBox} from "@/components/chat/ChatBox";
import {MAX_PANES, providerOption, storeOption, useChildModelProviders} from "@/components/chat/ChatTitleBar";
import {SearchableSelect} from "@/components/common/SearchableSelect";
import {getPendingAnswer, getRefinedErrorText, streamAnswer} from "@/lib/chat-stream";
import * as Setting from "@/lib/setting";
import {isComposing} from "@/lib/utils";

interface Pane {
  chat: any;
  messages: any[] | null;
  loading: boolean;
  error: boolean;
  /** an added pane's chat exists only here until its first message is sent */
  isDraft?: boolean;
}

function newChat(account: any, base: any, store: any) {
  const randomName = Setting.getRandomName();
  return {
    owner: "admin",
    name: `chat_${randomName}`,
    store: store?.name || "",
    createdTime: dayjs().format(),
    updatedTime: dayjs().format(),
    organization: account.owner,
    displayName: `${i18next.t("chat:New Chat")} - ${randomName}`,
    user: account.name,
    category: base?.category || i18next.t("chat:Default Category"),
    clientIp: account.createdIp,
    userAgent: account.education,
    messageCount: 0,
    needTitle: true,
    modelProvider: base?.modelProvider || store?.modelProvider || null,
  };
}

interface MultiPaneChatProps {
  stores: any[];
  account: any;
  initialChat: any;
  paneCount: number;
  onPaneCountChange: (count: number) => void;
  /** the first pane is the page's own chat; its changes go back to the page */
  onChatUpdate: (chat: any) => void;
}

/**
 * The same question to several stores or models side by side, for admins comparing
 * answers. The first pane is the open chat; each extra pane gets a fresh chat.
 */
export function MultiPaneChat({stores, account, initialChat, paneCount, onPaneCountChange, onChatUpdate}: MultiPaneChatProps) {
  const [panes, setPanes] = React.useState<Pane[]>([]);
  const [globalText, setGlobalText] = React.useState("");
  const panesRef = React.useRef(panes);
  panesRef.current = panes;
  const creating = React.useRef(new Map<string, Promise<boolean>>());
  const streams = React.useRef(new Set<() => void>());
  React.useEffect(() => () => streams.current.forEach((stop) => stop()), []);
  const defaultStore = stores.find((store) => store.isDefault);
  const providers = useChildModelProviders(defaultStore, "admin");

  const patchPane = React.useCallback((index: number, patch: Partial<Pane> | ((pane: Pane) => Partial<Pane>)) => {
    setPanes((prev) => prev.map((pane, i) => (i === index ? {...pane, ...(typeof patch === "function" ? patch(pane) : patch)} : pane)));
  }, []);

  // a pane switched to another chat ignores what still arrives for the old one
  const patchChatPane = React.useCallback((index: number, chatName: string, patch: Partial<Pane> | ((pane: Pane) => Partial<Pane>)) => {
    setPanes((prev) => prev.map((pane, i) => (i === index && pane.chat?.name === chatName ? {...pane, ...(typeof patch === "function" ? patch(pane) : patch)} : pane)));
  }, []);

  const load = React.useCallback(async(index: number, chat: any) => {
    const res: any = await MessageBackend.getChatMessages("admin", chat.name);
    const messages = res.data ?? [];
    const patch = (value: Partial<Pane> | ((pane: Pane) => Partial<Pane>)) => patchChatPane(index, chat.name, value);
    const replaceLast = (message: any) => patch((pane) => ({
      messages: pane.messages ? [...pane.messages.slice(0, -1), message] : pane.messages,
    }));
    patch({messages, error: false});
    const pending = getPendingAnswer(messages);
    if (!pending) {
      return;
    }
    if (pending.errorText) {
      patch({error: true});
      return;
    }
    patch({loading: true});
    const stop = streamAnswer(chat, messages, pending, {
      onUpdate: replaceLast,
      onTitle: (title) => patch((pane) => ({chat: {...pane.chat, displayName: title, needTitle: false}})),
      onDone: (message) => {
        streams.current.delete(stop);
        replaceLast(message);
        patch({loading: false});
      },
      onError: (message, error) => {
        streams.current.delete(stop);
        Setting.showMessage("error", getRefinedErrorText(error));
        replaceLast(message);
        patch({loading: false, error: true});
      },
    });
    streams.current.add(stop);
  }, [patchChatPane]);

  // the first pane follows the page's chat; added panes get chats of their own
  React.useEffect(() => {
    if (!initialChat) {
      return;
    }
    const current = panesRef.current;
    const sameChat = current[0]?.chat?.name === initialChat.name;
    const store = stores.find((item) => item.name === initialChat.store);
    const next: Pane[] = [];
    for (let i = 0; i < paneCount; i++) {
      if (i === 0) {
        next.push(sameChat ? {...current[0], chat: initialChat} : {chat: initialChat, messages: null, loading: false, error: false});
      } else if (sameChat && current[i]) {
        next.push(current[i]);
      } else {
        next.push({chat: newChat(account, initialChat, store), messages: [], loading: false, error: false, isDraft: true});
      }
    }
    setPanes(next);
    next.forEach((pane, i) => {
      if (pane.messages === null) {
        load(i, pane.chat);
      }
    });
  }, [paneCount, initialChat?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveChat = (index: number, patch: Record<string, any>) => {
    const chat = {...panesRef.current[index].chat, ...patch};
    patchPane(index, {chat});
    if (index === 0) {
      onChatUpdate(chat);
    }
    if (panesRef.current[index].isDraft) {
      return;
    }
    ChatBackend.updateChat(chat.owner, chat.name, chat).catch((error: any) => {
      Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${error}`);
    });
  };

  // the chat is saved once, however many messages race to be its first
  const ensureChat = (index: number, chat: any) => {
    let pending = creating.current.get(chat.name);
    if (!pending) {
      pending = ChatBackend.addChat(chat).then((res: any) => {
        if (res.status !== "ok") {
          Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
          return false;
        }
        patchChatPane(index, chat.name, {isDraft: false});
        return true;
      }).catch((error: any) => {
        Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
        return false;
      }).then((ok: boolean) => {
        // a failed save may be retried; a saved one is never saved again
        if (!ok) {
          creating.current.delete(chat.name);
        }
        return ok;
      });
      creating.current.set(chat.name, pending);
    }
    return pending;
  };

  const send = async(index: number, text: string, fileName = "", webSearchEnabled = false) => {
    const pane = panesRef.current[index];
    if (!pane?.chat) {
      return;
    }
    if (pane.isDraft && !(await ensureChat(index, pane.chat))) {
      return;
    }
    const store = stores.find((item) => item.name === pane.chat.store);
    const message = {
      owner: "admin",
      name: `message_${Setting.getRandomName()}`,
      createdTime: dayjs().format(),
      organization: account.owner,
      user: account.name,
      store: pane.chat.store,
      chat: pane.chat.name,
      replyTo: "",
      author: account.name,
      text,
      isHidden: false,
      isDeleted: false,
      isAlerted: false,
      isRegenerated: false,
      fileName,
      webSearchEnabled,
      modelProvider: pane.chat.modelProvider || store?.modelProvider || providers[0]?.name || "",
    };
    try {
      const res: any = await MessageBackend.addMessage(message);
      if (res.status === "ok") {
        load(index, pane.chat);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
    }
  };

  const cancel = async(index: number) => {
    const pane = panesRef.current[index];
    const last = pane?.messages?.[pane.messages.length - 1];
    if (!pane?.loading || !last || last.author !== "AI") {
      return;
    }
    MessageBackend.closeMessageEventSource(last.owner, last.name, true);
    const res: any = await MessageBackend.updateMessage(last.owner, last.name, last).catch((error: any) => ({status: "error", msg: String(error)}));
    if (res.status === "ok") {
      patchPane(index, {loading: false});
    } else {
      Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
    }
  };

  const sendToAll = () => {
    const text = globalText.trim();
    if (!text) {
      return;
    }
    panesRef.current.forEach((_pane, index) => send(index, text));
    setGlobalText("");
  };

  const anyLoading = panes.some((pane) => pane.loading);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 gap-0.5 bg-border" style={{gridTemplateColumns: `repeat(${paneCount}, minmax(0, 1fr))`}}>
        {Array.from({length: paneCount}, (_, index) => {
          const pane = panes[index];
          const store = stores.find((item) => item.name === pane?.chat?.store) ?? defaultStore;
          return (
            <div key={index} className="flex min-h-0 flex-col bg-background">
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-2 py-1.5">
                <div className="w-36">
                  <SearchableSelect className="h-8" value={store?.name ?? ""} allowUnknownValue={false} options={stores.map(storeOption)} onChange={(name) => saveChat(index, {store: name, modelProvider: stores.find((item) => item.name === name)?.modelProvider || pane?.chat?.modelProvider})} />
                </div>
                {providers.length > 0 ? (
                  <div className="w-44">
                    <SearchableSelect
                      className="h-8"
                      value={pane?.chat?.modelProvider || store?.modelProvider || providers[0]?.name || ""}
                      allowUnknownValue={false}
                      options={providers.map(providerOption)}
                      onChange={(name) => saveChat(index, {modelProvider: name})}
                    />
                  </div>
                ) : null}
                {index === 0 ? (
                  <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    {i18next.t("chat:Panes")}: {paneCount}
                    <Button variant="outline" size="iconSm" className="h-7 w-7" aria-label="+" disabled={paneCount >= MAX_PANES} onClick={() => onPaneCountChange(paneCount + 1)}><Plus /></Button>
                    <Button variant="outline" size="iconSm" className="h-7 w-7" aria-label="-" disabled={paneCount <= 1} onClick={() => onPaneCountChange(paneCount - 1)}><Minus /></Button>
                  </div>
                ) : null}
              </div>
              <div className="min-h-0 flex-1">
                <ChatBox
                  messages={pane?.messages ?? []}
                  loading={Boolean(pane?.loading)}
                  messageError={Boolean(pane?.error)}
                  store={store}
                  chat={pane?.chat}
                  account={account}
                  autoFocus={false}
                  sendMessage={(text, fileName, webSearchEnabled) => send(index, text, fileName, webSearchEnabled)}
                  onMessageEdit={() => pane && load(index, pane.chat)}
                  onCancel={() => cancel(index)}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex shrink-0 items-end gap-2 border-t bg-muted/30 p-3">
        <Textarea
          rows={1}
          className="min-h-9 flex-1 resize-none"
          value={globalText}
          disabled={anyLoading}
          placeholder={i18next.t("chat:Send message to all panes...")}
          onChange={(e) => setGlobalText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isComposing(e)) {
              e.preventDefault();
              sendToAll();
            }
          }}
        />
        <Button size="icon" disabled={anyLoading || !globalText.trim()} aria-label={i18next.t("pipe:Send")} onClick={sendToAll}><Send /></Button>
      </div>
    </div>
  );
}
