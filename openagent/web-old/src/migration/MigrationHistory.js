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

import React, {useCallback, useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {Button, Popconfirm, Table, Tag, Typography} from "antd";
import i18next from "i18next";
import * as MigrationBackend from "./MigrationBackend";
import * as Setting from "../Setting";
import {getCategoryPath, renderActionTag, renderCategoryTag} from "./MigrationCommon";

const {Text} = Typography;

// MigrationHistory lists past runs and lets an admin undo one. Rolling back
// deletes the entities the run created; anything it overwrote is gone for good,
// which is why the server reports those back as notes instead of touching them.
function MigrationHistory(props) {
  const {refreshKey} = props;

  const [migrations, setMigrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState("");

  const fetchMigrations = useCallback(() => {
    setLoading(true);
    MigrationBackend.getMigrations()
      .then(res => {
        if (res.status === "ok") {
          setMigrations(res.data || []);
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchMigrations();
  }, [fetchMigrations, refreshKey]);

  function rollback(migration) {
    setRollingBack(migration.name);
    MigrationBackend.rollbackMigration(migration.owner, migration.name)
      .then(res => {
        const notes = res.data || [];
        if (res.status !== "ok") {
          Setting.showMessage("error", `${i18next.t("migration:Failed to roll back")}: ${res.msg}`);
        } else if (notes.length > 0) {
          Setting.showMessage("warning", `${i18next.t("migration:Rolled back, with some items left behind")}: ${notes.join("; ")}`);
        } else {
          Setting.showMessage("success", i18next.t("migration:Rolled back"));
        }
        fetchMigrations();
      })
      .finally(() => setRollingBack(""));
  }

  const columns = [
    {
      title: i18next.t("migration:Source"),
      dataIndex: "source",
      key: "source",
      width: 140,
      render: (source, record) => (
        <span>
          {source}
          {record.sourceVersion ? <Tag style={{marginLeft: 8}}>{record.sourceVersion}</Tag> : null}
        </span>
      ),
    },
    {
      title: i18next.t("migration:Started"),
      dataIndex: "startedTime",
      key: "startedTime",
      width: 200,
    },
    {
      title: i18next.t("general:Status"),
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status, record) => {
        if (record.isRolledBack) {
          return <Tag>{i18next.t("migration:Rolled back")}</Tag>;
        }
        if (status === "Error") {
          return <Tag color="error">{i18next.t("application:Failed")}</Tag>;
        }
        if (status === "Running") {
          return <Tag color="processing">{i18next.t("application:Running")}</Tag>;
        }
        return <Tag color="success">{i18next.t("chat:Done")}</Tag>;
      },
    },
    {
      title: i18next.t("migration:Imported"),
      dataIndex: "items",
      key: "items",
      width: 120,
      render: items => (items || []).length,
    },
    {
      title: i18next.t("general:Path"),
      dataIndex: "sourcePath",
      key: "sourcePath",
      render: path => (path ? <Text type="secondary">{path}</Text> : "-"),
    },
    {
      title: i18next.t("general:Action"),
      key: "action",
      width: 140,
      render: (text, record) => (
        <Popconfirm
          title={i18next.t("migration:Undo this migration?")}
          description={i18next.t("migration:Entities this run created will be deleted. Entities it replaced cannot be restored.")}
          onConfirm={() => rollback(record)}
          okText={i18next.t("general:OK")}
          cancelText={i18next.t("general:Cancel")}
        >
          <Button danger size="small" disabled={record.isRolledBack} loading={rollingBack === record.name}>
            {i18next.t("migration:Roll back")}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const expandedRowRender = record => (
    <Table
      size="small"
      rowKey="key"
      pagination={false}
      dataSource={record.items || []}
      columns={[
        {title: i18next.t("general:Category"), dataIndex: "category", key: "category", width: 130, render: category => renderCategoryTag(category)},
        {title: i18next.t("migration:From"), dataIndex: "sourceName", key: "sourceName"},
        {
          title: i18next.t("migration:To"),
          dataIndex: "targetName",
          key: "targetName",
          render: (name, item) => {
            const path = getCategoryPath(item.category, name);
            return path && !record.isRolledBack ? <Link to={path}>{name}</Link> : <Text code>{name}</Text>;
          },
        },
        {title: i18next.t("general:Action"), dataIndex: "action", key: "action", width: 120, render: action => renderActionTag(action)},
      ]}
    />
  );

  return (
    <Table
      size="small"
      rowKey="name"
      loading={loading}
      dataSource={migrations}
      columns={columns}
      expandable={{expandedRowRender, rowExpandable: record => (record.items || []).length > 0}}
      pagination={{pageSize: 10, hideOnSinglePage: true}}
    />
  );
}

export default MigrationHistory;
