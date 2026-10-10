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
import {Loader2, LogIn, Send} from "lucide-react";
import {QRCodeSVG} from "qrcode.react";
import {useParams} from "react-router-dom";
import * as PipeBackend from "@/backend/PipeBackend";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {SimpleEditPage, type EditField} from "@/components/crud/SimpleEditPage";
import {useAccount} from "@/hooks/use-account";
import {useStoreOptions} from "@/hooks/use-stores";
import * as Setting from "@/lib/setting";
import {isComposing} from "@/lib/utils";
import {PipeTypeLabel, PipeTypes} from "@/pages/PipeListPage";

// the types that take a second secret besides the token, and what that secret is called there
const SECRET_KEY_LABELS: Record<string, string> = {
  "Discord": "provider:Public key",
  "WhatsApp": "pipe:Phone Number ID",
  "Slack": "pipe:Signing Secret",
  "Facebook Messenger": "pipe:App Secret",
  "Threads": "pipe:App Secret",
  "WeChat": "pipe:App Secret",
  "Snapchat": "pipe:App Secret",
  "X Direct Messages": "pipe:Consumer Secret",
};

// where each platform must send its webhook, and the hint lines shown above the URL
const WEBHOOK_HINTS: Record<string, {path?: string; lines: string[]; verifyToken?: string}> = {
  "WhatsApp": {lines: [], verifyToken: "pipe:WhatsApp verify token hint"},
  "Slack": {path: "slack", lines: ["pipe:Slack webhook hint"]},
  "Facebook Messenger": {path: "facebook-messenger", lines: ["pipe:Facebook Messenger webhook hint"], verifyToken: "pipe:Facebook Messenger verify token hint"},
  "Threads": {path: "threads", lines: ["pipe:Threads token hint", "pipe:Threads webhook hint"], verifyToken: "pipe:Threads verify token hint"},
  "WeChat": {path: "wechat", lines: ["pipe:WeChat token hint", "pipe:WeChat webhook hint"], verifyToken: "pipe:WeChat verify token hint"},
  "Snapchat": {path: "snapchat", lines: ["pipe:Snapchat token hint", "pipe:Snapchat webhook hint"]},
  "X Direct Messages": {path: "x-dm", lines: ["pipe:X Direct Messages token hint", "pipe:X Direct Messages webhook hint"]},
};

function WebhookHint({pipe}: {pipe: any}) {
  const hint = WEBHOOK_HINTS[pipe.type];
  if (!hint) {
    return null;
  }
  const url = hint.path ? `${pipe.domain || "https://<your-domain>"}/api/chat-webhook/${hint.path}/${pipe.name}` : "";
  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      {hint.verifyToken ? <div>{i18next.t(hint.verifyToken)} <strong className="text-foreground">{pipe.name}</strong></div> : null}
      {hint.lines.map((line, index) => (
        <div key={line}>
          {i18next.t(line)}
          {index === hint.lines.length - 1 && url ? <> <strong className="break-all text-foreground">{url}</strong></> : null}
        </div>
      ))}
    </div>
  );
}

