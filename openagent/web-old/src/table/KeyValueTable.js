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

import {Button, Input, Table, Tooltip} from "antd";
import {DeleteOutlined} from "@ant-design/icons";
import i18next from "i18next";
import React from "react";

// KeyValueTable edits a plain string map (MCP process environment, HTTP
// headers). The map is kept as an ordered row list while editing so that
// renaming a key does not reshuffle the rows under the cursor.
class KeyValueTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      rows: Object.entries(props.keyValues || {}).map(([key, value]) => ({key: key, value: value})),
    };
  }

  updateRows(rows) {
    this.setState({rows: rows});

    const keyValues = {};
    rows.forEach(row => {
      if (row.key !== "") {
        keyValues[row.key] = row.value;
      }
    });
    this.props.onUpdateTable(keyValues);
  }

  updateField(index, field, value) {
    const rows = [...this.state.rows];
    rows[index] = {...rows[index], [field]: value};
    this.updateRows(rows);
  }

  addRow() {
    this.updateRows([...this.state.rows, {key: "", value: ""}]);
  }

  deleteRow(index) {
    this.updateRows(this.state.rows.filter((row, i) => i !== index));
  }

  render() {
    const columns = [
      {
        title: i18next.t("general:Name"),
        dataIndex: "key",
        key: "key",
        width: "40%",
        render: (text, record, index) => (
          <Input value={text} onChange={e => this.updateField(index, "key", e.target.value)} />
        ),
      },
      {
        title: i18next.t("general:Value"),
        dataIndex: "value",
        key: "value",
        render: (text, record, index) => (
          <Input.Password
            visibilityToggle={text !== "***"}
            value={text}
            onChange={e => this.updateField(index, "value", e.target.value)}
          />
        ),
      },
      {
        title: i18next.t("general:Action"),
        key: "action",
        width: "80px",
        render: (text, record, index) => (
          <Tooltip placement="right" title={i18next.t("general:Delete")}>
            <Button icon={<DeleteOutlined />} size="small" onClick={() => this.deleteRow(index)} />
          </Tooltip>
        ),
      },
    ];

    return (
      <Table
        rowKey={(record, index) => index}
        columns={columns}
        dataSource={this.state.rows}
        size="small"
        bordered
        pagination={false}
        footer={() => (
          <Button size="small" onClick={() => this.addRow()}>
            {i18next.t("general:Add")}
          </Button>
        )}
      />
    );
  }
}

export default KeyValueTable;
