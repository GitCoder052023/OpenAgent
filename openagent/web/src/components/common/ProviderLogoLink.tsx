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
import {Link} from "react-router-dom";
import * as ProviderBackend from "@/backend/ProviderBackend";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import * as ProviderSetting from "@/lib/provider-setting";

/** The admin's providers by name, for lists that show which model answered. */
export function useProviderMap(owner = "admin") {
  const [providerMap, setProviderMap] = React.useState<Record<string, any>>({});
  React.useEffect(() => {
    ProviderBackend.getProviders(owner).then((res: any) => {
      if (res.status === "ok") {
        setProviderMap(Object.fromEntries((res.data ?? []).map((provider: any) => [provider.name, provider])));
      }
    });
  }, [owner]);
  return providerMap;
}

/** A provider shown as its logo, linking to its page; the name is in the tooltip. */
export function ProviderLogoLink({name, provider, size = 36}: {name: string; provider: any; size?: number}) {
  if (!name) {
    return null;
  }
  if (!provider) {
    return <>{name}</>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to={`/providers/${name}`} className="inline-flex">
          <img
            src={ProviderSetting.getProviderLogoURL({category: provider.category, type: provider.type})}
            alt={provider.type}
            className="object-contain"
            style={{width: size, height: size}}
          />
        </Link>
      </TooltipTrigger>
      <TooltipContent>{provider.type} · {name}</TooltipContent>
    </Tooltip>
  );
}