function WebhookCard({pipe}: {pipe: any}) {
  const [sending, setSending] = React.useState(false);

  const setWebhook = () => {
    setSending(true);
    PipeBackend.setPipeWebhook(`${pipe.owner}/${pipe.name}`).then((res: any) => {
      if (res.status === "ok") {
        Setting.showMessage("success", `${i18next.t("provider:Webhook set successfully")}: ${res.data}`);
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
      }
    }).catch((error: any) => {
      Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${error}`);
    }).finally(() => setSending(false));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={setWebhook} disabled={sending}>
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {i18next.t("provider:Set Webhook")}
      </Button>
      <span className="text-sm text-muted-foreground">{i18next.t("provider:Webhook - Tooltip")}</span>
    </div>
  );
}

/** Weixin Claw signs in by scanning a QR code with WeChat, then the backend stores the session. */
function WeixinClawLogin({pipe, onLoggedIn}: {pipe: any; onLoggedIn: () => void}) {
  const [loggingIn, setLoggingIn] = React.useState(false);
  const [qrcodeUrl, setQrcodeUrl] = React.useState("");
  const [status, setStatus] = React.useState("");
  const timer = React.useRef<number | undefined>(undefined);
  const polling = React.useRef(false);

  React.useEffect(() => () => {
    polling.current = false;
    window.clearTimeout(timer.current);
  }, []);

  const id = `${pipe.owner}/${pipe.name}`;

  const wait = (qrcode: string) => {
    if (!qrcode || !polling.current) {
      return;
    }
    PipeBackend.waitWeixinClawLogin(id, qrcode).then((res: any) => {
      if (res.status !== "ok") {
        setLoggingIn(false);
        setStatus(res.msg);
        polling.current = false;
        return;
      }
      const loginStatus = res.data?.status || "";
      setStatus(loginStatus ? i18next.t(`pipe:Weixin Claw status ${loginStatus}`) : "");
      if (loginStatus === "confirmed" || loginStatus === "binded_redirect") {
        polling.current = false;
        setLoggingIn(false);
        onLoggedIn();
        Setting.showMessage("success", i18next.t("pipe:Weixin Claw login success"));
      } else if (loginStatus === "expired" || loginStatus === "verify_code_blocked") {
        polling.current = false;
        setLoggingIn(false);
      } else {
        timer.current = window.setTimeout(() => wait(qrcode), 1000);
      }
    }).catch((error: any) => {
      setStatus(String(error));
      if (polling.current) {
        timer.current = window.setTimeout(() => wait(qrcode), 3000);
      }
    });
  };

  const start = () => {
    window.clearTimeout(timer.current);
    polling.current = false;
    setLoggingIn(true);
    setQrcodeUrl("");
    setStatus(i18next.t("pipe:Weixin Claw login starting"));
    PipeBackend.startWeixinClawLogin(id).then((res: any) => {
      if (res.status !== "ok") {
        setLoggingIn(false);
        setStatus(res.msg);
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        return;
      }
      const qrcode = res.data?.qrcode || "";
      setQrcodeUrl(res.data?.qrcode_img_content || res.data?.qrcodeImageContent || "");
      setStatus(i18next.t("pipe:Weixin Claw scan prompt"));
      polling.current = true;
      wait(qrcode);
    }).catch((error: any) => {
      setLoggingIn(false);
      setStatus(String(error));
      Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${error}`);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-6">
      <Button onClick={start} disabled={loggingIn}>
        {loggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        {i18next.t("pipe:Login with Weixin QR")}
      </Button>
      {qrcodeUrl ? <QRCodeSVG value={qrcodeUrl} size={180} /> : null}
      {status ? <span className="text-sm text-muted-foreground">{status}</span> : null}
    </div>
  );
}

function ChatTestCard({pipe, update}: {pipe: any; update: (field: string, value: any) => void}) {
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState("");

  const test = () => {
    if (!pipe.chatId) {
      Setting.showMessage("error", "Please enter a Chat ID");
      return;
    }
    if (!pipe.chatTestMessage) {
      Setting.showMessage("error", "Please enter a test message");
      return;
    }
    setTesting(true);
    setResult("");
    PipeBackend.chatTest(`${pipe.owner}/${pipe.name}`, pipe.chatId, pipe.chatTestMessage).then((res: any) => {
      if (res.status === "ok") {
        setResult(i18next.t("general:Success"));
        Setting.showMessage("success", i18next.t("general:Success"));
      } else {
        setResult(res.msg);
        Setting.showMessage("error", res.msg);
      }
    }).catch((error: any) => {
      setResult(String(error));
      Setting.showMessage("error", String(error));
    }).finally(() => setTesting(false));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
        <label className="space-y-1.5 text-sm">
          <span>{i18next.t("pipe:Chat ID")}</span>
          <Input placeholder={i18next.t("pipe:Chat ID placeholder")} value={pipe.chatId ?? ""} onChange={(e) => update("chatId", e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span>{i18next.t("pipe:Test message")}</span>
          <Input
            placeholder={i18next.t("pipe:Test message placeholder")}
            value={pipe.chatTestMessage ?? ""}
            onChange={(e) => update("chatTestMessage", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isComposing(e)) {
                test();
              }
            }}
          />
        </label>
        <Button onClick={test} disabled={testing}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {i18next.t("pipe:Send")}
        </Button>
      </div>
      {result ? <Textarea readOnly rows={3} value={result} /> : null}
    </div>
  );
}

export default function PipeEditPage() {
  const {pipeName = ""} = useParams();
  const {account} = useAccount();
  const storeOptions = useStoreOptions();

  const fields: EditField[] = [
    {type: "text", name: "name", labelKey: "general:ID", required: true},
    {type: "text", name: "displayName", labelKey: "general:Display name"},
    {
      type: "select",
      name: "type",
      labelKey: "general:Type",
      options: () => PipeTypes.map((value) => ({value, label: <PipeTypeLabel type={value} />, keywords: value})),
    },
    {type: "select", name: "store", labelKey: "general:Store", options: () => storeOptions},
    {type: "password", name: "token", labelKey: "general:Token", when: (ctx) => ctx.record.type !== "Weixin Claw"},
    {
      type: "password",
      name: "secretKey",
      labelKey: (ctx) => SECRET_KEY_LABELS[ctx.record.type] ?? "provider:Public key",
      when: (ctx) => ctx.record.type in SECRET_KEY_LABELS,
      disabled: () => !Setting.isAdminUser(account),
    },
    {
      type: "custom",
      name: "webhookHint",
      label: "",
      block: true,
      when: (ctx) => ctx.record.type in WEBHOOK_HINTS,
      render: (ctx) => <WebhookHint pipe={ctx.record} />,
    },
    {type: "url", name: "domain", labelKey: "provider:Domain"},
    {type: "switch", name: "isDefault", labelKey: "store:Is default"},
    {
      type: "select",
      name: "state",
      labelKey: "general:State",
      options: () => [
        {value: "Active", label: i18next.t("general:Active")},
        {value: "Inactive", label: i18next.t("general:Inactive")},
      ],
    },
  ];

  return (
    <SimpleEditPage
      titleKey="pipe:Edit Pipe"
      backTo="/pipes"
      deps={[pipeName]}
      fields={fields}
      fetch={() => PipeBackend.getPipe("admin", pipeName)}
      add={(record) => PipeBackend.addPipe(record)}
      update={(record) => PipeBackend.updatePipe("admin", pipeName, record)}
      editUrl={(record) => `/pipes/${record.name}`}
    >
      {(ctx, update) => ctx.mode === "add" ? null : (
        <div className="mt-6 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{i18next.t("pipe:Pipe Test")}</CardTitle></CardHeader>
            <CardContent>
              {ctx.record.type === "Weixin Claw"
                ? <WeixinClawLogin pipe={ctx.record} onLoggedIn={() => window.location.reload()} />
                : <WebhookCard pipe={ctx.record} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{i18next.t("pipe:Chat Test")}</CardTitle></CardHeader>
            <CardContent><ChatTestCard pipe={ctx.record} update={update} /></CardContent>
          </Card>
        </div>
      )}
    </SimpleEditPage>
  );
}
