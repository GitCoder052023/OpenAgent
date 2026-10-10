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
import * as AccountBackend from "@/backend/AccountBackend";
import * as Conf from "@/Conf";
import * as Setting from "@/lib/setting";

export interface Account {
  owner: string;
  name: string;
  displayName?: string;
  avatar?: string;
  type?: string;
  tag?: string;
  isAdmin?: boolean;
  homepage?: string;
  language?: string;
  [key: string]: any;
}

interface AccountContextValue {
  /** undefined = still loading, null = not signed in */
  account: Account | null | undefined;
  loading: boolean;
  setAccount: (account: Account | null) => void;
  reload: () => Promise<void>;
}

const AccountContext = React.createContext<AccountContextValue>({
  account: undefined,
  loading: true,
  setAccount: () => undefined,
  reload: async() => undefined,
});

// /api/get-account also (re)sends the jsonWebConfig cookie, so the Casdoor SDK is
// configured from it only after the first response.
function applyWebConfig() {
  Conf.initConfigFromCookie();
  Setting.initCasdoorSdk();
}

export function AccountProvider({children}: {children: React.ReactNode}) {
  const [account, setAccountState] = React.useState<Account | null | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);

  const fetchAccount = React.useCallback(async() => {
    setLoading(true);
    try {
      const res = await AccountBackend.getAccount();
      applyWebConfig();
      if (res?.status === "ok" && res.data) {
        setAccountState(res.data);
        if (!localStorage.getItem("language") && res.data.language) {
          Setting.setLanguage(res.data.language);
        }
      } else {
        setAccountState(null);
      }
    } catch (e: any) {
      applyWebConfig();
      setAccountState(null);
      Setting.showMessage("error", e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    applyWebConfig();
    fetchAccount();
  }, [fetchAccount]);

  const value = React.useMemo<AccountContextValue>(
    () => ({
      account,
      loading,
      setAccount: (next) => setAccountState(next),
      reload: fetchAccount,
    }),
    [account, loading, fetchAccount],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  return React.useContext(AccountContext);
}
