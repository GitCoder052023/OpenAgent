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
import {useParams} from "react-router-dom";
import * as ProviderBackend from "@/backend/ProviderBackend";
import * as RecordBackend from "@/backend/RecordBackend";
import {Input} from "@/components/ui/input";
import {Switch} from "@/components/ui/switch";
import {CodeEditor} from "@/components/common/CodeEditor";
import {SimpleEditPage, type EditField} from "@/components/crud/SimpleEditPage";
import {useAccount} from "@/hooks/use-account";
import * as Setting from "@/lib/setting";

const Methods = ["GET", "HEAD", "POST", "PUT", "DELETE", "CONNECT", "OPTIONS", "TRACE", "PATCH"];

/** A record is a log entry: only the count and the chain providers are the admin's to change. */
const locked = () => true;

function readOnlyText(name: string, labelKey: string): EditField {
  return {type: "text", name, labelKey, disabled: locked};
}

function jsonField(name: string, labelKey: string): EditField {
  return {
    type: "custom",
    name,
    labelKey,
    block: true,
    render: (ctx) => <CodeEditor value={Setting.formatJsonString(ctx.record[name])} language="json" height={300} readOnly />,
  };
}

export default function RecordEditPage() {
  const {recordName = ""} = useParams();
  const {account} = useAccount();
  const [blockchainProviders, setBlockchainProviders] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!account) {
      return;
    }
    ProviderBackend.getProviders(account.owner).then((res: any) => {
      if (res.status === "ok") {
        setBlockchainProviders((res.data ?? []).filter((provider: any) => provider.category === "Blockchain" && provider.state === "Active"));
      } else {
        Setting.showMessage("error", res.msg);
      }
    });
  }, [account]);

  const providerOptions = () => blockchainProviders.map((provider) => ({value: provider.name, label: provider.name}));

  const fields: EditField[] = [
    readOnlyText("owner", "general:Organization"),
    readOnlyText("name", "general:Name"),
    readOnlyText("clientIp", "general:Client IP"),
    readOnlyText("user", "general:User"),
    {type: "select", name: "method", labelKey: "general:Method", disabled: locked, options: () => Methods.map((value) => ({value, label: value}))},
    readOnlyText("requestUri", "general:Request URI"),
    readOnlyText("action", "general:Action"),
    readOnlyText("language", "general:Language"),
    readOnlyText("region", "general:Region"),
    readOnlyText("city", "general:City"),
    readOnlyText("unit", "general:Unit"),
    readOnlyText("section", "general:Section"),
    {
      type: "custom",
      name: "count",
      labelKey: "general:Count",
      render: (ctx, update) => (
        <Input
          type="number"
          disabled={ctx.mode === "view"}
          // older records stored 0 for a single occurrence
          value={ctx.record.count || 1}
          onChange={(e) => update("count", Setting.myParseInt(e.target.value))}
        />
      ),
    },
    {type: "select", name: "provider", labelKey: "general:Provider", options: providerOptions},
    readOnlyText("block", "general:Block"),
    {type: "select", name: "provider2", label: i18next.t("general:Provider 2"), options: providerOptions},
    readOnlyText("block2", "general:Block 2"),
    jsonField("object", "general:Object"),
    jsonField("response", "general:Response"),
    {
      type: "custom",
      name: "isTriggered",
      labelKey: "general:Is triggered",
      render: (ctx) => <Switch checked={!!ctx.record.isTriggered} disabled className="opacity-100" />,
    },
  ];

  return (
    <SimpleEditPage
      // the antd page always titled itself "View Record"; getModeTitleKey only rewrites ":Edit "
      titleKey="record:View Record"
      backTo="/records"
      deps={[recordName, account?.owner]}
      fields={fields}
      fetch={() => RecordBackend.getRecord(account?.owner, recordName)}
      add={(record) => RecordBackend.addRecord(record)}
      update={(record) => RecordBackend.updateRecord(record.owner, recordName, record)}
      editUrl={(record) => `/records/${record.owner}/${record.id}`}
    />
  );
}
