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

import React from "react";
import {Link} from "react-router-dom";
import {Alert, Button, Card, Progress, Result, Space, Table, Typography} from "antd";
import i18next from "i18next";
import {getCategoryPath, renderActionTag, renderCategoryTag} from "./MigrationCommon";

const {Text} = Typography;

// ProgressStep shows a run as it happens: how far along it is, which item is
// being written right now, and every row that has landed so far.
function ProgressStep(props) {
  const {progress, onRestart, onViewHistory} = props;

  const applied = progress.applied || [];
  const errors = progress.errors || [];
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const isRunning = progress.status === "Running";
  const isError = progress.status === "Error";

  const columns = [
    {
      title: i18next.t("general:Category"),
      dataIndex: "category",
      key: "category",
      width: 130,
      render: category => renderCategoryTag(category),
    },
    {
      title: i18next.t("migration:From"),
      dataIndex: "sourceName",
      key: "sourceName",
    },
    {
      title: i18next.t("migration:To"),
      dataIndex: "targetName",
      key: "targetName",
      render: (name, record) => {
        const path = getCategoryPath(record.category, name);
        return path ? <Link to={path}>{name}</Link> : <Text code>{name}</Text>;
      },
    },
    {
      title: i18next.t("general:Action"),
      dataIndex: "action",
      key: "action",
      width: 120,
      render: action => renderActionTag(action),
    },
  ];

  return (
    <div>
      <Card size="small" style={{marginBottom: 16}}>
        <Progress
          percent={percent}
          status={isError ? "exception" : (isRunning ? "active" : "success")}
        />
        <Space style={{marginTop: 8}} wrap>
          <Text strong>{`${progress.done} / ${progress.total}`}</Text>
          {isRunning && progress.current ? <Text type="secondary">{`${i18next.t("migration:Importing")} ${progress.current}`}</Text> : null}
          {!isRunning ? <Text type="secondary">{`${i18next.t("migration:Finished at")} ${progress.endedTime}`}</Text> : null}
        </Space>
      </Card>

      {isError && (
        <Alert
          type="error"
          showIcon
          style={{marginBottom: 16}}
          message={i18next.t("migration:The migration stopped early")}
          description={progress.errorText}
        />
      )}

      {errors.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{marginBottom: 16}}
          message={i18next.t("migration:{count} items failed and were left out").replace("{count}", errors.length)}
          description={
            <ul style={{marginBottom: 0, paddingLeft: 20}}>
              {errors.map((error, index) => <li key={index}>{error}</li>)}
            </ul>
          }
        />
      )}

      {!isRunning && !isError && (
        <Result
          status="success"
          style={{paddingTop: 8, paddingBottom: 8}}
          title={i18next.t("migration:Migration finished")}
          subTitle={i18next.t("migration:{count} items were imported. You can undo this run from the history tab.").replace("{count}", applied.length)}
          extra={[
            <Button key="again" onClick={onRestart}>{i18next.t("migration:Migrate something else")}</Button>,
            <Button key="history" type="primary" onClick={onViewHistory}>{i18next.t("migration:View history")}</Button>,
          ]}
        />
      )}

      <Table
        size="small"
        rowKey="key"
        dataSource={applied}
        columns={columns}
        pagination={{pageSize: 20, hideOnSinglePage: true}}
      />
    </div>
  );
}

export default ProgressStep;
