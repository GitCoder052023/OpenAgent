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
import {CircleAlert, Loader2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import * as Setting from "@/lib/setting";

const MiniProgramCallbackPage = "/pages/callback/index";

function isInMiniProgram() {
  return (window as any).__wxjs_environment === "miniprogram" || /miniProgram/i.test(navigator.userAgent);
}

/**
 * Inside a WeChat mini program's web-view the code goes back to the mini program,
 * which signs in with it itself (a code can be redeemed only once).
 */
function redirectToMiniProgram(onError: (msg: string) => void) {
  const script = document.createElement("script");
  script.src = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js";
  script.onload = () => {
    (window as any).wx.miniProgram.redirectTo({url: `${MiniProgramCallbackPage}${window.location.search}`});
  };
  script.onerror = () => onError("Failed to load the WeChat JS-SDK");
  document.head.appendChild(script);
}

/** Casdoor redirects back here with ?code=&state=; trade them for an OpenAgent session. */
export default function AuthCallback() {
  const [error, setError] = React.useState<any>(null);
  const [showDetails, setShowDetails] = React.useState(false);
  const started = React.useRef(false);

  React.useEffect(() => {
    // StrictMode runs effects twice in development, but a code can be redeemed only once
    if (started.current) {
      return;
    }
    started.current = true;
    if (isInMiniProgram()) {
      redirectToMiniProgram((msg) => setError({msg}));
      return;
    }

    Setting.signin().then((res: any) => {
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Successfully logged in"));
        const from = sessionStorage.getItem("from") || "/";
        sessionStorage.removeItem("from");
        Setting.goToLink(from);
      } else {
        setError(res);
      }
    }).catch((e: any) => setError({msg: e?.message ?? String(e)}));
  }, []);

  if (error === null) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {i18next.t("login:Signing in...")}
      </div>
    );
  }

  const details = [
    {label: i18next.t("login:Error Message"), value: error.msg},
    {label: i18next.t("login:Additional Information"), value: error.data},
    {label: i18next.t("login:More Details"), value: error.data2},
  ].filter((item) => item.value);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center">
        <CircleAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h1 className="text-lg font-semibold">{i18next.t("login:Login Error")}</h1>
        <p className="mt-2 break-words text-sm text-muted-foreground">{error.msg}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => setShowDetails(true)}>{i18next.t("login:Details")}</Button>
          <Button variant="outline" onClick={() => Setting.openLink("https://openagentai.org/help/")}>
            {i18next.t("login:Help")}
          </Button>
        </div>
      </div>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{i18next.t("login:Error Details")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-left">
            {details.map((item) => (
              <div key={item.label}>
                <div className="text-sm font-medium">{item.label}:</div>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                  {typeof item.value === "string" ? item.value : JSON.stringify(item.value, null, 2)}
                </pre>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowDetails(false)}>{i18next.t("general:Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
