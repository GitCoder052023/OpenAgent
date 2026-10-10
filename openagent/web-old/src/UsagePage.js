// Copyright 2024 The OpenAgent Authors. All Rights Reserved.
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
import {Col, Radio, Row, Select, Statistic} from "antd";
import BaseListPage from "./BaseListPage";
import * as Setting from "./Setting";
import * as UsageBackend from "./backend/UsageBackend";
import ReactEcharts from "echarts-for-react";
import i18next from "i18next";
import UsageTable from "./UsageTable";

// Multi-hue palette shared across charts
const CHART_COLORS = [
  "#1677ff", "#0ea5e9", "#06b6d4", "#14b8a6", "#6366f1",
  "#8b5cf6", "#0958d9", "#0284c7", "#0891b2", "#0f766e",
  "#5734d3", "#7c3aed", "#38bdf8", "#5eead4",
];

class UsagePage extends BaseListPage {
  constructor(props) {
    super(props);
    this.state = {
      classes: props,
      usages: null,
      usageMetadata: null,
      rangeType: "All",
      endpoint: this.getHost(),
      users: ["All"],
      selectedUser: "All",
      userTableInfo: null,
      selectedTableInfo: null,
      providerData: null,
      heatmapData: null,
    };
  }

  getHost() {
    let res = window.location.host;
    if (res === "localhost:13001") {
      res = "localhost:14000";
    }
    return res;
  }

  getUsages(serverUrl) {
    const selectedStore = Setting.getRequestStore(this.props.account);
    UsageBackend.getUsages(serverUrl, selectedStore, this.state.selectedUser, 30)
      .then((res) => {
        if (selectedStore !== Setting.getRequestStore(this.props.account)) {return;}
        if (res.status === "ok") {
          this.setState({
            usages: res.data,
            usageMetadata: res.data2,
          });
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        }
      });
  }

  getCountFromRangeType(rangeType) {
    if (rangeType === "Hour") {
      return 72;
    } else if (rangeType === "Day") {
      return 30;
    } else if (rangeType === "Week") {
      return 16;
    } else if (rangeType === "Month") {
      return 12;
    } else {
      return 30;
    }
  }

  getRangeUsagesAll(serverUrl) {
    this.getRangeUsages(serverUrl, "Hour");
    this.getRangeUsages(serverUrl, "Day");
    this.getRangeUsages(serverUrl, "Week");
    this.getRangeUsages(serverUrl, "Month");
  }

  updateTableInfo(user) {
    if (user === "All") {
      this.setState({selectedTableInfo: this.state.userTableInfo});
    } else {
      const filtered = (this.state.userTableInfo || []).filter(item => item.user === this.state.users[user]);
      this.setState({selectedTableInfo: filtered});
    }
  }

  getUsers(serverUrl) {
    UsageBackend.getUsers(serverUrl, this.props.account.name, Setting.getRequestStore(this.props.account))
      .then((res) => {
        if (res.status === "ok") {
          const selectedUser = !Setting.canViewAllUsers(this.props.account) ? res.data[0] : "All";
          this.setState({
            users: res.data,
            selectedUser: selectedUser,
          }, () => {
            this.getUsages("");
            this.getRangeUsagesAll("");
            this.getUserTableInfos("");
            this.getUsageProviders();
            this.getUsageHeatmap();
          }
          );
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        }
      });
  }

  getUsageProviders() {
    const owner = this.props.account?.owner ?? "admin";
    UsageBackend.getUsageProviders(owner)
      .then((res) => {
        if (res.status === "ok") {
          this.setState({providerData: res.data});
        }
      });
  }

