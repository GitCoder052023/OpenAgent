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
import {Button, Modal, Popconfirm, Table, Tag, Tooltip, Typography} from "antd";
import BaseListPage from "./BaseListPage";
import * as Setting from "./Setting";
import * as SnapshotBackend from "./backend/SnapshotBackend";
import i18next from "i18next";
import {EyeOutlined, RollbackOutlined} from "@ant-design/icons";

class SnapshotListPage extends BaseListPage {
  constructor(props) {
    super(props);
    this.state = {
      ...this.state,
      detailVisible: false,
      detailSnapshot: null,
      detailLoading: false,
      rollbackLoadingName: "",
    };
  }

  getSnapshotPath(record) {
    if (record.action === "move") {
      return `${record.source} -> ${record.target}`;
    }
    return record.path;
  }

  getActionText(action) {
    if (action === "write") {
      return i18next.t("store:Write");
    }
    if (action === "move") {
      return i18next.t("store:Move");
    }
    return action;
  }

  getChangeTypeText(changeType) {
    if (changeType === "created") {
      return i18next.t("general:Created");
    }
    if (changeType === "deleted") {
      return i18next.t("general:Deleted");
    }
    if (changeType === "modified") {
      return i18next.t("general:Modified");
    }
    return changeType;
  }

  getStateText(state) {
    const stateText = state || "Active";
    if (stateText === "Active" || stateText === "RolledBack") {
      return i18next.t(`general:${stateText}`);
    }
    return stateText;
  }

  getStateTag(state) {
    if (state === "RolledBack") {
      return <Tag color="blue">{this.getStateText(state)}</Tag>;
    }
    return <Tag color="green">{this.getStateText(state)}</Tag>;
  }

