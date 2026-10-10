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
import DOMPurify from "dompurify";
import {Download} from "lucide-react";
import {Link, useSearchParams} from "react-router-dom";
import * as MessageBackend from "@/backend/MessageBackend";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {ProviderLogoLink, useProviderMap} from "@/components/common/ProviderLogoLink";
import {UserLabel} from "@/components/common/UserLabel";
import {VectorScoreBadge} from "@/components/common/VectorScoreBadge";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {boolColumn, dateColumn} from "@/components/crud/columns";
import type {ColumnDef} from "@/components/crud/types";
import {useAccount} from "@/hooks/use-account";
import {useRequestStore} from "@/hooks/use-request-store";
import * as Setting from "@/lib/setting";

function Html({html, className}: {html: string; className?: string}) {
  return html ? <div className={className} dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(html)}} /> : null;
}

/** A long text is cut to one line; the full text opens beside it. */
function LongText({text, maxLength = 200}: {text: string; maxLength?: number}) {
  if (!text) {
    return null;
  }
  const plain = text.replace(/<[^>]*>/g, "");
  if (plain.length <= maxLength) {
    return <Html html={text} />;
  }
  return (
    <Popover>
      <PopoverTrigger className="block max-w-[300px] truncate text-left underline-offset-4 hover:underline">
        {Setting.getShortText(plain, maxLength)}
      </PopoverTrigger>
      <PopoverContent side="left" className="max-h-[500px] w-[900px] max-w-[calc(100vw-80px)] overflow-auto whitespace-pre-wrap break-words text-sm">
        <Html html={text} />
      </PopoverContent>
    </Popover>
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

export default function MessageListPage() {
  const {account} = useAccount();
  const store = useRequestStore();
  const [searchParams] = useSearchParams();
  // the chat list links here with ?chat= to show one chat's messages
  const chatFilter = searchParams.get("chat") ?? "";
  const isAdmin = account?.name === "admin";
  const isLocalAdmin = Setting.isLocalAdminUser(account);
  const providerMap = useProviderMap();
  const [pageRows, setPageRows] = React.useState<any[]>([]);
  const [downloading, setDownloading] = React.useState(false);
  const lastQuery = React.useRef<any>(null);
  const totalRef = React.useRef(0);
  const [total, setTotal] = React.useState(0);

  const newMessage = () => ({
    owner: "admin",
    name: `message_${Setting.getRandomName()}`,
    createdTime: dayjs().format(),
    organization: account?.owner,
    user: account?.name,
    chat: "",
    replyTo: "",
    author: account?.name,
    text: "Hello",
    tokenCount: 0,
    textTokenCount: 0,
    price: 0.0,
    store,
  });

  const download = async() => {
    if (!totalRef.current) {
      Setting.showMessage("info", i18next.t("general:No data"));
      return;
    }
    setDownloading(true);
    try {
      const q = lastQuery.current ?? {};
      const pageSize = Math.min(10000, totalRef.current);
      const all: any[] = [];
      for (let page = 1; all.length < totalRef.current; page++) {
        const res: any = await MessageBackend.getGlobalMessages(page, pageSize, q.searchedColumn ?? "", q.searchText ?? "", q.sortField ?? "", q.sortOrder ?? "", store);
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
      all.sort((a, b) => (a.createdTime || "").localeCompare(b.createdTime || "") || (a.name || "").localeCompare(b.name || ""));
      const rows = all.map((message) => ({
        [i18next.t("general:Author")]: message.author,
        [i18next.t("general:Chat")]: message.chat,
        [i18next.t("general:Message")]: message.name,
        [i18next.t("general:Created time")]: Setting.getFormattedDate(message.createdTime),
        [i18next.t("general:User")]: message.user,
        [i18next.t("general:Text")]: message.text,
        [i18next.t("message:Error text")]: message.errorText,
      }));
      await Setting.saveRowsAsXlsx(rows, i18next.t("general:Messages"), `${i18next.t("general:Messages")}-${Setting.getFormattedDate(dayjs().format())}.xlsx`, [12, 15, 15, 30, 15, 50, 50]);
    } finally {
      setDownloading(false);
    }
  };

  const link = (prefix: string) => (value: string) => (value ? `${prefix}/${value}` : undefined);

  let columns: ColumnDef<any>[] = [
    {dataIndex: "store", title: i18next.t("general:Store"), width: 130, sortable: true, searchable: true, link: (value, record) => (value ? `/stores/${record.owner}/${value}` : undefined)},
    {dataIndex: "name", title: i18next.t("general:Name"), width: 140, sortable: true, searchable: true, link: link("/messages")},
    dateColumn(),
    {dataIndex: "user", title: i18next.t("general:User"), width: 110, sortable: true, searchable: true, render: (value) => <UserLabel user={value} />},
    {
      dataIndex: "chat",
      title: i18next.t("general:Chat"),
      width: 140,
      sortable: true,
      searchable: true,
      render: (value, record) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <Link to={`/chats/${value}`} className="underline-offset-4 hover:underline">{value}</Link>
          {record.isReadOnly ? <Badge variant="info">{i18next.t("general:API")}</Badge> : null}
          {record.isReadOnly ? <Badge variant="outline">{i18next.t("general:Read-only")}</Badge> : null}
        </span>
      ),
    },
    {dataIndex: "replyTo", title: i18next.t("message:Reply to"), width: 140, sortable: true, searchable: true, link: link("/messages")},
    {dataIndex: "author", title: i18next.t("general:Author"), width: 110, sortable: true, searchable: true, render: (value) => <UserLabel user={value} />},
    {dataIndex: "modelProvider", title: i18next.t("general:Model"), width: 100, align: "center", sortable: true, searchable: true, render: (value) => <ProviderLogoLink name={value} provider={providerMap[value]} />},
    {dataIndex: "tokenCount", title: i18next.t("chat:Token count"), width: 120, sortable: true, className: "tabular-nums"},
    {dataIndex: "textTokenCount", title: i18next.t("chat:Text token count"), width: 150, sortable: true, className: "tabular-nums"},
    {dataIndex: "price", title: i18next.t("chat:Price"), width: 110, sortable: true, render: (value, record) => <span className="tabular-nums">{Setting.formatPrice(value, record.currency)}</span>},
    {dataIndex: "reasonText", title: i18next.t("general:Reasoning text"), width: 300, sortable: true, searchable: true, render: (value) => <LongText text={value} />},
    {dataIndex: "text", title: i18next.t("general:Text"), width: 300, sortable: true, searchable: true, render: (value) => <LongText text={value} />},
    {
      dataIndex: "knowledge",
      title: i18next.t("message:Knowledge"),
      width: 120,
      render: (_value, record) => (
        <div className="flex flex-wrap gap-1">
          {(record.vectorScores ?? []).map((vectorScore: any) => <VectorScoreBadge key={vectorScore.vector} vectorScore={vectorScore} />)}
        </div>
      ),
    },
    {
      dataIndex: "data",
      title: i18next.t("general:Data"),
      width: 200,
      render: (value) => {
        if (!value || value.length === 0) {
          return null;
        }
        const json = JSON.stringify(value);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block max-w-[200px] truncate font-mono text-xs">{Setting.getShortText(json, 50)}</span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xl break-all font-mono text-xs">{Setting.getShortText(json, 1000)}</TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      dataIndex: "suggestions",
      title: i18next.t("message:Suggestions"),
      width: 400,
      render: (value: any[]) => (
        <div className="flex flex-wrap gap-1">
          {(value ?? []).map((suggestion) => (
            // a suggestion the user clicked is the filled one
            <Badge key={suggestion.text} variant={suggestion.isHit ? "default" : "outline"} className="font-normal">{suggestion.text}</Badge>
          ))}
        </div>
      ),
    },
    {dataIndex: "errorText", title: i18next.t("message:Error text"), width: 200, sortable: true, searchable: true, render: (value) => <Html html={value} className="text-destructive" />},
    {dataIndex: "comment", title: i18next.t("message:Comment"), width: 200, sortable: true, searchable: true, render: (value) => <Html html={value} />},
    boolColumn({dataIndex: "isDeleted", title: i18next.t("general:Is deleted"), width: 120}),
    boolColumn({dataIndex: "isAlerted", title: i18next.t("general:Is alerted"), width: 120, invertColor: true}),
  ];

  if (!isAdmin) {
    // only the admin sees message ids and what an answer cost
    columns = columns.filter((column) => !["name", "tokenCount", "price"].includes(column.dataIndex));
  }

  const sum = (field: string) => pageRows.reduce((acc, message) => acc + (Number(message[field]) || 0), 0);
  const unique = (field: string) => new Set(pageRows.map((message) => message[field])).size;

  return (
    <CrudListPage
      formType="messages"
      title={i18next.t("general:Messages")}
      description={
        <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <SummaryBadge label={i18next.t("general:Users")} value={unique("user")} />
          <SummaryBadge label={i18next.t("general:Chats")} value={unique("chat")} />
          <SummaryBadge label={i18next.t("general:Messages")} value={total} />
          {isAdmin ? <SummaryBadge label={i18next.t("general:Tokens")} value={sum("tokenCount")} /> : null}
          {isAdmin ? <SummaryBadge label={i18next.t("chat:Price")} value={Setting.formatPrice(sum("price"))} /> : null}
        </span>
      }
      columns={columns}
      fetch={async(q) => {
        lastQuery.current = q;
        const res: any = await MessageBackend.getGlobalMessages(q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder, store);
        if (res.status === "ok") {
          setPageRows(res.data ?? []);
          totalRef.current = Number(res.data2 ?? 0);
          setTotal(totalRef.current);
        }
        return res;
      }}
      deps={[store]}
      initialQuery={chatFilter ? {searchedColumn: "chat", searchText: chatFilter} : undefined}
      rowKey={(r) => r.name}
      rowClassName={(r) => (r.isDeleted ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950 dark:hover:bg-amber-900" : undefined)}
      newRecord={isLocalAdmin ? newMessage : undefined}
      add={(r) => MessageBackend.addMessage(r)}
      editUrl={(r) => `/messages/${r.name}`}
      rowReadOnly={(r) => Boolean(r.isReadOnly)}
      remove={(r) => MessageBackend.deleteMessage(r)}
      deleteDisabled={() => !isLocalAdmin}
      toolbar={
        <Button variant="outline" loading={downloading} onClick={download}>
          <Download />
          {i18next.t("general:Download")}
        </Button>
      }
    />
  );
}
