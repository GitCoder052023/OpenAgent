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
import * as SiteBackend from "@/backend/SiteBackend";
import * as Conf from "@/Conf";
import * as Setting from "@/lib/setting";

// The built-in site carries the instance's branding (logo, favicon, theme colour)
// and which menu entries to show.
const SiteContext = React.createContext<{site: any; reload: () => void}>({site: null, reload: () => undefined});

export function SiteProvider({children}: {children: React.ReactNode}) {
  const [site, setSite] = React.useState<any>(null);

  const reload = React.useCallback(() => {
    SiteBackend.getBuiltInSite().then((res: any) => {
      if (res?.status === "ok" && res.data) {
        setSite(res.data);
      }
    }).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  React.useEffect(() => {
    const faviconUrl = site?.faviconUrl || Conf.FaviconUrl;
    if (faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = faviconUrl;
    }
  }, [site?.faviconUrl]);

  // the site's title wins over the instance's, which is all there is until the site loads
  React.useEffect(() => {
    const title = Setting.getHtmlTitle(site?.htmlTitle);
    if (title) {
      document.title = title;
    }
  }, [site?.htmlTitle]);

  const value = React.useMemo(() => ({site, reload}), [site, reload]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  return React.useContext(SiteContext);
}