  showDetails(record) {
    this.setState({detailVisible: true, detailLoading: true, detailSnapshot: null});
    SnapshotBackend.getSnapshot(record.owner, record.name)
      .then((res) => {
        if (res.status === "ok") {
          this.setState({detailSnapshot: res.data, detailLoading: false});
        } else {
          this.setState({detailLoading: false});
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        }
      })
      .catch(error => {
        this.setState({detailLoading: false});
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${error}`);
      });
  }

  rollbackSnapshot(record) {
    this.setState({rollbackLoadingName: record.name});
    SnapshotBackend.rollbackSnapshot(record.owner, record.name)
      .then((res) => {
        this.setState({rollbackLoadingName: ""});
        if (res.status === "ok") {
          Setting.showMessage("success", i18next.t("general:Snapshot rolled back"));
          this.fetch({pagination: this.state.pagination});
        } else {
          Setting.showMessage("error", `${i18next.t("general:Rollback failed")}: ${res.msg}`);
        }
      })
      .catch(error => {
        this.setState({rollbackLoadingName: ""});
        Setting.showMessage("error", `${i18next.t("general:Rollback failed")}: ${error}`);
      });
  }

  renderDetailsModal() {
    const snapshot = this.state.detailSnapshot;
    const fileColumns = [
      {
        title: i18next.t("general:Path"),
        dataIndex: "path",
        key: "path",
        render: (text) => <Typography.Text copyable>{text}</Typography.Text>,
      },
      {
        title: i18next.t("general:Change"),
        dataIndex: "changeType",
        key: "changeType",
        width: "110px",
        render: (text) => <Tag>{this.getChangeTypeText(text)}</Tag>,
      },
      {
        title: i18next.t("general:Before"),
        key: "before",
        width: "240px",
        render: (_, record) => record.beforeExists ? `${record.beforeHash.slice(0, 12)} ${record.beforeMode.toString(8)} ${Setting.getFriendlyFileSize(record.beforeSize)}` : i18next.t("general:Missing"),
      },
      {
        title: i18next.t("general:After"),
        key: "after",
        width: "240px",
        render: (_, record) => record.afterExists ? `${record.afterHash.slice(0, 12)} ${record.afterMode.toString(8)} ${Setting.getFriendlyFileSize(record.afterSize)}` : i18next.t("general:Missing"),
      },
    ];

    return (
      <Modal
        title={i18next.t("general:Snapshot details")}
        open={this.state.detailVisible}
        onCancel={() => this.setState({detailVisible: false, detailSnapshot: null})}
        footer={null}
        width={900}
      >
        <Table
          size="small"
          bordered
          loading={this.state.detailLoading}
          columns={fileColumns}
          dataSource={snapshot?.files || []}
          rowKey="path"
          pagination={false}
          scroll={{x: "max-content"}}
        />
        {snapshot?.diff && (
          <pre style={{marginTop: "12px", maxHeight: "360px", overflow: "auto", background: "rgba(0,0,0,0.04)", padding: "12px", borderRadius: "6px", whiteSpace: "pre-wrap"}}>
            {snapshot.diff}
          </pre>
        )}
      </Modal>
    );
  }

  renderTable(snapshots) {
    const columns = [
      {
        title: i18next.t("general:Created time"),
        dataIndex: "createdTime",
        key: "createdTime",
        width: "180px",
        sorter: (a, b) => a.createdTime.localeCompare(b.createdTime),
        render: (text) => Setting.getFormattedDate(text),
      },
      {
        title: i18next.t("general:Action"),
        dataIndex: "action",
        key: "action",
        width: "100px",
        filters: [
          {text: i18next.t("store:Write"), value: "write"},
          {text: i18next.t("store:Move"), value: "move"},
        ],
        onFilter: (value, record) => record.action === value,
        render: (text) => <Tag>{this.getActionText(text)}</Tag>,
      },
      {
        title: i18next.t("general:Path"),
        key: "path",
        ...this.getColumnSearchProps("path"),
        render: (_, record) => (
          <Tooltip title={this.getSnapshotPath(record)}>
            <Typography.Text copyable>{Setting.getShortText(this.getSnapshotPath(record), 96)}</Typography.Text>
          </Tooltip>
        ),
      },
      {
        title: i18next.t("general:Files"),
        key: "files",
        width: "90px",
        render: (_, record) => record.fileCount || 0,
      },
      {
        title: i18next.t("general:State"),
        dataIndex: "state",
        key: "state",
        width: "120px",
        render: (text) => this.getStateTag(text),
      },
      {
        title: i18next.t("message:Error text"),
        dataIndex: "errorText",
        key: "errorText",
        width: "220px",
        render: (text) => text ? Setting.getShortText(text, 80) : null,
      },
      {
        title: i18next.t("general:Action"),
        dataIndex: "action",
        key: "tableAction",
        width: "120px",
        fixed: "right",
        render: (_, record) => (
          <div style={{display: "flex", alignItems: "center", gap: "2px", flexWrap: "nowrap"}}>
            <Tooltip title={i18next.t("login:Details")}>
              <Button type="text" size="small" icon={<EyeOutlined />} style={{minWidth: "28px", width: "28px", height: "28px", padding: 0, borderRadius: "6px"}} onClick={() => this.showDetails(record)} />
            </Tooltip>
            {record.state === "Active" && (
              <Popconfirm
                title={`${i18next.t("general:Rollback snapshot")}: ${record.name}?`}
                onConfirm={() => this.rollbackSnapshot(record)}
                okText={i18next.t("general:OK")}
                cancelText={i18next.t("general:Cancel")}
              >
                <Tooltip title={i18next.t("general:Rollback")}>
                  <Button type="text" size="small" icon={<RollbackOutlined />} loading={this.state.rollbackLoadingName === record.name} style={{minWidth: "28px", width: "28px", height: "28px", padding: 0, borderRadius: "6px"}} />
                </Tooltip>
              </Popconfirm>
            )}
          </div>
        ),
      },
    ];

    const paginationProps = {
      total: this.state.pagination.total,
      showQuickJumper: true,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50", "100"],
      showTotal: (total) => i18next.t("general:{total} in total").replace("{total}", total),
    };

    return (
      <div>
        <Table
          scroll={{x: "max-content"}}
          columns={columns}
          dataSource={snapshots}
          rowKey="name"
          size="middle"
          bordered
          pagination={paginationProps}
          title={() => <div>{i18next.t("general:Snapshots")}</div>}
          loading={this.state.loading}
          onChange={this.handleTableChange}
        />
        {this.renderDetailsModal()}
      </div>
    );
  }

  fetch = (params = {}) => {
    const pagination = params.pagination || this.state.pagination;
    const field = params.searchedColumn || this.state.searchedColumn || "";
    const value = params.searchText || this.state.searchText || "";
    this.setState({
      loading: true,
      searchedColumn: field,
      searchText: value,
    });
    SnapshotBackend.getSnapshots("admin", pagination.current, pagination.pageSize, field, value, params.sortField || "", params.sortOrder || "")
      .then((res) => {
        if (res.status === "ok") {
          this.setState({
            loading: false,
            data: res.data,
            pagination: {
              ...pagination,
              total: res.data2,
            },
          });
        } else {
          if (res.status === "error" && res.msg === "Unauthorized") {
            this.setState({isAuthorized: false, loading: false});
          } else {
            this.setState({loading: false});
            Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
          }
        }
      });
  };
}

export default SnapshotListPage;
