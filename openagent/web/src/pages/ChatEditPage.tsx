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
import {useParams} from "react-router-dom";
import * as ChatBackend from "@/backend/ChatBackend";
import * as MessageBackend from "@/backend/MessageBackend";
import * as ProviderBackend from "@/backend/ProviderBackend";
import {Badge} from "@/components/ui/badge";
import {MessageTranscript} from "@/components/chat/MessageTranscript";
import {Loading} from "@/components/common/Loading";
import {FormRow} from "@/components/crud/FormRow";
import {SimpleEditPage, type EditField} from "@/components/crud/SimpleEditPage";
import * as ProviderSetting from "@/lib/provider-setting";
import {isApiChat} from "@/lib/chat";

function ChatMessages({chatName}: {chatName: string}) {
  const [messages, setMessages] = React.useState<any[] | null>(null);
  React.useEffect(() => {
    MessageBackend.getChatMessages("admin", chatName).then((res: any) => setMessages(res.status === "ok" ? res.data ?? [] : []));
  }, [chatName]);
  if (messages === null) {
    return <Loading />;
  }
  return <MessageTranscript messages={messages} className="h-[800px]" />;
}

export default function ChatEditPage() {
  const {chatName = ""} = useParams();
  const [providers, setProviders] = React.useState<any[]>([]);

  React.useEffect(() => {
    ProviderBackend.getProviders("admin").then((res: any) => {
      if (res.status === "ok") {
        setProviders((res.data ?? []).filter((provider: any) => provider.category === "Model"));
      }
    });
  }, []);

  const fields: EditField[] = [
    {type: "text", name: "name", labelKey: "general:Name", required: true},
    {type: "text", name: "displayName", labelKey: "general:Display name"},
    {type: "text", name: "store", labelKey: "general:Store"},
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
    {type: "text", name: "category", labelKey: "general:Category"},
    {type: "text", name: "user", labelKey: "general:User"},
    {type: "switch", name: "isDeleted", labelKey: "general:Is deleted"},
  ];

  return (
    <SimpleEditPage
      titleKey="chat:Edit Chat"
      backTo="/chats"
      deps={[chatName]}
      fields={fields}
      // a chat logged from the API is a record of what happened, so it opens read-only
      readOnly={isApiChat}
      fetch={() => ChatBackend.getChat("admin", chatName)}
      add={(record) => ChatBackend.addChat(record)}
      remove={(record) => ChatBackend.deleteChat(record)}
      update={(record) => ChatBackend.updateChat(record.owner, chatName, record)}
      editUrl={(record) => `/chats/${record.name}`}
      extraActions={(ctx) => (isApiChat(ctx.record) ? (
        <span className="flex gap-1">
          <Badge variant="info">{i18next.t("general:API")}</Badge>
          <Badge variant="outline">{i18next.t("general:Read-only")}</Badge>
        </span>
      ) : null)}
    >
      {() => (
        <div className="mt-4">
          <FormRow labelKey="general:Messages" block>
            <ChatMessages chatName={chatName} />
          </FormRow>
        </div>
      )}
    </SimpleEditPage>
  );
}
