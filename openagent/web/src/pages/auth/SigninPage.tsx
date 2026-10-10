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
import {CircleAlert, Loader2, Lock, User} from "lucide-react";
import * as AccountBackend from "@/backend/AccountBackend";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {useIsDark} from "@/hooks/use-theme";
import {useSite} from "@/hooks/use-site";
import * as Setting from "@/lib/setting";

/**
 * With Casdoor configured, sign-in happens there; otherwise OpenAgent's own
 * built-in password sign-in is shown, when the backend allows it.
 */
export default function SigninPage() {
  const isDark = useIsDark();
  const {site} = useSite();
  const [state, setState] = React.useState<{loading: boolean; showSignin: boolean; error: string; autoSignin: boolean}>({
    loading: true,
    showSignin: false,
    error: "",
    autoSignin: false,
  });
  const [username, setUsername] = React.useState("admin");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    AccountBackend.getSigninOptions().then((res: any) => {
      if (res.status === "ok" && res.data?.casdoorAvailable) {
        const url = Setting.getSigninUrl();
        if (url) {
          window.location.replace(url);
          return;
        }
      }
      const autoSignin = res.status === "ok" && res.data?.autoSignin === true;
      if (autoSignin) {
        setPassword("123");
      }
      setState({
        loading: false,
        showSignin: res.status === "ok" && !res.data?.casdoorAvailable && res.data?.signinAvailable,
        error: res.status === "ok" ? "" : res.msg,
        autoSignin,
      });
    }).catch((e: any) => setState({loading: false, showSignin: false, error: e?.message ?? String(e), autoSignin: false}));
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      return;
    }
    setSubmitting(true);
    AccountBackend.signinWithPassword(username, password).then((res: any) => {
      if (res.status === "ok") {
        const from = sessionStorage.getItem("from") || "/";
        sessionStorage.removeItem("from");
        window.location.href = from;
      } else {
        Setting.showMessage("error", res.msg);
        setSubmitting(false);
      }
    }).catch((error: any) => {
      Setting.showMessage("error", error?.message ?? String(error));
      setSubmitting(false);
    });
  };

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {i18next.t("login:Signing in...")}
      </div>
    );
  }

  if (!state.showSignin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div>
          <CircleAlert className="mx-auto mb-3 h-10 w-10 text-warning" />
          <h1 className="text-lg font-semibold">{i18next.t("login:Login Error")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{state.error || i18next.t("account:Sign in is unavailable")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form className="w-[340px] space-y-4" onSubmit={submit}>
        <div className="mb-9 text-center">
          <img
            src={Setting.getThemedLogo(site?.logoUrl, null, [isDark ? "dark" : "light"])}
            alt="OpenAgent"
            className="mx-auto w-[260px] max-w-full"
          />
        </div>
        <div className="relative">
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 rounded-lg pl-9"
            placeholder={i18next.t("general:Username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 rounded-lg pl-9"
            type="password"
            placeholder={i18next.t("general:Password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        </div>
        <Button type="submit" className="h-11 w-full rounded-lg" disabled={submitting || !username || !password}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {i18next.t("account:Sign In")}
        </Button>
      </form>
    </div>
  );
}
