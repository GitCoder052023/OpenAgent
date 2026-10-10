// Copyright 2025 The OpenAgent Authors. All Rights Reserved.
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

import React from "react";
import {Select} from "antd";
import i18next from "i18next";
import * as StoreBackend from "./backend/StoreBackend";
import * as Setting from "./Setting";

function StoreSelect(props) {
  const {style, onSelect, withAll, className, disabled, account} = props;
  const [stores, setStores] = React.useState([]);
  const [value, setValue] = React.useState(Setting.getStore());
  const [initialized, setInitialized] = React.useState(false);

  React.useEffect(() => {
    if (props.stores === undefined) {
      getStores();
    }

    window.addEventListener("storesChanged", getStores);

    const handleStorageChange = (e) => {
      if (e.storageArea && "store" in e.storageArea) {
        const currentStore = Setting.getStore();
        if (currentStore && currentStore !== value) {
          setValue(currentStore);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return function() {
      window.removeEventListener("storesChanged", getStores);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const getStores = () => {
    const currentStore = Setting.getStore();
    if (currentStore) {
      setValue(currentStore);
    }

    StoreBackend.getStoreNames("admin")
      .then((res) => {
        if (res.status === "ok") {
          setStores(res.data);

          // Iron rule: if the user has previously saved a value in localStorage (even "All"),
          // NEVER override it during initialization. Only a user action changes it.
          // Distinguish "explicitly set to All" from "never set" by checking localStorage directly.
          const rawStoredStore = localStorage.getItem("store");
          if (rawStoredStore !== null) {
            // User has an explicit choice saved — just sync the display widget.
            setValue(rawStoredStore);
          } else {
            // First visit / localStorage cleared. Apply defaults:
            // 1. Homepage-bound store takes priority.
            // 2. Fall back to first store in the list.
            const userBoundStore = getUserBoundStore(res.data);
            if (userBoundStore) {
              handleOnChange(userBoundStore);
            } else {
              // Use res.data directly because the stores state update hasn't re-rendered yet
              const firstStore = res.data.length > 0 ? res.data[0].name : "";
              handleOnChange(firstStore);
            }
          }
          setInitialized(true);
        }
      });
  };

  const handleOnChange = (value) => {
    setValue(value);
    Setting.setStore(value);
  };

  const getUserBoundStore = (storeList) => {
    // Check if user's Homepage field matches any store name
    if (account && account.homepage && storeList) {
      const matchingStore = storeList.find(store => store.name === account.homepage);
      if (matchingStore) {
        return matchingStore.name;
      }
    }
    return null;
  };

  const isUserBoundToStore = () => {
    // User is bound if Homepage matches a store in the list
    return getUserBoundStore(stores) !== null;
  };

  const storeLabel = (store) => {
    const text = store.displayName || store.name;
    return (
      <span style={{display: "flex", alignItems: "center", gap: 8}}>
        <img
          src={Setting.getStoreIconUrl(store)}
          alt=""
          style={{width: 20, height: 20, borderRadius: 4, objectFit: "cover", flexShrink: 0}}
        />
        <span>{text}</span>
      </span>
    );
  };

  const getStoreItems = () => {
    const items = [];

    stores.forEach((store) => items.push({value: store.name, label: storeLabel(store)}));

    if (withAll) {
      items.unshift({
        label: i18next.t("store:All"),
        value: "All",
      });
    }

    return items;
  };

  if (!initialized) {
    return <div style={{...style, width: "100%", height: "32px"}} className={className}></div>;
  }

  return (
    <Select
      options={getStoreItems()}
      virtual={false}
      popupMatchSelectWidth={false}
      value={value}
      onChange={handleOnChange}
      filterOption={(input, option) => {
        if (option?.value === "All") {
          return i18next.t("store:All").toLowerCase().includes(input.toLowerCase());
        }
        const s = stores.find(st => st.name === option?.value);
        return ((s?.displayName || s?.name || "")).toLowerCase().includes(input.toLowerCase());
      }}
      style={style}
      onSelect={onSelect}
      className={className}
      disabled={disabled || isUserBoundToStore()}
    >
    </Select>
  );
}

export default StoreSelect;
