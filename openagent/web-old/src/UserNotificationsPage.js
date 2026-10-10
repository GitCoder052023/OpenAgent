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
import {Button, Empty, List, Pagination, Segmented, Space, Spin, Tag, Typography} from "antd";
import {BugOutlined, CheckCircleOutlined, CommentOutlined, InboxOutlined, RobotOutlined} from "@ant-design/icons";
import i18next from "i18next";
import * as Setting from "./Setting";
import * as NotificationBackend from "./backend/NotificationBackend";

const {Text, Paragraph} = Typography;
const pageSize = 10;

function getEventIcon(event) {
  if (event === "comment-added") {
    return <CommentOutlined />;
  }
  if (event === "issue-created" || event === "issue-updated") {
    return <BugOutlined />;
  }
  return <RobotOutlined />;
}

class UserNotificationsPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      notifications: [],
      loading: true,
      markingAll: false,
      readStatus: "all",
      page: 1,
      total: 0,
      unreadCount: 0,
    };
  }

  componentDidMount() {
    this.fetchNotifications();
  }

  fetchNotifications(page = this.state.page, readStatus = this.state.readStatus) {
    this.setState({loading: true});
    NotificationBackend.getUserNotifications(page, pageSize, readStatus)
      .then((res) => {
        if (res.status === "ok") {
          const meta = res.data2 || {};
          const unreadCount = meta.unreadCount || 0;
          this.setState({
            notifications: res.data || [],
            page,
            readStatus,
            total: meta.total || 0,
            unreadCount,
            loading: false,
          });
          this.props.onUnreadCountChange?.(unreadCount);
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
          this.setState({loading: false});
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
        this.setState({loading: false});
      });
  }

  markRead(notification, afterRead, refresh = true) {
    if (notification.isRead) {
      afterRead?.();
      return;
    }

    NotificationBackend.markNotificationRead(notification.owner, notification.name)
      .then((res) => {
        if (res.status === "ok" && refresh) {
          this.fetchNotifications(this.state.page, this.state.readStatus);
        }
        afterRead?.();
      })
      .catch(() => afterRead?.());
  }

  openNotification(notification) {
    const url = notification.url || `/agents/${notification.storeOwner}/${notification.storeName}`;
    this.markRead(notification, () => {
      if (url.startsWith("/")) {
        this.props.history.push(url);
      } else {
        window.location.href = url;
      }
    }, false);
  }

  markAllRead() {
    this.setState({markingAll: true});
    NotificationBackend.markAllNotificationsRead()
      .then((res) => {
        if (res.status !== "ok") {
          Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
        }
        this.setState({markingAll: false});
        this.fetchNotifications(1, this.state.readStatus);
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
        this.setState({markingAll: false});
      });
  }

  renderNotification(notification) {
    const agent = `${notification.storeOwner}/${notification.storeName}`;
    return (
      <List.Item
        key={`${notification.owner}/${notification.name}`}
        onClick={() => this.openNotification(notification)}
        style={{
          cursor: "pointer",
          padding: "14px 16px",
          background: notification.isRead ? "transparent" : "var(--ant-color-fill-quaternary)",
          borderBottom: "1px solid var(--ant-color-border-secondary)",
        }}
      >
        <div style={{display: "grid", gridTemplateColumns: "18px 24px minmax(0, 1fr) auto", gap: 12, alignItems: "center", width: "100%"}}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: notification.isRead ? "transparent" : "#1677ff",
              justifySelf: "center",
            }}
          />
          <span style={{color: notification.isRead ? "var(--ant-color-text-tertiary)" : "#1a7f37", fontSize: 18}}>
            {getEventIcon(notification.event)}
          </span>
          <div style={{minWidth: 0}}>
            <Space size={6} wrap style={{marginBottom: 2}}>
              <Text type="secondary" style={{fontSize: 12}}>{agent}</Text>
              <Tag style={{margin: 0}}>{notification.event}</Tag>
            </Space>
            <Paragraph
              strong={!notification.isRead}
              ellipsis={{rows: 1}}
              style={{margin: 0, fontSize: 14, color: "var(--ant-color-text)"}}
            >
              {notification.title || notification.event}
            </Paragraph>
            {notification.content ? (
              <Paragraph ellipsis={{rows: 1}} style={{margin: "2px 0 0", color: "var(--ant-color-text-secondary)"}}>
                {notification.content}
              </Paragraph>
            ) : null}
          </div>
          <Text type="secondary" style={{whiteSpace: "nowrap", fontSize: 12}}>{Setting.getFormattedDate(notification.createdTime)}</Text>
        </div>
      </List.Item>
    );
  }

  render() {
    const {notifications, loading, markingAll, readStatus, page, total, unreadCount} = this.state;
    return (
      <div style={{padding: "24px 32px", minHeight: "100vh", background: "var(--ant-color-bg-layout)"}}>
        <div style={{marginBottom: 18}}>
          <h2 style={{fontWeight: 700, fontSize: 24, marginBottom: 4}}>
            <InboxOutlined /> {i18next.t("general:Notifications")}
          </h2>
        </div>
        <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap"}}>
          <Segmented
            value={readStatus}
            onChange={(value) => this.fetchNotifications(1, value)}
            options={[
              {value: "all", label: i18next.t("store:All")},
              {value: "unread", label: `${i18next.t("general:Unread")} ${unreadCount}`},
              {value: "read", label: i18next.t("store:Read")},
            ]}
          />
          <Button icon={<CheckCircleOutlined />} loading={markingAll} disabled={unreadCount === 0} onClick={() => this.markAllRead()}>
            {i18next.t("general:Mark all as read")}
          </Button>
        </div>
        {loading ? (
          <div style={{textAlign: "center", padding: "80px 0"}}>
            <Spin size="large" />
          </div>
        ) : notifications.length === 0 ? (
          <Empty description={i18next.t("general:No notifications yet")} style={{marginTop: 60}} />
        ) : (
          <>
            <List
              itemLayout="horizontal"
              dataSource={notifications}
              renderItem={(notification) => this.renderNotification(notification)}
              style={{
                overflow: "hidden",
                border: "1px solid var(--ant-color-border)",
                borderRadius: 6,
                background: "var(--ant-color-bg-container)",
              }}
            />
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger={false}
              style={{marginTop: 16, textAlign: "right"}}
              onChange={(nextPage) => this.fetchNotifications(nextPage, readStatus)}
            />
          </>
        )}
      </div>
    );
  }
}

export default UserNotificationsPage;
