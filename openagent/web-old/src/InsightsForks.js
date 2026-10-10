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
import {Alert, Avatar, Card, Col, Empty, Row, Spin, Statistic, Typography} from "antd";
import {ForkOutlined} from "@ant-design/icons";
import {Link} from "react-router-dom";
import i18next from "i18next";
import * as StoreBackend from "./backend/StoreBackend";
import UserLabel from "./common/UserLabel";

class InsightsForks extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      error: null,
      forks: null,
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
    const {owner, storeName, onLoaded} = this.props;
    this.setState({loading: true, error: null});
    StoreBackend.getStoreForks(owner, storeName)
      .then((res) => {
        if (res.status === "ok") {
          this.setState({loading: false, forks: res.data});
          if (onLoaded) {onLoaded(new Date().toISOString());}
        } else {
          this.setState({loading: false, error: res.msg});
        }
      })
      .catch((err) => this.setState({loading: false, error: err.message || String(err)}));
  }

  renderKpiRow(forks) {
    return (
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title={<span><ForkOutlined /> {i18next.t("store:Forks")}</span>}
              value={forks.length}
            />
          </Card>
        </Col>
      </Row>
    );
  }

  renderForkCards(forks) {
    if (forks.length === 0) {
      return (
        <Card size="small" style={{marginTop: 16}}>
          <Empty description={i18next.t("general:No data")} />
        </Card>
      );
    }
    return (
      <Row gutter={[16, 16]} style={{marginTop: 16}}>
        {forks.map((store) => (
          <Col key={`${store.owner}/${store.name}`} xs={24} sm={12} lg={8} xl={6}>
            <Card size="small" styles={{body: {padding: 14}}}>
              <div style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 8, minWidth: 0}}>
                <Avatar src={store.avatar} style={{flexShrink: 0}}>
                  {(store.displayName || store.name || "?").charAt(0).toUpperCase()}
                </Avatar>
                <Typography.Text strong ellipsis={{tooltip: store.displayName || store.name}} style={{minWidth: 0, flex: 1}}>
                  <Link to={`/agents/${store.owner}/${store.name}`}>{store.displayName || store.name}</Link>
                </Typography.Text>
              </div>
              {store.description && (
                <Typography.Paragraph
                  type="secondary"
                  style={{fontSize: 12, marginBottom: 8}}
                  ellipsis={{rows: 2}}
                >
                  {store.description}
                </Typography.Paragraph>
              )}
              <UserLabel user={store.owner} account={this.props.account} size="small" />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  render() {
    const {loading, error, forks} = this.state;
    if (loading && !forks) {
      return <div style={{padding: 40, textAlign: "center"}}><Spin /></div>;
    }
    if (error) {
      return <Alert type="error" message={error} />;
    }
    if (!forks) {return null;}

    return (
      <Spin spinning={loading}>
        <div>
          {this.renderKpiRow(forks)}
          {this.renderForkCards(forks)}
        </div>
      </Spin>
    );
  }
}

export default InsightsForks;
