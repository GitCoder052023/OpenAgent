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
import {Button, Segmented, Space, Tooltip, Typography} from "antd";
import {ReloadOutlined} from "@ant-design/icons";
import i18next from "i18next";
import InsightsSecurity from "./InsightsSecurity";

const {Text} = Typography;

function getPeriodOptions() {
  return [
    {value: "24h", label: i18next.t("store:24h")},
    {value: "7d", label: i18next.t("store:7d")},
    {value: "30d", label: i18next.t("store:30d")},
  ];
}

function formatAsOf(iso) {
  if (!iso) {return "—";}
  const d = new Date(iso);
  if (isNaN(d.getTime())) {return iso;}
  return d.toLocaleString();
}

// StoreSecurity is the standalone top-level Security tab. It owns the period /
// refresh controls (the Insights shell that used to provide them is no longer
// its parent) and renders the InsightsSecurity report below the header.
class StoreSecurity extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      period: "7d",
      refreshTick: 0,
      asOf: null,
    };
  }

  handlePeriodChange = (period) => {
    this.setState({period, asOf: null});
  };

  handleRefresh = () => {
    this.setState((s) => ({refreshTick: s.refreshTick + 1, asOf: null}));
  };

  handleLoaded = (asOf) => {
    this.setState({asOf});
  };

  render() {
    const {account, owner, storeName} = this.props;
    const {period, refreshTick, asOf} = this.state;

    return (
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Space size="middle">
            <Segmented
              options={getPeriodOptions()}
              value={period}
              onChange={this.handlePeriodChange}
            />
            <Tooltip title={i18next.t("general:Refresh")}>
              <Button icon={<ReloadOutlined />} onClick={this.handleRefresh}>
                {i18next.t("general:Refresh")}
              </Button>
            </Tooltip>
          </Space>
          <Text type="secondary" style={{fontSize: 13}}>
            {i18next.t("store:Data as of")}: {formatAsOf(asOf)}
          </Text>
        </div>
        <InsightsSecurity
          account={account}
          owner={owner}
          storeName={storeName}
          period={period}
          refreshTick={refreshTick}
          onLoaded={this.handleLoaded}
        />
      </div>
    );
  }
}

export default StoreSecurity;
