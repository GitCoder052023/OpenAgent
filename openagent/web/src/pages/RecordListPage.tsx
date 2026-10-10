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
import {Link} from "react-router-dom";
import * as ProviderBackend from "@/backend/ProviderBackend";
import * as RecordBackend from "@/backend/RecordBackend";
import {Alert, AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Switch} from "@/components/ui/switch";
import {CodeEditor} from "@/components/common/CodeEditor";
import {CommitResult} from "@/components/common/CommitResult";
import {Loading} from "@/components/common/Loading";
import {UserLabel} from "@/components/common/UserLabel";
import {CrudListPage} from "@/components/crud/CrudListPage";
import {BoolCell, clientIpColumn, dateColumn, textColumn, valueFilters} from "@/components/crud/columns";
import type {ColumnDef, RowAction} from "@/components/crud/types";
import {useAccount} from "@/hooks/use-account";
import * as Setting from "@/lib/setting";

const Methods = ["GET", "HEAD", "POST", "PUT", "DELETE", "CONNECT", "OPTIONS", "TRACE", "PATCH"];
const TriggeredActions = ["signup", "login", "logout", "update-user"];

function BlockLink({providerMap, record, isFirst}: {providerMap: Record<string, any>; record: any; isFirst: boolean}) {
  const block = isFirst ? record.block : record.block2;
  const provider = providerMap[isFirst ? record.provider : record.provider2];
  if (!provider || !provider.browserUrl) {
    return <>{block}</>;
  }
  const url = provider.type === "ChainMaker"
    ? provider.browserUrl.replace("{bh}", isFirst ? record.blockHash : record.blockHash2)
    : provider.browserUrl.replace("{bh}", block).replace("{chainId}", 1).replace("{clusterId}", provider.network);
  return <a href={url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">{block}</a>;
}

/** The request body, which only shows decoded once an admin opts in to decoding. */
function ObjectCell({text, decoding}: {text: string; decoding: boolean}) {
  if (!text) {
    return null;
  }
  if (!decoding) {
    return <span className="text-muted-foreground">***</span>;
  }

  let formatted = text;
  let parseError = "";
  try {
    formatted = JSON.stringify(JSON.parse(text), null, 2);
  } catch (error: any) {
    parseError = error.message;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="max-w-[200px] text-left font-mono text-xs underline-offset-4 hover:underline">
          {Setting.getShortText(text, 50)}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" className="w-[600px] max-w-[90vw] space-y-3">
        {parseError ? (
          <Alert variant="destructive">
            <AlertDescription className="line-clamp-3">{parseError}</AlertDescription>
          </Alert>
        ) : null}
        <CodeEditor value={formatted} language={parseError ? undefined : "json"} height={360} readOnly />
      </PopoverContent>
    </Popover>
  );
}

/** `formItems` is how the Form editor previews the columns it is editing. */
export default function RecordListPage({formItems}: {formItems?: any[]} = {}) {
  const {account} = useAccount();
  const [providerMap, setProviderMap] = React.useState<Record<string, any>>({});
  const [crossChain, setCrossChain] = React.useState(() => Setting.getBoolValue("enableCrossChain", false));
  const [decoding, setDecoding] = React.useState(() => Setting.getBoolValue("enableDecoding", false));
  const [query, setQuery] = React.useState<{title: string; loading: boolean; result: string} | null>(null);
  const isAdmin = Setting.isAdminUser(account);
  const profileUrl = Setting.getMyProfileUrl(account);

  React.useEffect(() => {
    if (!account) {
      return;
    }
    ProviderBackend.getProviders(account.owner).then((res: any) => {
      if (res.status === "ok") {
        setProviderMap(Object.fromEntries((res.data ?? []).map((provider: any) => [provider.name, provider])));
      } else {
        Setting.showMessage("error", res.msg);
      }
    });
  }, [account]);

  const toggleCrossChain = (value: boolean) => {
    setCrossChain(value);
    Setting.setBoolValue("enableCrossChain", value);
  };

  const toggleDecoding = (value: boolean) => {
    setDecoding(value);
    Setting.setBoolValue("enableDecoding", value);
  };

  const commit = async(record: any, isFirst: boolean, refresh: () => void) => {
    try {
      const res: any = await (isFirst ? RecordBackend.commitRecord(record) : RecordBackend.commitRecordSecond(record));
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Successfully committed"));
        refresh();
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to commit")}: ${res.msg}`);
      }
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to commit")}: ${error}`);
    }
  };

  const queryRecord = async(record: any, isFirst: boolean) => {
    const title = isFirst ? i18next.t("general:Result") : `${i18next.t("general:Result")} 2`;
    setQuery({title, loading: true, result: ""});
    try {
      const res: any = await (isFirst ? RecordBackend.queryRecord(record.owner, record.name) : RecordBackend.queryRecordSecond(record.owner, record.name));
      if (res.status === "ok") {
        setQuery({title, loading: false, result: res.data});
        return;
      }
      Setting.showMessage("error", `${i18next.t("general:Failed to query")}: ${res.msg}`);
    } catch (error) {
      Setting.showMessage("error", `${i18next.t("general:Failed to query")}: ${error}`);
    }
    setQuery(null);
  };

  const providerColumn = (dataIndex: string, title: string): ColumnDef<any> => ({
    dataIndex,
    title,
    width: 150,
    sortable: true,
    searchable: true,
    render: (value) => (value ? (
      <Link to={`/providers/${value}`} className="underline-offset-4 hover:underline">{Setting.getShortText(value, 25)}</Link>
    ) : null),
  });

  const searchable = (dataIndex: string, title: string, width = 90) =>
    textColumn<any>({dataIndex, title, width, searchable: true});

  const columns: ColumnDef<any>[] = [
    {
      dataIndex: "organization",
      title: i18next.t("general:Organization"),
      width: 110,
      sortable: true,
      searchable: true,
      render: (value) => (profileUrl ? (
        <a href={profileUrl.replace("/account", `/organizations/${value}`)} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
          {value}
        </a>
      ) : value),
    },
    searchable("id", i18next.t("general:ID")),
    {
      dataIndex: "name",
      title: i18next.t("general:Name"),
      width: 300,
      sortable: true,
      searchable: true,
      link: (_value, record) => `/records/${record.organization}/${record.id}`,
    },
    clientIpColumn({width: 150}),
    dateColumn(),
    providerColumn("provider", i18next.t("general:Provider")),
    ...(crossChain ? [providerColumn("provider2", i18next.t("general:Provider 2"))] : []),
    {
      dataIndex: "user",
      title: i18next.t("general:User"),
      width: 120,
      sortable: true,
      searchable: true,
      render: (value) => <UserLabel user={value} />,
    },
    {dataIndex: "method", title: i18next.t("general:Method"), width: 110, sortable: true, filters: valueFilters(Methods)},
    searchable("requestUri", i18next.t("general:Request URI"), 200),
    searchable("language", i18next.t("general:Language")),
    searchable("query", i18next.t("general:Query")),
    searchable("region", i18next.t("general:Region")),
    searchable("city", i18next.t("general:City")),
    searchable("unit", i18next.t("general:Unit")),
    searchable("section", i18next.t("general:Section")),
    {
      dataIndex: "count",
      title: i18next.t("general:Count"),
      width: 110,
      sortable: true,
      searchable: true,
      // older records stored 0 for a single occurrence
      render: (value) => value || 1,
    },
    searchable("response", i18next.t("general:Response")),
    {
      dataIndex: "object",
      title: i18next.t("general:Object"),
      width: 200,
      sortable: true,
      searchable: true,
      render: (value) => <ObjectCell text={value} decoding={decoding} />,
    },
    {
      dataIndex: "errorText",
      title: i18next.t("message:Error text"),
      width: 120,
      sortable: true,
      searchable: true,
      render: (value) => (value ? <span className="text-destructive">{value}</span> : null),
    },
    {
      dataIndex: "isTriggered",
      title: i18next.t("general:Is triggered"),
      width: 140,
      sortable: true,
      render: (value, record) => (TriggeredActions.includes(record.action) ? <BoolCell value={value} /> : null),
    },
    searchable("action", i18next.t("general:Action"), 150),
    {
      dataIndex: "block",
      title: i18next.t("general:Block"),
      width: 110,
      sortable: true,
      searchable: true,
      render: (_value, record) => <BlockLink providerMap={providerMap} record={record} isFirst />,
    },
    ...(crossChain ? [{
      dataIndex: "block2",
      title: i18next.t("general:Block 2"),
      width: 110,
      sortable: true,
      searchable: true,
      render: (_value: any, record: any) => <BlockLink providerMap={providerMap} record={record} isFirst={false} />,
    }] : []),
  ];

  const chainActions = (record: any, refresh: () => void): RowAction[] => {
    const actions: RowAction[] = [
      record.block === ""
        ? {key: "commit", label: i18next.t("record:Commit"), onSelect: () => commit(record, true, refresh)}
        : {key: "query", label: i18next.t("general:Query"), onSelect: () => queryRecord(record, true)},
    ];
    if (crossChain) {
      actions.push(record.block2 === ""
        ? {
          key: "commit2",
          label: `${i18next.t("record:Commit")} 2`,
          disabled: record.provider2 === "",
          description: record.provider2 === "" ? i18next.t("general:Error") : undefined,
          onSelect: () => commit(record, false, refresh),
        }
        : {key: "query2", label: `${i18next.t("general:Query")} 2`, onSelect: () => queryRecord(record, false)});
    }
    return actions;
  };

  return (
    <>
      <CrudListPage
        title={i18next.t("general:Logs")}
        columns={columns}
        formItems={formItems}
        fetch={(q) => RecordBackend.getRecords(Setting.getRequestOrganization(account), q.page, q.pageSize, q.searchedColumn, q.searchText, q.sortField, q.sortOrder)}
        deps={[account?.owner]}
        editUrl={(r) => `/records/${r.owner}/${r.id}`}
        remove={(r) => RecordBackend.deleteRecord(r)}
        // a log is evidence, so the antd list never let one be deleted
        deleteDisabled={() => true}
        rowActions={(record, _index, {refresh}) => chainActions(record, refresh)}
        actionColumnWidth={crossChain ? 330 : 250}
        toolbar={isAdmin ? (
          <div className="mr-2 flex items-center gap-5 text-sm">
            <label className="flex items-center gap-2">
              {i18next.t("record:Enable cross-chain")}
              <Switch checked={crossChain} onCheckedChange={toggleCrossChain} />
            </label>
            <label className="flex items-center gap-2">
              {i18next.t("record:Enable decoding")}
              <Switch checked={decoding} onCheckedChange={toggleDecoding} />
            </label>
          </div>
        ) : null}
      />
      <Dialog open={query !== null} onOpenChange={(open) => !open && setQuery(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{query?.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] min-w-0 overflow-auto">
            {query?.loading ? <Loading className="py-10" /> : <CommitResult queryResult={query?.result ?? ""} />}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setQuery(null)}>{i18next.t("general:Close")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
