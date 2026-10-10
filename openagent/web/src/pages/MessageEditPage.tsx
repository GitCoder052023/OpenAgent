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
import {Link, useParams} from "react-router-dom";
import * as ChatBackend from "@/backend/ChatBackend";
import * as MessageBackend from "@/backend/MessageBackend";
import * as ProviderBackend from "@/backend/ProviderBackend";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {SimpleEditPage, type EditField} from "@/components/crud/SimpleEditPage";
import {useAccount} from "@/hooks/use-account";
import * as ProviderSetting from "@/lib/provider-setting";
import {isApiChat} from "@/lib/chat";

function textArea(name: string, labelKey: string): EditField {
  return {type: "textarea", name, labelKey, rows: 4, block: true};
}

export default function MessageEditPage() {
  const {messageName = ""} = useParams();
  const {account} = useAccount();
  const [providers, setProviders] = React.useState<any[]>([]);
  const [messages, setMessages] = React.useState<any[]>([]);
  const [chat, setChat] = React.useState<any>(null);

  React.useEffect(() => {
    ProviderBackend.getProviders("admin").then((res: any) => {
      if (res.status === "ok") {
        setProviders((res.data ?? []).filter((provider: any) => provider.category === "Model"));
      }
    });
  }, []);

  React.useEffect(() => {
    if (!account) {
      return;
    }
    // the messages a reply can point at
    MessageBackend.getMessages(account.name).then((res: any) => {
      if (res.status === "ok") {
        setMessages(res.data ?? []);
      }
    });
  }, [account]);

  const fields: EditField[] = [
    {type: "text", name: "name", labelKey: "general:Name", required: true},
    {type: "text", name: "user", labelKey: "general:User"},
    {
      type: "custom",
      name: "chat",
      labelKey: "general:Chat",
      render: (ctx) => (
        <Button variant="outline" asChild>
          <Link to={`/chats/${ctx.record.chat}`}>{ctx.record.chat}</Link>
        </Button>
      ),
    },
    {
      type: "select",
      name: "author",
      labelKey: "general:Author",
      // the author is one of the chat's participants
      options: () => (chat?.users ?? []).map((user: string) => ({value: user, label: user})),
    },
    {
      type: "select",
      name: "modelProvider",
      labelKey: "provider:Model provider",
      options: () => providers.map((provider) => ({
        value: provider.name,
        keywords: provider.name,
        label: (
          <span className="inline-flex items-center gap-2">
            <img src={ProviderSetting.getProviderLogoURL({category: provider.category, type: provider.type})} alt="" className="h-5 w-5 object-contain" />
            {provider.name}
          </span>
        ),
      })),
    },
    {type: "select", name: "replyTo", labelKey: "message:Reply to", options: () => messages.map((message) => ({value: message.name, label: message.name}))},
    textArea("reasonText", "general:Reasoning text"),
    textArea("text", "general:Text"),
    textArea("errorText", "message:Error text"),
    {
      ...textArea("comment", "message:Comment"),
      // a comment is something the user should hear about
      onChange: (value, _ctx, updateFields) => updateFields({comment: value, needNotify: value !== ""}),
    },
    {
      type: "custom",
      name: "data",
      labelKey: "general:Data",
      block: true,
      when: (ctx) => Array.isArray(ctx.record.data) && ctx.record.data.length > 0,
      render: (ctx) => <Textarea rows={3} disabled value={JSON.stringify(ctx.record.data)} className="font-mono text-xs" />,
    },
    {type: "switch", name: "needNotify", labelKey: "message:Need notify"},
    {type: "switch", name: "isDeleted", labelKey: "general:Is deleted"},
    {type: "switch", name: "isAlerted", labelKey: "general:Is alerted"},
  ];

  return (
    <SimpleEditPage
      titleKey="message:Edit Message"
      backTo="/messages"
      deps={[messageName]}
      fields={fields}
      fetch={async() => {
        const res: any = await MessageBackend.getMessage("admin", messageName);
        if (res.status === "ok" && res.data) {
          ChatBackend.getChat(res.data.owner, res.data.chat).then((chatRes: any) => chatRes.status === "ok" && setChat(chatRes.data));
        }
        return res;
      }}
      // what was logged from the API, or said in an API chat, is a record and stays as it was
      readOnly={(record) => record.isReadOnly === true || isApiChat(chat)}
      add={(record) => MessageBackend.addMessage(record)}
      remove={(record) => MessageBackend.deleteMessage(record)}
      update={(record) => MessageBackend.updateMessage(record.owner, messageName, record)}
      editUrl={(record) => `/messages/${record.name}`}
      extraActions={(ctx) => (ctx.mode === "view" ? (
        <span className="flex gap-1">
          <Badge variant="info">{i18next.t("general:API")}</Badge>
          <Badge variant="outline">{i18next.t("general:Read-only")}</Badge>
        </span>
      ) : null)}
    />
  );
}
