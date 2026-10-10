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
import * as FormBackend from "@/backend/FormBackend";
import {useAccount} from "@/hooks/use-account";

/**
 * The columns a saved Form picks for a list page. The Form is named after the
 * list ("records", "stores", ...), and a user with a tag gets the
 * "<list>-tag-<tag>" Form when there is one. Undefined while loading or when no
 * Form exists, which leaves the page's own columns in place.
 */
export function useFormItems(formType?: string): any[] | undefined {
  const {account} = useAccount();
  const [formItems, setFormItems] = React.useState<any[] | undefined>(undefined);
  const owner = account?.owner;
  const tag = account?.tag ?? "";

  React.useEffect(() => {
    setFormItems(undefined);
    if (!formType || !owner) {
      return;
    }
    let cancelled = false;
    const load = async() => {
      const names = tag !== "" ? [`${formType}-tag-${tag}`, formType] : [formType];
      for (const name of names) {
        const res: any = await FormBackend.getForm(owner, name).catch(() => null);
        if (res?.status === "ok" && res.data) {
          return res.data.formItems;
        }
      }
      return undefined;
    };
    load().then((items) => {
      if (!cancelled) {
        setFormItems(items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [formType, owner, tag]);

  return formItems;
}
