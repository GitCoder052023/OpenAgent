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
import {AlertCircle, ArrowLeft} from "lucide-react";
import {Link, useNavigate, useParams, useSearchParams} from "react-router-dom";
import * as StoreBackend from "@/backend/StoreBackend";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Loading} from "@/components/common/Loading";
import {PageHeader} from "@/components/crud/PageHeader";
import {FileTree} from "@/components/store/FileTree";
import {useAccount} from "@/hooks/use-account";
import * as Setting from "@/lib/setting";

/** The knowledge files of one store, at /stores/:owner/:storeName/view. */
export default function FileTreePage() {
  const {owner = "admin", storeName = ""} = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {account} = useAccount();
  const [store, setStore] = React.useState<any>(null);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    StoreBackend.getStore(owner, storeName).then((res: any) => {
      if (res.status === "ok") {
        // the store loads even when its storage cannot be listed; data2 says why
        setStore(res.data ? {...res.data, error: typeof res.data2 === "string" ? res.data2 : ""} : {missing: true});
      } else {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        setStore({missing: true});
      }
    });
  }, [owner, storeName, nonce]);

  if (store === null) {
    return <Loading />;
  }

  const header = (
    <PageHeader
      title={
        <span className="flex items-center gap-2">
          <Button variant="ghost" size="iconSm" aria-label={i18next.t("general:Go back")} onClick={() => navigate("/stores")}>
            <ArrowLeft />
          </Button>
          {store.displayName || store.name || storeName}
        </span>
      }
      actions={store.name ? <Button variant="outline" asChild><Link to={`/stores/${store.owner}/${store.name}`}>{i18next.t("general:Edit")}</Link></Button> : null}
    />
  );

  let body: React.ReactNode;
  if (store.missing) {
    body = <p className="py-16 text-center text-sm text-muted-foreground">{i18next.t("general:No data")}</p>;
  } else if (!store.fileTree) {
    body = store.error ? (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{i18next.t("general:Failed to get")}</AlertTitle>
        <AlertDescription>{store.error}</AlertDescription>
      </Alert>
    ) : <p className="py-16 text-center text-sm text-muted-foreground">{i18next.t("general:No data")}</p>;
  } else {
    body = <FileTree store={store} account={account} initialFileKey={searchParams.get("fileKey")} onRefresh={() => setNonce((n) => n + 1)} />;
  }

  return (
    <div className="space-y-4">
      {header}
      {body}
    </div>
  );
}