  getUsageHeatmap() {
    const owner = this.props.account?.owner ?? "admin";
    UsageBackend.getUsageHeatmap(owner)
      .then((res) => {
        if (res.status === "ok") {
          this.setState({heatmapData: res.data});
        }
      });
  }
  getRangeUsages(serverUrl, rangeType) {
    const selectedStore = Setting.getRequestStore(this.props.account);
    const count = this.getCountFromRangeType(rangeType);
    UsageBackend.getRangeUsages(serverUrl, rangeType, count, selectedStore, this.state.selectedUser)
      .then((res) => {
        if (selectedStore !== Setting.getRequestStore(this.props.account)) {return;}
        if (res.status === "ok") {
          const state = {};
          state[`rangeUsages${rangeType}`] = res.data;
          this.setState(state);
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        }
      });
  }
  getUserTableInfos(serverUrl) {
    const selectedStore = Setting.getRequestStore(this.props.account);
    UsageBackend.getUserTableInfos(serverUrl, selectedStore, this.props.account.name)
      .then((res) => {
        if (selectedStore !== Setting.getRequestStore(this.props.account)) {return;}
        if (res.status === "ok") {
          this.setState({
            userTableInfo: res.data,
          }, () => {
            this.updateTableInfo("All");
          });
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        }
      });
  }

