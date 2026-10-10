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
import {Table, Tag, Typography} from "antd";
import BaseListPage from "./BaseListPage";
import * as Setting from "./Setting";
import * as NotificationBackend from "./backend/NotificationBackend";
import i18next from "i18next";

const {Paragraph} = Typography;

function getStatusTag(status) {
  const colors = {
    "Pending": "processing",
    "Sending": "warning",
    "Sent": "success",
    "Failed": "error",
  };
  return <Tag color={colors[status] || "default"}>{status}</Tag>;
}

class NotificationListPage extends BaseListPage {
  renderTable(notifications) {
    const columns = [
      {
        title: i18next.t("general:Created time"),
        dataIndex: "createdTime",
        key: "createdTime",
        width: "170px",
        sorter: (a, b) => a.createdTime.localeCompare(b.createdTime),
        render: (text) => Setting.getFormattedDate(text),
      },
      {
        title: i18next.t("general:Recipient"),
        dataIndex: "recipient",
        key: "recipient",
        width: "130px",
        sorter: (a, b) => a.recipient.localeCompare(b.recipient),
        ...this.getColumnSearchProps("recipient"),
      },
      {
        title: i18next.t("general:Actor"),
        dataIndex: "actor",
        key: "actor",
        width: "130px",
        sorter: (a, b) => a.actor.localeCompare(b.actor),
        ...this.getColumnSearchProps("actor"),
      },
      {
        title: i18next.t("general:Store"),
        dataIndex: "storeName",
        key: "storeName",
        width: "180px",
        sorter: (a, b) => `${a.storeOwner}/${a.storeName}`.localeCompare(`${b.storeOwner}/${b.storeName}`),
        render: (text, record) => <Link to={`/agents/${record.storeOwner}/${record.storeName}`}>{record.storeOwner}/{record.storeName}</Link>,
      },
      {
        title: i18next.t("general:Event"),
        dataIndex: "event",
        key: "event",
        width: "150px",
        sorter: (a, b) => a.event.localeCompare(b.event),
        ...this.getColumnSearchProps("event"),
      },
      {
        title: i18next.t("general:Title"),
        dataIndex: "title",
        key: "title",
        width: "260px",
        ...this.getColumnSearchProps("title"),
      },
      {
        title: i18next.t("general:Status"),
        dataIndex: "status",
        key: "status",
        width: "110px",
        sorter: (a, b) => a.status.localeCompare(b.status),
        ...this.getColumnSearchProps("status"),
        render: (text) => getStatusTag(text),
      },
      {
        title: i18next.t("general:Retry count"),
        dataIndex: "retryCount",
        key: "retryCount",
        width: "110px",
        sorter: (a, b) => a.retryCount - b.retryCount,
      },
      {
        title: i18next.t("general:Sent time"),
        dataIndex: "sentTime",
        key: "sentTime",
        width: "170px",
        sorter: (a, b) => a.sentTime.localeCompare(b.sentTime),
        render: (text) => text ? Setting.getFormattedDate(text) : "",
      },
      {
        title: i18next.t("general:Url"),
        dataIndex: "url",
        key: "url",
        width: "220px",
        render: (text) => text ? <Link to={text.replace(window.location.origin, "")}>{text}</Link> : "",
      },
      {
        title: i18next.t("general:Error"),
        dataIndex: "errorText",
        key: "errorText",
        width: "260px",
        render: (text) => text ? <Paragraph style={{marginBottom: 0, maxWidth: 260}} ellipsis={{rows: 2, expandable: true}}>{text}</Paragraph> : "",
      },
    ];

    const paginationProps = {
      pageSize: this.state.pagination.pageSize,
      total: this.state.pagination.total,
      showQuickJumper: true,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50", "100"],
      showTotal: () => i18next.t("general:{total} in total").replace("{total}", this.state.pagination.total),
    };

    return (
      <Table
        scroll={{x: "max-content"}}
        columns={columns}
        dataSource={notifications}
        rowKey={(record) => `${record.owner}/${record.name}`}
        size="middle"
        bordered
        pagination={paginationProps}
        title={() => i18next.t("general:Notifications")}
        loading={this.getTableLoading()}
        onChange={this.handleTableChange}
      />
    );
  }

  fetch = (params = {}) => {
    const field = params.searchedColumn;
    const value = params.searchText;
    const sortField = params.sortField;
    const sortOrder = params.sortOrder;
    this.setState({loading: true});
    NotificationBackend.getNotifications(params.pagination.current, params.pagination.pageSize, field, value, sortField, sortOrder)
      .then((res) => {
        this.setState({loading: false});
        if (res.status === "ok") {
          this.setState({
            data: res.data,
            pagination: {
              ...params.pagination,
              total: res.data2,
            },
          });
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        }
      })
      .catch(error => {
        this.setState({loading: false});
        Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
      });
  };
}

export default NotificationListPage;
