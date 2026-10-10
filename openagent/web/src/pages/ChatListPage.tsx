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
import dayjs from "dayjs";
import {Download} from "lucide-react";
import {Link} from "react-router-dom";
import * as ChatBackend from "@/backend/ChatBackend";
import * as MessageBackend from "@/backend/MessageBackend";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Switch} from "@/components/ui/switch";
import {MessageTranscript} from "@/components/chat/MessageTranscript";
import {ProviderLogoLink, useProviderMap} from "@/components/common/ProviderLogoLink";
import {UserLabel} from "@/components/common/UserLabel";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {dateColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import {useAccount} from "@/hooks/use-account";
import {useRequestStore} from "@/hooks/use-request-store";
import {isApiChat} from "@/lib/chat";
import * as Setting from "@/lib/setting";

/** A chat's conversation, fetched when its row is shown. */
function ChatMessages({chat, maximized, hidden}: {chat: any; maximized: boolean; hidden: boolean}) {
  const [messages, setMessages] = React.useState<any[] | null>(null);

  React.useEffect(() => {
    // a chat that only holds the greeting has nothing to show
    if (hidden || chat.messageCount <= 1) {
      return;
    }
    let cancelled = false;
    MessageBackend.getChatMessages("admin", chat.name).then((res: any) => {
      if (!cancelled && res.status === "ok") {
        setMessages(res.data ?? []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [chat.name, chat.messageCount, hidden]);

  if (!messages || messages.length === 0) {
    return null;
  }
  return <MessageTranscript messages={messages} className="h-[300px]" style={{width: maximized ? "70vw" : 800}} />;
}

function ClientIpCell({record}: {record: any}) {
  if (!record.clientIp) {
    return null;
  }
  const ipDesc = (record.clientIpDesc ?? "").split(",").map((s: string) => s.trim()).filter(Boolean).join(", ");
  const agent = record.userAgentDesc
    ? record.userAgentDesc.split("|").filter((text: string) => !text.includes("Other") && !text.includes("Generic Smartphone"))
    : (record.userAgent ? [record.userAgent] : []);
  return (
    <a href={`https://db-ip.com/${record.clientIp}`} target="_blank" rel="noreferrer" className="block text-xs underline-offset-4 hover:underline">
      <div className="text-sm">{record.clientIp}</div>
      {ipDesc ? <div className="text-muted-foreground">{ipDesc}</div> : null}
      {agent.map((text: string) => <div key={text} className="text-muted-foreground">{text}</div>)}
    </a>
  );
}

function SummaryBadge({label, value}: {label: string; value: React.ReactNode}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <Badge variant="secondary" className="font-semibold tabular-nums">{value}</Badge>
    </span>
  );
}

export default function ChatListPage() {
  const {account} = useAccount();
  const store = useRequestStore();
  const isAdmin = account?.name === "admin";
  const isLocalAdmin = Setting.isLocalAdminUser(account);
  const providerMap = useProviderMap();
  const [maximized, setMaximized] = React.useState(() => Setting.getBoolValue("maximizeMessages", false));
  const [pageRows, setPageRows] = React.useState<any[]>([]);
  const [downloading, setDownloading] = React.useState(false);
  const lastQuery = React.useRef<any>(null);
  const totalRef = React.useRef(0);

  const newChat = () => {
    const randomName = Setting.getRandomName();
    return {
      owner: "admin",
      name: `chat_${randomName}`,
      createdTime: dayjs().format(),
      updatedTime: dayjs().format(),
      organization: account?.owner,
      displayName: `${i18next.t("chat:New Chat")} - ${randomName}`,
      category: i18next.t("chat:Default Category"),
      user: account?.name,
      clientIp: "",
      userAgent: "",
      messageCount: 0,
      tokenCount: 0,
      needTitle: true,
      store,
    };
  };

  /** Every chat the current search matches, not just this page, oldest first. */
  const download = async(total: number) => {
    if (!total) {
      Setting.showMessage("info", i18next.t("general:No data"));
      return;
    }
    setDownloading(true);
    try {
      const q = lastQuery.current ?? {};
      const pageSize = Math.min(10000, total);
      const all: any[] = [];
      for (let page = 1; all.length < total; page++) {
        const res: any = await ChatBackend.getGlobalChats(page, pageSize, q.searchedColumn ?? "", q.searchText ?? "", q.sortField ?? "", q.sortOrder ?? "", store);
        if (res.status !== "ok") {
          Setting.showMessage("error", res.msg);
          return;
        }
        const batch = res.data ?? [];
        all.push(...batch);
        if (batch.length < pageSize) {
          break;
        }
      }
      all.sort((a, b) => (a.createdTime || a.updatedTime || "").localeCompare(b.createdTime || b.updatedTime || "") || (a.name || "").localeCompare(b.name || ""));
      const rows = all.map((chat) => ({
        [i18next.t("general:Name")]: chat.name,
        [i18next.t("general:Store")]: chat.store,
        [i18next.t("general:Created time")]: Setting.getFormattedDate(chat.createdTime),
        [i18next.t("general:Updated time")]: Setting.getFormattedDate(chat.updatedTime),
        [i18next.t("general:Display name")]: chat.displayName,
        [i18next.t("general:User")]: chat.user,
        [i18next.t("general:Model")]: chat.modelProvider,
        [i18next.t("general:Client IP")]: [chat.clientIp, chat.clientIpDesc].filter(Boolean).join(" ").trim(),
        [i18next.t("general:Count")]: chat.messageCount,
        [i18next.t("chat:Token count")]: chat.tokenCount,
        [i18next.t("chat:Price")]: Setting.formatPrice(chat.price, chat.currency),
        [i18next.t("general:Is deleted")]: chat.isDeleted ? i18next.t("general:ON") : i18next.t("general:OFF"),
      }));
      await Setting.saveRowsAsXlsx(rows, i18next.t("general:Chats"), `${i18next.t("general:Chats")}-${Setting.getFormattedDate(dayjs().format())}.xlsx`, [18, 14, 22, 22, 28, 12, 14, 28, 8, 10, 12, 10]);
    } finally {
      setDownloading(false);
    }
  };

  let columns: ColumnDef<any>[] = [
    {
      dataIndex: "store",
      title: i18next.t("general:Store"),
      width: 130,
      sortable: true,
      searchable: true,
      link: (value, record) => (value ? `/stores/${record.owner}/${value}` : undefined),
    },
    {
      dataIndex: "name",
      title: i18next.t("general:Name"),
      width: 200,
      sortable: true,
      searchable: true,
      render: (value, record) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <Link to={`/chats/${value}`} className="font-medium underline-offset-4 hover:underline">{value}</Link>
          {isApiChat(record) ? <Badge variant="info">{i18next.t("general:API")}</Badge> : null}
          {isApiChat(record) ? <Badge variant="outline">{i18next.t("general:Read-only")}</Badge> : null}
        </span>
      ),
    },
    dateColumn("updatedTime", i18next.t("general:Updated time")),
    {dataIndex: "user", title: i18next.t("general:User"), width: 110, sortable: true, searchable: true, render: (value) => <UserLabel user={value} />},
    {
      dataIndex: "modelProvider",
      title: i18next.t("general:Model"),
      width: 100,
      align: "center",
      sortable: true,
      searchable: true,
      render: (value) => <ProviderLogoLink name={value} provider={providerMap[value]} />,
    },
    {dataIndex: "clientIp", title: i18next.t("general:Client IP"), width: 160, sortable: true, searchable: true, render: (_value, record) => <ClientIpCell record={record} />},
    {
      dataIndex: "messageCount",
      key: "stats",
      title: i18next.t("general:Stats"),
      width: 120,
      sortable: true,
      render: (_value, record) => (
        <div className="space-y-0.5 tabular-nums">
          <Link to={`/messages?chat=${record.name}`} className="underline-offset-4 hover:underline">{record.messageCount}</Link>
          {isAdmin ? (
            <>
              <div className="text-xs text-muted-foreground">{record.tokenCount}</div>
              <div className="text-xs">{Setting.formatPrice(record.price, record.currency)}</div>
            </>
          ) : null}
        </div>
      ),
    },
    {dataIndex: "messages", title: i18next.t("general:Messages"), render: (_value, record) => (
      // the admin's own test chats are not shown to anyone else
      <ChatMessages chat={record} maximized={maximized} hidden={!isAdmin && record.user === "admin"} />
    )},
  ];

  if (Setting.isBasicLoginMode(account)) {
    columns = columns.filter((column) => column.dataIndex !== "user" && column.dataIndex !== "clientIp");
  }
  if (!isAdmin) {
    // a store admin sees the conversations, not the ids and addresses behind them
    columns = columns.filter((column) => column.dataIndex !== "name" && column.dataIndex !== "clientIp");
  }

  const users = new Set(pageRows.map((chat) => chat.user)).size;
  const sum = (field: string) => pageRows.reduce((total, chat) => total + (Number(chat[field]) || 0), 0);

  return (
    <CrudListPage
      formType="chats"
      title={i18next.t("general:Chats")}
      description={
        <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <SummaryBadge label={i18next.t("general:Users")} value={users} />
          <SummaryBadge label={i18next.t("general:Chats")} value={pageRows.length} />
          <SummaryBadge label={i18next.t("general:Messages")} value={sum("messageCount")} />
          {isAdmin ? <SummaryBadge label={i18next.t("general:Tokens")} value={sum("tokenCount")} /> : null}
          {isAdmin ? <SummaryBadge label={i18next.t("chat:Price")} value={Setting.formatPrice(sum("price"))} /> : null}
        </span>
      }
      columns={columns}
      fetch={async(q) => {
        lastQuery.current = q;
        const res: any = await ChatBackend.getGlobalChats(q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder, store);
        if (res.status === "ok") {
          setPageRows(res.data ?? []);
          totalRef.current = Number(res.data2 ?? 0);
        }
        return res;
      }}
      deps={[store]}
      rowKey={(r) => r.name}
      rowClassName={(r) => (r.isDeleted ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950 dark:hover:bg-amber-900" : undefined)}
      newRecord={isLocalAdmin ? newChat : undefined}
      add={(r) => ChatBackend.addChat(r)}
      editUrl={(r) => `/chats/${r.name}`}
      remove={(r) => ChatBackend.deleteChat(r)}
      deleteDisabled={() => !isLocalAdmin}
      toolbar={
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            {i18next.t("chat:Maximize messages")}
            <Switch
              checked={maximized}
              onCheckedChange={(value) => {
                setMaximized(value);
                Setting.setBoolValue("maximizeMessages", value);
              }}
            />
          </label>
          <Button variant="outline" loading={downloading} onClick={() => download(totalRef.current)}>
            <Download />
            {i18next.t("general:Download")}
          </Button>
        </div>
      }
    />
  );
}