  renderProviderChart(isDark) {
    const {providerData} = this.state;
    if (!providerData || providerData.length === 0) {
      return null;
    }
    const option = {
      color: CHART_COLORS,
      tooltip: {trigger: "item", formatter: "{b}: {c} ({d}%)"},
      legend: {
        type: "scroll",
        orient: "vertical",
        right: 8,
        left: "56%",
        top: "center",
        textStyle: {fontSize: 12},
      },
      series: [{
        type: "pie",
        radius: ["42%", "68%"],
        center: ["26%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: {borderRadius: 5, borderColor: isDark ? "#1f1f1f" : "#fff", borderWidth: 2},
        label: {show: false},
        emphasis: {
          label: {show: true, fontSize: 13, fontWeight: "bold"},
          itemStyle: {shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.25)"},
        },
        data: providerData.map(p => ({
          name: p.category || i18next.t("application:Unknown"),
          value: p.count,
        })),
      }],
    };
    return (
      <ReactEcharts
        option={option}
        theme={isDark ? "dark" : undefined}
        style={{height: "260px", width: "100%"}}
      />
    );
  }

  renderHeatmapChart(isDark) {
    const {heatmapData} = this.state;
    if (!heatmapData || !heatmapData.data) {
      return null;
    }
    const range = (heatmapData.dateRange && heatmapData.dateRange.length === 2)
      ? heatmapData.dateRange
      : (() => {
        const end = new Date();
        const start = new Date(end);
        start.setFullYear(end.getFullYear() - 1);
        return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
      })();
    const cellBg = isDark ? "#2a2a2a" : "#f3f0ff";
    const cellBorder = isDark ? "#141414" : "#fff";
    const heatColors = isDark
      ? ["#2a2a2a", "#3a2a5a", "#5a3a8a", "#7c5ce0", "#5734d3"]
      : ["#f3f0ff", "#d9d1f7", "#b5a8ef", "#7c5ce0", "#5734d3"];
    const option = {
      tooltip: {
        position: "top",
        formatter: (params) => {
          const [date, count] = params.data;
          return `${date} &nbsp; <b>${count}</b>`;
        },
      },
      visualMap: {
        min: 0,
        max: Math.max(heatmapData.maxCount, 1),
        show: false,
        inRange: {color: heatColors},
      },
      calendar: {
        top: 28,
        left: 36,
        right: 8,
        bottom: 0,
        range,
        cellSize: [13, 13],
        itemStyle: {
          color: cellBg,
          borderWidth: 2,
          borderColor: cellBorder,
          borderRadius: 2,
        },
        dayLabel: {
          firstDay: 0,
          nameMap: [
            i18next.t("usage:Sun"),
            i18next.t("usage:Mon"),
            i18next.t("usage:Tue"),
            i18next.t("usage:Wed"),
            i18next.t("usage:Thu"),
            i18next.t("usage:Fri"),
            i18next.t("usage:Sat"),
          ],
          fontSize: 10,
          color: isDark ? "#aaa" : "#888",
        },
        monthLabel: {
          nameMap: [
            i18next.t("usage:Jan"),
            i18next.t("usage:Feb"),
            i18next.t("usage:Mar"),
            i18next.t("usage:Apr"),
            i18next.t("usage:May"),
            i18next.t("usage:Jun"),
            i18next.t("usage:Jul"),
            i18next.t("usage:Aug"),
            i18next.t("usage:Sep"),
            i18next.t("usage:Oct"),
            i18next.t("usage:Nov"),
            i18next.t("usage:Dec"),
          ],
          fontSize: 11,
          color: isDark ? "#bbb" : "#555",
        },
        yearLabel: {show: false},
        splitLine: {show: false},
      },
      series: [{
        type: "heatmap",
        coordinateSystem: "calendar",
        data: heatmapData.data.map(d => [d.date, d.count]),
        itemStyle: {borderRadius: 2},
      }],
    };
    return (
      <ReactEcharts
        option={option}
        theme={isDark ? "dark" : undefined}
        style={{height: "200px", width: "100%"}}
      />
    );
  }

  renderLeftChart(usages) {
    const dates = usages.map(usage => usage.date);
    const userCounts = usages.map(usage => usage.userCount);
    const chatCounts = usages.map(usage => usage.chatCount);

    const leftOption = {
      tooltip: {
        trigger: "axis",
      },
      legend: {
        data: [i18next.t("general:Users"), i18next.t("general:Chats")],
      },
      toolbox: {
        feature: {
          saveAsImage: {},
        },
      },
      grid: {
        left: "10%",
        right: "10%",
        bottom: "3%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: dates,
      },
      yAxis: [
        {
          type: "value",
          name: i18next.t("general:Users"),
          position: "left",
        },
        {
          type: "value",
          name: i18next.t("general:Chats"),
          position: "right",
        },
      ],
      series: [
        {
          name: i18next.t("general:Users"),
          type: "line",
          data: userCounts,
        },
        {
          name: i18next.t("general:Chats"),
          type: "line",
          yAxisIndex: 1,
          data: chatCounts,
        },
      ],
    };

    return leftOption;
  }

  renderRightChart(usages) {
    const dates = usages.map(usage => usage.date);
    const messageCounts = usages.map(usage => usage.messageCount);
    const tokenCounts = usages.map(usage => usage.tokenCount);
    const prices = usages.map(usage => usage.price);

    const rightOption = {
      tooltip: {
        trigger: "axis",
      },
      legend: {
        data: [i18next.t("general:Messages"), i18next.t("general:Tokens"), i18next.t("chat:Price")],
      },
      toolbox: {
        feature: {
          saveAsImage: {},
        },
      },
      grid: {
        left: "10%",
        right: "10%",
        bottom: "3%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: dates,
      },
      yAxis: [
        {
          type: "value",
          name: i18next.t("general:Messages"),
          position: "left",
        },
        {
          type: "value",
          name: i18next.t("general:Tokens"),
          position: "right",
        },
        {
          type: "value",
          name: i18next.t("chat:Price"),
          position: "right",
          offset: 60,
          axisLabel: {
            margin: 2,
          },
        },
      ],
      series: [
        {
          name: i18next.t("general:Messages"),
          type: "line",
          data: messageCounts,
        },
        {
          name: i18next.t("general:Tokens"),
          type: "line",
          yAxisIndex: 1,
          data: tokenCounts,
        },
        {
          name: i18next.t("chat:Price"),
          type: "line",
          yAxisIndex: 2,
          data: prices,
        },
      ],
    };

    if (this.props.account.name !== "admin") {
      rightOption.legend.data = rightOption.legend.data.filter(item => item !== i18next.t("chat:Price"));
      rightOption.yAxis = rightOption.yAxis.filter(yAxis => yAxis.name !== i18next.t("chat:Price"));
      rightOption.series = rightOption.series.filter(series => series.name !== i18next.t("chat:Price"));
    }

    return rightOption;
  }

  renderStatistic(usages) {
    const lastUsage = usages && usages.length > 0 ? usages[usages.length - 1] : {
      userCount: 0,
      chatCount: 0,
      messageCount: 0,
      tokenCount: 0,
      price: 0,
      currency: "USD",
    };

    const isLoading = this.state.usages === null;

    return (
      <Row gutter={16}>
        {
          this.props.account.name !== "admin" ? <Col span={6} /> : (
            <React.Fragment>
              <Col span={3}>
                <Statistic
                  loading={isLoading}
                  title={i18next.t("task:Application")}
                  value={this.state.usageMetadata?.application}
                />
              </Col>
            </React.Fragment>
          )
        }
        <Col span={3}>
          <Statistic
            loading={isLoading}
            title={i18next.t("general:Users")}
            value={lastUsage.userCount}
          />
        </Col>
        <Col span={3}>
          <Statistic
            loading={isLoading}
            title={i18next.t("general:Chats")}
            value={lastUsage.chatCount}
          />
        </Col>
        <Col span={3}>
          <Statistic
            loading={isLoading}
            title={i18next.t("general:Messages")}
            value={lastUsage.messageCount}
          />
        </Col>
        <Col span={3}>
          <Statistic
            loading={isLoading}
            title={i18next.t("general:Tokens")}
            value={lastUsage.tokenCount}
          />
        </Col>
        {
          this.props.account.name !== "admin" ? null : (
            <React.Fragment>
              <Col span={3}>
                <Statistic
                  loading={isLoading}
                  title={i18next.t("chat:Price")}
                  value={lastUsage.price}
                  prefix={lastUsage.currency && "$"}
                />
              </Col>
            </React.Fragment>
          )
        }
      </Row>
    );
  }

  getServerUrlFromEndpoint(endpoint) {
    if (endpoint === "localhost:14000") {
      return `http://${endpoint}`;
    } else {
      return `https://${endpoint}`;
    }
  }

  getUsagesForAllCases(endpoint, rangeType) {
    if (endpoint === "") {
      endpoint = this.state.endpoint;
    }
    const serverUrl = this.getServerUrlFromEndpoint(endpoint);

    if (rangeType === "") {
      rangeType = this.state.rangeType;
    }
    const stateReset = {usages: null};
    if (rangeType !== "All") {
      stateReset[`rangeUsages${rangeType}`] = null;
    }
    this.setState(stateReset, () => {
      this.getRangeUsagesAll(serverUrl);
      this.getUsages(serverUrl);
    });
    // if (rangeType === "All") {
    //   this.getUsages(serverUrl);
    // } else {
    //   this.getRangeUsagesAll(serverUrl);
    // }
  }

  renderRadio() {
    return (
      <div style={{marginTop: "-10px", float: "right"}}>
        {this.renderDropdown()}
        <Radio.Group style={{marginBottom: "10px"}} buttonStyle="solid" value={this.state.rangeType} onChange={e => {
          const rangeType = e.target.value;
          this.setState({
            rangeType: rangeType,
          }
          );
        }}>
          <Radio.Button value={"All"}>{i18next.t("store:All")}</Radio.Button>
          <Radio.Button value={"Hour"}>{i18next.t("usage:Hour")}</Radio.Button>
          <Radio.Button value={"Day"}>{i18next.t("usage:Day")}</Radio.Button>
          <Radio.Button value={"Week"}>{i18next.t("usage:Week")}</Radio.Button>
          <Radio.Button value={"Month"}>{i18next.t("usage:Month")}</Radio.Button>
        </Radio.Group>
        {this.renderSelect()}
      </div>
    );
  }

  renderSelect() {
    return null;
  }

  renderDropdown() {
    const users_options = [
      <option key="all" value="All" disabled={!Setting.canViewAllUsers(this.props.account)}>
        All
      </option>,
      ...this.state.users.map((user, index) => (
        <option key={index} value={index}>
          {user}
        </option>
      )),
    ];
    const handleChange = (value) => {
      let user;
      if (value === "All") {
        user = "All";
      } else {
        user = this.state.users[value];
      }
      this.setState({
        selectedUser: user,
      }, () => {
        this.getUsagesForAllCases("", this.state.rangeType);
        this.updateTableInfo(value);
      });
    };

    return (
      <div style={{display: "flex", alignItems: "center", marginBottom: "10px"}}>
        <span style={{width: "50px", marginRight: "10px"}}>{i18next.t("general:User")}:</span>
        <Select
          virtual={true}
          value={this.state.selectedUser}
          onChange={(value => handleChange(value))}
          style={{width: "100%"}}
        >
          {users_options}
        </Select>
      </div>
    );
  }

  formatDate(date, rangeType) {
    const dateTime = new Date(date);

    switch (rangeType) {
    case "Hour": {
      return `${date}:00`;
    }
    case "Day": {
      return date;
    }
    case "Week": {
      const startOfWeek = dateTime;
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Add 6 days to get to the end of the week

      const startMonth = String(startOfWeek.getMonth() + 1).padStart(2, "0");
      const startDay = String(startOfWeek.getDate()).padStart(2, "0");
      const endMonth = String(endOfWeek.getMonth() + 1).padStart(2, "0");
      const endDay = String(endOfWeek.getDate()).padStart(2, "0");
      return `${startMonth}-${startDay} ~ ${endMonth}-${endDay}`;
    }
    case "Month": {
      return date.slice(0, 7);
    }
    default: {
      return date;
    }
    }
  }

  renderLeftRangeChart(usages) {
    const rangeType = this.state.rangeType;
    const xData = usages.map(usage => this.formatDate(usage.date, rangeType));
    const userCountData = usages.map(usage => usage.userCount);
    const chatCountData = usages.map(usage => usage.chatCount);

    const options = {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
        },
      },
      legend: {
        data: [i18next.t("general:Users"), i18next.t("general:Chats")],
      },
      xAxis: [
        {
          type: "category",
          data: xData,
          axisPointer: {
            type: "shadow",
          },
        },
      ],
      yAxis: [
        {
          type: "value",
          name: i18next.t("general:Users"),
          position: "left",
        },
        {
          type: "value",
          name: i18next.t("general:Chats"),
          position: "right",
        },
      ],
      series: [
        {
          name: i18next.t("general:Users"),
          type: "bar",
          data: userCountData,
        },
        {
          name: i18next.t("general:Chats"),
          type: "bar",
          yAxisIndex: 1,
          data: chatCountData,
        },
      ],
    };

