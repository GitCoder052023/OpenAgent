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
import {Alert, Card, Col, Empty, Row, Slider, Spin, Statistic, Typography} from "antd";
import {CloudOutlined} from "@ant-design/icons";
import i18next from "i18next";
import * as AnalysisBackend from "./backend/AnalysisBackend";
import WordCloudChart from "./WordCloudChart";

class InsightsWordCloud extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      error: null,
      wordMap: null,
      minFreq: 2,
    };
  }

  componentDidMount() {
    this.fetch();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.period !== this.props.period || prevProps.refreshTick !== this.props.refreshTick) {
      this.fetch();
    }
  }

  fetch() {
    const {storeName, period, onLoaded} = this.props;
    this.setState({loading: true, error: null});
    AnalysisBackend.getStoreWordCloud(storeName, period)
      .then((res) => {
        if (res.status === "ok") {
          this.setState({loading: false, wordMap: res.data || {}});
          if (onLoaded) {onLoaded(new Date().toISOString());}
        } else {
          this.setState({loading: false, error: res.msg});
        }
      })
      .catch((err) => this.setState({loading: false, error: err.message || String(err)}));
  }

  render() {
    const {loading, error, wordMap, minFreq} = this.state;
    if (loading && !wordMap) {
      return <div style={{padding: 40, textAlign: "center"}}><Spin /></div>;
    }
    if (error) {
      return <Alert type="error" message={error} />;
    }
    if (!wordMap) {return null;}

    const entries = Object.entries(wordMap);
    // Cap slider max at the largest observed frequency (fall back to 1 for empty maps).
    const maxFreq = entries.reduce((m, [, v]) => (v > m ? v : m), 1);
    // Clamp the default (2) down when every word's frequency is below it, so the
    // filter doesn't hide all words on stores with little activity.
    const effectiveMinFreq = Math.min(minFreq, maxFreq);
    const filtered = entries.filter(([, v]) => v >= effectiveMinFreq);
    const filteredMap = Object.fromEntries(filtered);
    const distinctTotal = entries.length;
    const distinctShown = filtered.length;

    return (
      <Spin spinning={loading}>
        <div>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title={<span><CloudOutlined /> {i18next.t("store:Distinct words")}</span>}
                  value={distinctTotal}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title={i18next.t("store:Shown after filter")}
                  value={distinctShown}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <div style={{marginBottom: 4}}>
                  <Typography.Text type="secondary">
                    {i18next.t("store:Min frequency")}: {effectiveMinFreq}
                  </Typography.Text>
                </div>
                <Slider
                  min={1}
                  max={maxFreq}
                  value={effectiveMinFreq}
                  onChange={(v) => this.setState({minFreq: v})}
                />
              </Card>
            </Col>
          </Row>
          <Card size="small" style={{marginTop: 16}}>
            {distinctShown === 0 ? (
              <Empty style={{marginTop: 16}} description={i18next.t("store:No words match the current filter")} />
            ) : (
              <WordCloudChart
                key={`${distinctShown}-${effectiveMinFreq}`}
                wordCountMap={filteredMap}
                height={"calc(100vh - 380px)"}
              />
            )}
          </Card>
        </div>
      </Spin>
    );
  }
}

export default InsightsWordCloud;
