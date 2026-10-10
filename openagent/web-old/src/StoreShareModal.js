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

import React, {useCallback, useEffect, useState} from "react";
import {Avatar, Button, Modal, Popconfirm, Select, Spin} from "antd";

const {Option} = Select;
import i18next from "i18next";
import * as Setting from "./Setting";
import * as StoreBackend from "./backend/StoreBackend";
import * as OrganizationUserBackend from "./backend/OrganizationUserBackend";

function userLabel(u) {
  const dn = u.displayName || u.name;
  return `${dn} (${u.name})`;
}

export default function StoreShareModal(props) {
  const {open, store, onCancel, onSuccess} = props;
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selected, setSelected] = useState(undefined);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(() => {
    setLoadingUsers(true);
    OrganizationUserBackend.getOrganizationUsers()
      .then((res) => {
        if (res.status === "ok") {
          const list = (res.data || []).filter((u) => u && u.name && u.name !== store?.owner);
          setUsers(list);
        } else {
          Setting.showMessage("error", res.msg || i18next.t("general:Failed to load"));
        }
      })
      .catch((err) => {
        Setting.showMessage("error", `${i18next.t("general:Failed to load")}: ${err}`);
      })
      .finally(() => setLoadingUsers(false));
  }, [store]);

  useEffect(() => {
    if (open && store) {
      loadUsers();
    }
  }, [open, store, loadUsers]);

  const handleOpenChange = (nextOpen) => {
    if (nextOpen) {
      loadUsers();
    }
  };

  const handleShare = () => {
    if (!store || !selected) {
      return;
    }
    setSubmitting(true);
    StoreBackend.addSharedStore(store.owner, store.name, selected)
      .then((res) => {
        if (res.status === "ok") {
          Setting.showMessage("success", i18next.t("store:Store shared successfully"));
          setSelected(undefined);
          window.dispatchEvent(new Event("storesChanged"));
          if (onSuccess) {
            onSuccess(res.data);
          }
          onCancel();
        } else {
          Setting.showMessage("error", res.msg || i18next.t("general:Failed to save"));
        }
      })
      .catch((err) => {
        Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${err}`);
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <Modal
      title={i18next.t("store:Share store")}
      open={open}
      onCancel={() => {
        setSelected(undefined);
        onCancel();
      }}
      footer={null}
      destroyOnClose
    >
      <div style={{marginBottom: 12}}>
        <Select
          style={{width: "100%"}}
          placeholder={i18next.t("store:Select user to share with")}
          showSearch
          allowClear
          loading={loadingUsers}
          onOpenChange={handleOpenChange}
          value={selected}
          onChange={setSelected}
          filterOption={(input, option) => {
            const value = option?.value;
            const u = users.find((x) => x.name === value);
            if (!u) {
              return true;
            }
            const q = (input || "").trim().toLowerCase();
            if (!q) {
              return true;
            }
            return (
              (u.name && u.name.toLowerCase().includes(q)) ||
              (u.displayName && u.displayName.toLowerCase().includes(q))
            );
          }}
          notFoundContent={loadingUsers ? <Spin size="small" /> : null}
        >
          {users.map((u) => (
            <Option key={u.name} value={u.name} label={userLabel(u)}>
              <span style={{display: "flex", alignItems: "center", gap: 8}}>
                <Avatar size="small" src={u.avatar || undefined}>
                  {(u.displayName || u.name || "?").charAt(0)}
                </Avatar>
                <span>{userLabel(u)}</span>
              </span>
            </Option>
          ))}
        </Select>
      </div>
      <Popconfirm
        title={i18next.t("store:Confirm share store")}
        okText={i18next.t("general:OK")}
        cancelText={i18next.t("general:Cancel")}
        onConfirm={handleShare}
        disabled={!selected}
      >
        <Button type="primary" loading={submitting} disabled={!selected} block>
          {i18next.t("store:Share")}
        </Button>
      </Popconfirm>
    </Modal>
  );
}
