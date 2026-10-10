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
import {Alert, Button, Card, Checkbox, Col, Descriptions, Radio, Row, Space, Statistic, Table, Tag, Tooltip, Typography} from "antd";
import {KeyOutlined, WarningOutlined} from "@ant-design/icons";
import i18next from "i18next";
import {countApplicable, getCategoryLabel, renderActionTag, renderCategoryTag} from "./MigrationCommon";

const {Text} = Typography;

// PreviewStep is the dry run: every row the migration would write, what it
// would be called on the OpenAgent side, and why anything is being skipped.
function PreviewStep(props) {
  const {plan, options, setOptions, selectedKeys, setSelectedKeys, replanning, starting, onBack, onStart} = props;

  const items = plan.items || [];
  const warnings = plan.warnings || [];
  const applicable = countApplicable(items, selectedKeys);

  function setOption(key, value) {
    setOptions({...options, [key]: value});
  }

  const columns = [
    {
      title: i18next.t("general:Category"),
      dataIndex: "category",
      key: "category",
      width: 130,
      render: category => renderCategoryTag(category),
      filters: [...new Set(items.map(item => item.category))].map(category => ({text: getCategoryLabel(category), value: category})),
      onFilter: (value, record) => record.category === value,
    },
    {
      title: i18next.t("migration:From"),
      dataIndex: "sourceName",
      key: "sourceName",
      render: (name, record) => (
        <span>
          {name}
          {record.displayName && record.displayName !== name ? <Text type="secondary" style={{marginLeft: 8}}>{record.displayName}</Text> : null}
          {record.secrets ? (
            <Tooltip title={i18next.t("migration:This item carries an API key or token, which will be copied into OpenAgent.")}>
              <KeyOutlined style={{marginLeft: 8, color: "#faad14"}} />
            </Tooltip>
          ) : null}
        </span>
      ),
    },
    {
      title: i18next.t("migration:To"),
      dataIndex: "targetName",
      key: "targetName",
      render: name => <Text code>{name}</Text>,
    },
    {
      title: i18next.t("general:Action"),
      dataIndex: "action",
      key: "action",
      width: 120,
      render: (action, record) => (selectedKeys.includes(record.key) ? renderActionTag(action) : <Tag>{i18next.t("migration:Not selected")}</Tag>),
    },
    {
      title: i18next.t("general:Size"),
      dataIndex: "count",
      key: "count",
      width: 90,
      render: (count, record) => {
        if (!count) {
          return "-";
        }
        return record.category === "chat" ? i18next.t("migration:{count} messages").replace("{count}", count) : count;
      },
    },
    {
      title: i18next.t("migration:Note"),
      dataIndex: "reason",
      key: "reason",
      render: reason => (reason ? <Text type="secondary">{reason}</Text> : "-"),
    },
  ];

  return (
    <div>
      <Card size="small" style={{marginBottom: 16}}>
        <Descriptions size="small" column={{xs: 1, sm: 2, md: 4}}>
          <Descriptions.Item label={i18next.t("migration:Source")}>{plan.source}</Descriptions.Item>
          <Descriptions.Item label={i18next.t("migration:Version")}>{plan.sourceVersion || "-"}</Descriptions.Item>
          <Descriptions.Item label={i18next.t("general:Path")}>{plan.sourcePath || "-"}</Descriptions.Item>
          <Descriptions.Item label={i18next.t("general:Owner")}>{plan.owner}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={16} style={{marginBottom: 16}}>
        {(plan.summary || []).map(summary => (
          <Col key={summary.category} xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic
                title={getCategoryLabel(summary.category)}
                value={summary.create + summary.overwrite}
                suffix={summary.skip > 0 ? <Text type="secondary" style={{fontSize: 12}}>{`+${summary.skip} ${i18next.t("migration:skipped")}`}</Text> : null}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" title={i18next.t("migration:What to import")} style={{marginBottom: 16}} loading={replanning}>
        <Space direction="vertical" size="middle" style={{width: "100%"}}>
          <Space wrap>
            <Checkbox checked={options.includeSkills} onChange={e => setOption("includeSkills", e.target.checked)}>{i18next.t("general:Skills")}</Checkbox>
            <Checkbox checked={options.includeProviders} onChange={e => setOption("includeProviders", e.target.checked)}>{i18next.t("general:Providers")}</Checkbox>
            <Checkbox checked={options.includeMcpServers} onChange={e => setOption("includeMcpServers", e.target.checked)}>{i18next.t("general:MCP Servers")}</Checkbox>
            <Checkbox checked={options.includeAgents} onChange={e => setOption("includeAgents", e.target.checked)}>{i18next.t("general:Agents")}</Checkbox>
            <Checkbox checked={options.includeChats} onChange={e => setOption("includeChats", e.target.checked)}>{i18next.t("migration:Chat history")}</Checkbox>
          </Space>

          <div>
            <Text strong style={{marginRight: 12}}>{i18next.t("migration:When a name already exists")}</Text>
            <Radio.Group
              value={options.conflictPolicy}
              onChange={e => setOption("conflictPolicy", e.target.value)}
              optionType="button"
              options={[
                {label: i18next.t("migration:Import under a new name"), value: "rename"},
                {label: i18next.t("migration:Keep what OpenAgent has"), value: "skip"},
                {label: i18next.t("migration:Replace it"), value: "overwrite"},
              ]}
            />
          </div>
        </Space>
      </Card>

      {warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{marginBottom: 16}}
          message={i18next.t("migration:{count} things could not be mapped").replace("{count}", warnings.length)}
          description={
            <ul style={{marginBottom: 0, paddingLeft: 20}}>
              {warnings.map((warning, index) => (
                <li key={index}>
                  <Text strong>{warning.category}</Text>
                  {warning.item ? ` ${warning.item}` : ""}
                  {`: ${warning.reason}`}
                </li>
              ))}
            </ul>
          }
        />
      )}

      <Table
        size="small"
        rowKey="key"
        dataSource={items}
        columns={columns}
        loading={replanning}
        pagination={{pageSize: 20, hideOnSinglePage: true}}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: keys => setSelectedKeys(keys),
          getCheckboxProps: record => ({disabled: record.action === "skip"}),
        }}
        style={{marginBottom: 16}}
      />

      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <Button size="large" onClick={onBack}>{i18next.t("migration:Back")}</Button>
        <Space>
          <Text type="secondary">
            {i18next.t("migration:{count} items will be imported").replace("{count}", applicable)}
          </Text>
          <Button type="primary" size="large" loading={starting} disabled={applicable === 0} onClick={onStart}>
            {i18next.t("migration:Start migration")}
          </Button>
        </Space>
      </div>
    </div>
  );
}

export default PreviewStep;
