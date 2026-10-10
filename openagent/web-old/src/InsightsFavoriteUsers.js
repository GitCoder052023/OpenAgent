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
import {Alert, Card, Col, Empty, Row, Spin, Statistic, Typography} from "antd";
import {ClockCircleOutlined, EyeOutlined, StarOutlined} from "@ant-design/icons";
import i18next from "i18next";
import * as StoreBackend from "./backend/StoreBackend";
import UserLabel from "./common/UserLabel";

// Shared implementation behind InsightsStargazers / InsightsWatchers: both are
// a KPI count plus a grid of users who favorited the store, differing only in
// favoriteType, the KPI icon, and the KPI label.
class InsightsFavoriteUsers extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      error: null,
      users: null,
    };
  }

  componentDidMount() {
    this.fetch();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.refreshTick !== this.props.refreshTick) {
      this.fetch();
    }
  }

  fetch() {
    const {owner, storeName, favoriteType, onLoaded} = this.props;
    this.setState({loading: true, error: null});
    StoreBackend.getStoreFavoriteUsers(owner, storeName, favoriteType)
      .then((res) => {
        if (res.status === "ok") {
          this.setState({loading: false, users: res.data});
          if (onLoaded) {onLoaded(new Date().toISOString());}
        } else {
          this.setState({loading: false, error: res.msg});
        }
      })
      .catch((err) => this.setState({loading: false, error: err.message || String(err)}));
  }

  renderKpiRow(users) {
    const {icon, titleKey} = this.props;
    return (
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title={<span>{icon} {i18next.t(titleKey)}</span>}
              value={users.length}
            />
          </Card>
        </Col>
      </Row>
    );
  }

  renderUserCards(users) {
    if (users.length === 0) {
      return (
        <Card size="small" style={{marginTop: 16}}>
          <Empty description={i18next.t("general:No data")} />
        </Card>
      );
    }
    return (
      <Row gutter={[16, 16]} style={{marginTop: 16}}>
        {users.map((u) => (
          <Col key={u.user} xs={24} sm={12} lg={8} xl={6}>
            <Card size="small" styles={{body: {padding: 14}}}>
              <div style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 8, minWidth: 0}}>
                <UserLabel user={u.user} account={this.props.account} size="default" strong nameStyle={{flex: 1}} />
              </div>
              <Typography.Text type="secondary" style={{fontSize: 12}}>
                <ClockCircleOutlined style={{marginRight: 6}} />
                {u.createdTime ? new Date(u.createdTime).toLocaleString() : "—"}
              </Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  render() {
    const {loading, error, users} = this.state;
    if (loading && !users) {
      return <div style={{padding: 40, textAlign: "center"}}><Spin /></div>;
    }
    if (error) {
      return <Alert type="error" message={error} />;
    }
    if (!users) {return null;}

    return (
      <Spin spinning={loading}>
        <div>
          {this.renderKpiRow(users)}
          {this.renderUserCards(users)}
        </div>
      </Spin>
    );
  }
}

export function InsightsStargazers(props) {
  return <InsightsFavoriteUsers {...props} favoriteType="star" icon={<StarOutlined />} titleKey="store:Stargazers" />;
}

export function InsightsWatchers(props) {
  return <InsightsFavoriteUsers {...props} favoriteType="watch" icon={<EyeOutlined />} titleKey="store:Watchers" />;
}