    return options;
  }

  renderRightRangeChart(usages) {
    const rangeType = this.state.rangeType;
    const xData = usages.map(usage => this.formatDate(usage.date, rangeType));
    const messageCountData = usages.map(usage => usage.messageCount);
    const tokenCountData = usages.map(usage => usage.tokenCount);
    const priceData = usages.map(usage => usage.price);

    const options = {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          crossStyle: {
            color: "#999",
          },
        },
      },
      legend: {
        data: [i18next.t("general:Messages"), i18next.t("general:Tokens"), i18next.t("chat:Price")],
      },
      xAxis: [
        {
          type: "category",
          data: xData,
          axisPointer: {
            type: "shadow",
          },
        },
      ],
      yAxis: [
        {
          type: "value",
          name: i18next.t("general:Messages"),
          position: "left",
        },
        {
          type: "value",
          name: i18next.t("general:Tokens"),
          position: "right",
        },
        {
          type: "value",
          name: i18next.t("chat:Price"),
          position: "right",
          offset: 60,
          axisLabel: {
            margin: 2,
          },
        },
      ],
      series: [
        {
          name: i18next.t("general:Messages"),
          type: "bar",
          data: messageCountData,
        },
        {
          name: i18next.t("general:Tokens"),
          type: "bar",
          yAxisIndex: 1,
          data: tokenCountData,
        },
        {
          name: i18next.t("chat:Price"),
          type: "bar",
          yAxisIndex: 2,
          data: priceData,
        },
      ],
    };

    if (this.props.account.name !== "admin") {
      options.legend.data = options.legend.data.filter(item => item !== i18next.t("chat:Price"));
      options.yAxis = options.yAxis.filter(yAxis => yAxis.name !== i18next.t("chat:Price"));
      options.series = options.series.filter(series => series.name !== i18next.t("chat:Price"));
    }

    return options;
  }

  renderChart() {
    const isDark = this.props.themeAlgorithm && this.props.themeAlgorithm.includes("dark");
    if (this.state.rangeType === "All") {
      return (
        <React.Fragment>
          <Row style={{marginTop: "20px"}} >
            <Col span={1} />
            <Col span={11} >
              <ReactEcharts
                option={this.renderLeftChart(this.state.usages || [])}
                theme={isDark ? "dark" : undefined}
                style={{
                  height: "400px",
                  width: "100%",
                  display: "inline-block",
                }}
                showLoading={this.state.usages === null}
                loadingOption={{
                  color: localStorage.getItem("themeColor"),
                  fontSize: "16px",
                  spinnerRadius: 6,
                  lineWidth: 3,
                  fontWeight: "bold",
                  text: "",
                }}
              />
            </Col>
            <Col span={11} >
              <ReactEcharts
                option={this.renderRightChart(this.state.usages || [])}
                theme={isDark ? "dark" : undefined}
                style={{
                  height: "400px",
                  width: "100%",
                  display: "inline-block",
                }}
                showLoading={this.state.usages === null}
                loadingOption={{
                  color: localStorage.getItem("themeColor"),
                  fontSize: "16px",
                  spinnerRadius: 6,
                  lineWidth: 3,
                  fontWeight: "bold",
                  text: "",
                }}
              />
            </Col>
            <Col span={1} />
          </Row>
        </React.Fragment>
      );
    } else {
      const fieldName = `rangeUsages${this.state.rangeType}`;
      const rangeUsages = this.state[fieldName];

      return (
        <React.Fragment>
          <ReactEcharts
            option={this.renderLeftRangeChart(rangeUsages || [])}
            theme={isDark ? "dark" : undefined}
            style={{
              height: "400px",
              width: "48%",
              display: "inline-block",
            }}
            showLoading={rangeUsages === null}
            loadingOption={{
              color: localStorage.getItem("themeColor"),
              fontSize: "16px",
              spinnerRadius: 6,
              lineWidth: 3,
              fontWeight: "bold",
              text: "",
            }}
          />
          <ReactEcharts
            option={this.renderRightRangeChart(rangeUsages || [])}
            theme={isDark ? "dark" : undefined}
            style={{
              height: "400px",
              width: "48%",
              display: "inline-block",
            }}
            showLoading={rangeUsages === null}
            loadingOption={{
              color: localStorage.getItem("themeColor"),
              fontSize: "16px",
              spinnerRadius: 6,
              lineWidth: 3,
              fontWeight: "bold",
              text: "",
            }}
          />
        </React.Fragment>
      );
    }
  }

  render() {
    const isDark = this.props.themeAlgorithm && this.props.themeAlgorithm.includes("dark");
    const cardBorder = isDark ? "1px solid #303030" : "1px solid #e8e8e8";
    return (
      <div style={{backgroundColor: isDark ? "#141414" : "white"}}>
        <Row style={{marginTop: "20px"}} >
          <Col span={1} />
          <Col span={17} >
            {this.renderStatistic(this.state.usages)}
          </Col>
          <Col span={5} >
            {this.renderRadio()}
          </Col>
          <Col span={1} />
        </Row>
        <Row style={{marginTop: "20px"}} >
          <Col span={24} >
            {this.renderChart()}
          </Col>
        </Row>
        {(this.state.providerData || this.state.heatmapData) && (
          <Row gutter={16} style={{marginTop: "20px"}}>
            {this.state.providerData && this.state.providerData.length > 0 && (
              <Col xs={24} xl={8}>
                <div style={{border: cardBorder, borderRadius: 8, padding: "16px 16px 8px"}}>
                  <div style={{marginBottom: 8, fontWeight: 500}}>{i18next.t("general:Providers")}</div>
                  {this.renderProviderChart(isDark)}
                </div>
              </Col>
            )}
            {this.state.heatmapData && (
              <Col xs={24} xl={this.state.providerData && this.state.providerData.length > 0 ? 16 : 24}>
                <div style={{border: cardBorder, borderRadius: 8, padding: "16px 16px 8px"}}>
                  <div style={{marginBottom: 8, fontWeight: 500}}>{i18next.t("general:Messages")}</div>
                  {this.renderHeatmapChart(isDark)}
                </div>
              </Col>
            )}
          </Row>
        )}
        <Row style={{marginTop: "20px"}} >
          <Col span={24} >
            <UsageTable account={this.props.account} data={this.state.selectedTableInfo === null ? this.state.userTableInfo : this.state.selectedTableInfo} />
          </Col>
        </Row>
      </div>
    );
  }

  fetch = () => {
    const reset = {usages: null, userTableInfo: null, selectedTableInfo: null, providerData: null, heatmapData: null};
    if (this.state.rangeType !== "All") {
      reset[`rangeUsages${this.state.rangeType}`] = null;
    }
    this.setState(reset, () => this.getUsers(""));
  };
}

export default UsagePage;
