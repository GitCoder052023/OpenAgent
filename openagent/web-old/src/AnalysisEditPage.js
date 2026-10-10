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

import React, {Component} from "react";
import {Spin, Typography} from "antd";
import * as AnalysisBackend from "./backend/AnalysisBackend";
import * as Setting from "./Setting";
import WordCloudChart from "./WordCloudChart";
import BreadcrumbBar from "./common/BreadcrumbBar";
import i18next from "i18next";

const {Title} = Typography;

class AnalysisEditPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      storeName: props.match.params.storeName,
      wordCountMap: null,
      loading: true,
    };
  }

  componentDidMount() {
    this.loadWordCloud();
  }

  loadWordCloud() {
    AnalysisBackend.getStoreWordCloud(this.state.storeName)
      .then((res) => {
        if (res.status === "ok") {
          this.setState({wordCountMap: res.data, loading: false});
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
          this.setState({loading: false});
        }
      })
      .catch((error) => {
        Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${error}`);
        this.setState({loading: false});
      });
  }

  render() {
    const {storeName, wordCountMap, loading} = this.state;

    return (
      <div style={{padding: "24px"}}>
        <BreadcrumbBar uri={this.props.location.pathname} />
        <Title level={3} style={{marginTop: "16px"}}>{i18next.t("store:Word Cloud")} — {storeName}</Title>
        {loading ? (
          <div style={{textAlign: "center", paddingTop: "100px"}}>
            <Spin size="large" />
          </div>
        ) : wordCountMap && Object.keys(wordCountMap).length > 0 ? (
          <WordCloudChart wordCountMap={wordCountMap} />
        ) : (
          <div style={{textAlign: "center", paddingTop: "100px", color: "#999"}}>
            {i18next.t("store:No message data available")}
          </div>
        )}
      </div>
    );
  }
}

export default AnalysisEditPage;
