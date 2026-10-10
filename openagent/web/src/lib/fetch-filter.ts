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

import i18next from "i18next";
import {toast} from "sonner";
import * as Conf from "@/Conf";
import * as Setting from "@/lib/setting";

// The demo site is read-only: when the backend refuses a write, offer to jump to the
// writable try site instead. IsDemoMode comes from the config cookie, which may only
// arrive with the first /api/get-account response, so it is checked per request.
const originalFetch = window.fetch.bind(window);
let demoToastShown = false;

window.fetch = async(url: any, option: any = {}) => {
  const res = await originalFetch(url, option);
  const method = (option?.method || "GET").toUpperCase();
  if (Conf.IsDemoMode && method !== "GET" && method !== "HEAD" && !demoToastShown) {
    res
      .clone()
      .json()
      .then((data) => {
        if (Setting.isResponseDenied(data) && !demoToastShown) {
          demoToastShown = true;
          toast.error(i18next.t("general:This is a read-only demo site!"), {
            description: i18next.t("general:Go to writable demo site?"),
            onDismiss: () => {demoToastShown = false;},
            onAutoClose: () => {demoToastShown = false;},
            action: {
              label: i18next.t("general:OK"),
              onClick: () => Setting.openLink(`https://try.openagentai.org${location.pathname}${location.search}`),
            },
          });
        }
      })
      .catch(() => undefined);
  }
  return res;
};

export {};
