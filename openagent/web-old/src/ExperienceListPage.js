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
import {Button, Popconfirm, Select, Switch, Table, Tag, Tooltip, Typography} from "antd";
import moment from "moment";
import BaseListPage from "./BaseListPage";
import * as Setting from "./Setting";
import * as ExperienceBackend from "./backend/ExperienceBackend";
import i18next from "i18next";
import {DeleteOutlined, EditOutlined} from "@ant-design/icons";

const EXPERIENCE_STATES = ["Draft", "Active", "Archived"];
const EXPERIENCE_CATEGORIES = ["Fact", "Style", "Format", "Scope"];

class ExperienceListPage extends BaseListPage {
  constructor(props) {
    super(props);
  }

  newExperience() {
    const randomName = Setting.getRandomName();
    return {
      owner: "admin",
      name: `experience_${randomName}`,
      createdTime: moment().format(),
      store: "",
      question: "",
      originalText: "",
      correctedText: "",
      reason: "",
      category: "Style",
      rule: "",
      isGlobalRule: true,
      state: "Draft",
    };
  }

  addExperience() {
    const newExperience = this.newExperience();
    ExperienceBackend.addExperience(newExperience)
      .then((res) => {
        if (res.status === "ok") {
          Setting.showMessage("success", i18next.t("general:Successfully added"));
          this.props.history.push({
            pathname: `/experiences/${res.data?.name || newExperience.name}`,
            state: {isNewExperience: true},
          });
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${res.msg}`);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to add")}: ${error}`);
      });
  }

  deleteItem = async(i) => {
    return ExperienceBackend.deleteExperience(this.state.data[i]);
  };

