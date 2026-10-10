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
import * as StoreBackend from "@/backend/StoreBackend";

export interface StoreOption {
  value: string;
  label: string;
}

/** The stores of the admin owner as select options: "Display name (name)". */
export function useStoreOptions(): StoreOption[] {
  const [options, setOptions] = React.useState<StoreOption[]>([]);

  React.useEffect(() => {
    StoreBackend.getStoreNames("admin").then((res: any) => {
      if (res?.status === "ok") {
        setOptions((res.data ?? []).map((store: any) => ({
          value: store.name,
          label: store.displayName ? `${store.displayName} (${store.name})` : store.name,
        })));
      }
    }).catch(() => undefined);
  }, []);

  return options;
}