  deleteExperience(record) {
    ExperienceBackend.deleteExperience(record)
      .then((res) => {
        if (res.status === "ok") {
          Setting.showMessage("success", i18next.t("general:Successfully deleted"));
          this.setState({
            data: this.state.data.filter((item) => item.name !== record.name),
            pagination: {
              ...this.state.pagination,
              total: this.state.pagination.total - 1,
            },
          });
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to delete")}: ${res.msg}`);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to delete")}: ${error}`);
      });
  }

  // Reviewing is the whole point of the Draft state, so approving is one click here
  // rather than a trip through the edit page.
  updateExperienceState(record, state) {
    const updated = {...record, state};
    ExperienceBackend.updateExperience(record.owner, record.name, updated)
      .then((res) => {
        if (res.status === "ok") {
          Setting.showMessage("success", i18next.t("general:Successfully saved"));
          this.setState({
            data: this.state.data.map((item) => item.name === record.name ? updated : item),
          });
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${error}`);
      });
  }

  renderTable(experiences) {
    const columns = [
      {
        title: i18next.t("general:Name"),
        dataIndex: "name",
        key: "name",
        width: "160px",
        sorter: (a, b) => a.name.localeCompare(b.name),
        ...this.getColumnSearchProps("name"),
        render: (text) => (
          <Link to={`/experiences/${text}`}>{text}</Link>
        ),
      },
      {
        title: i18next.t("general:Store"),
        dataIndex: "store",
        key: "store",
        width: "140px",
        sorter: (a, b) => (a.store || "").localeCompare(b.store || ""),
        ...this.getColumnSearchProps("store"),
        render: (text) => text ? <Link to={`/stores/admin/${text}`}>{text}</Link> : null,
      },
      {
        title: i18next.t("experience:Question"),
        dataIndex: "question",
        key: "question",
        ...this.getColumnSearchProps("question"),
        render: (text) => (
          <Typography.Paragraph ellipsis={{rows: 2, tooltip: text}} style={{marginBottom: 0}}>
            {text}
          </Typography.Paragraph>
        ),
      },
      {
        title: i18next.t("experience:Corrected answer"),
        dataIndex: "correctedText",
        key: "correctedText",
        ...this.getColumnSearchProps("correctedText"),
        render: (text) => (
          <Typography.Paragraph ellipsis={{rows: 2, tooltip: text}} style={{marginBottom: 0}}>
            {text}
          </Typography.Paragraph>
        ),
      },
      {
        title: i18next.t("general:Category"),
        dataIndex: "category",
        key: "category",
        width: "110px",
        filterMultiple: false,
        filters: EXPERIENCE_CATEGORIES.map((item) => ({text: i18next.t(`experience:Category - ${item}`), value: item})),
        onFilter: (value, record) => record.category === value,
        render: (text) => text ? <Tag>{i18next.t(`experience:Category - ${text}`)}</Tag> : null,
      },
      {
        title: i18next.t("experience:Standing rule"),
        dataIndex: "isGlobalRule",
        key: "isGlobalRule",
        width: "110px",
        render: (text) => <Switch disabled checked={text} />,
      },
      {
        title: i18next.t("experience:Hit count"),
        dataIndex: "hitCount",
        key: "hitCount",
        width: "100px",
        sorter: (a, b) => (a.hitCount || 0) - (b.hitCount || 0),
      },
      {
        title: i18next.t("general:State"),
        dataIndex: "state",
        key: "state",
        width: "130px",
        filterMultiple: false,
        filters: EXPERIENCE_STATES.map((item) => ({text: i18next.t(`experience:State - ${item}`), value: item})),
        onFilter: (value, record) => record.state === value,
        render: (text, record) => (
          <Select
            size="small"
            style={{width: "100%"}}
            value={text}
            onChange={(value) => this.updateExperienceState(record, value)}
            options={EXPERIENCE_STATES.map((item) => ({value: item, label: i18next.t(`experience:State - ${item}`)}))}
          />
        ),
      },
      {
        title: i18next.t("general:Created time"),
        dataIndex: "createdTime",
        key: "createdTime",
        width: "160px",
        sorter: (a, b) => (a.createdTime || "").localeCompare(b.createdTime || ""),
        render: (text) => Setting.getFormattedDate(text),
      },
      {
        title: i18next.t("general:Action"),
        dataIndex: "action",
        key: "action",
        width: "130px",
        fixed: "right",
        render: (text, record) => (
          <div style={{display: "flex", alignItems: "center", gap: "2px", flexWrap: "nowrap"}}>
            <Tooltip title={i18next.t("general:Edit")}>
              <Button type="text" size="small" icon={<EditOutlined />} style={{minWidth: "28px", width: "28px", height: "28px", padding: 0, borderRadius: "6px"}} onClick={() => this.props.history.push(`/experiences/${record.name}`)} />
            </Tooltip>
            <Popconfirm
              title={`${i18next.t("general:Sure to delete")}: ${record.name}?`}
              onConfirm={() => this.deleteExperience(record)}
              okText={i18next.t("general:OK")}
              cancelText={i18next.t("general:Cancel")}
            >
              <Tooltip title={i18next.t("general:Delete")}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{minWidth: "28px", width: "28px", height: "28px", padding: 0, borderRadius: "6px"}} />
              </Tooltip>
            </Popconfirm>
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
          dataSource={experiences}
          rowKey="name"
          size="middle"
          bordered
          pagination={paginationProps}
          title={() => (
            <div>
              {i18next.t("general:Experiences")}&nbsp;&nbsp;&nbsp;&nbsp;
              <Button type="primary" size="small" onClick={() => this.addExperience()}>
                {i18next.t("general:Add")}
              </Button>
            </div>
          )}
          loading={this.state.loading}
          onChange={this.handleTableChange}
        />
      </div>
    );
  }

  fetch = (params = {}) => {
    const {pagination} = params;
    this.setState({loading: true});
    ExperienceBackend.getExperiences("admin", pagination.current, pagination.pageSize, this.state.searchField, this.state.searchValue, params.sortField, params.sortOrder)
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
            Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
          }
        }
      });
  };
}

export default ExperienceListPage;
