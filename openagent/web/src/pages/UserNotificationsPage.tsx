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

import * as React from "react";
import i18next from "i18next";
import {Bot, Bug, CheckCheck, ChevronLeft, ChevronRight, Inbox, MessageSquare} from "lucide-react";
import {useNavigate} from "react-router-dom";
import * as NotificationBackend from "@/backend/NotificationBackend";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Loading} from "@/components/common/Loading";
import {PageHeader} from "@/components/crud/PageHeader";
import {setUnreadNotificationCount} from "@/hooks/use-unread-notifications";
import * as Setting from "@/lib/setting";
import {cn} from "@/lib/utils";

const pageSize = 10;

function EventIcon({event}: {event: string}) {
  if (event === "comment-added") {
    return <MessageSquare className="h-[18px] w-[18px]" />;
  }
  if (event === "issue-created" || event === "issue-updated") {
    return <Bug className="h-[18px] w-[18px]" />;
  }
  return <Bot className="h-[18px] w-[18px]" />;
}

export default function UserNotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [markingAll, setMarkingAll] = React.useState(false);
  const [readStatus, setReadStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [unreadCount, setUnreadCount] = React.useState(0);

  const fetchNotifications = React.useCallback((nextPage: number, nextReadStatus: string) => {
    setLoading(true);
    NotificationBackend.getUserNotifications(nextPage, pageSize, nextReadStatus)
      .then((res: any) => {
        if (res.status === "ok") {
          const meta = res.data2 || {};
          setNotifications(res.data || []);
          setPage(nextPage);
          setReadStatus(nextReadStatus);
          setTotal(meta.total || 0);
          setUnreadCount(meta.unreadCount || 0);
          setUnreadNotificationCount(meta.unreadCount || 0);
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to get")}: ${res.msg}`);
        }
      })
      .catch((error: any) => Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    fetchNotifications(1, "all");
  }, [fetchNotifications]);

  const openNotification = (notification: any) => {
    const url = notification.url || `/agents/${notification.storeOwner}/${notification.storeName}`;
    const go = () => {
      if (url.startsWith("/")) {
        navigate(url);
      } else {
        window.location.href = url;
      }
    };
    if (notification.isRead) {
      go();
      return;
    }
    NotificationBackend.markNotificationRead(notification.owner, notification.name).finally(go);
  };

  const markAllRead = () => {
    setMarkingAll(true);
    NotificationBackend.markAllNotificationsRead()
      .then((res: any) => {
        if (res.status !== "ok") {
          Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
        }
        fetchNotifications(1, readStatus);
      })
      .catch((error: any) => Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`))
      .finally(() => setMarkingAll(false));
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            {i18next.t("general:Notifications")}
          </span>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={readStatus} onValueChange={(value) => fetchNotifications(1, value)}>
          <TabsList>
            <TabsTrigger value="all">{i18next.t("store:All")}</TabsTrigger>
            <TabsTrigger value="unread">{i18next.t("general:Unread")} {unreadCount}</TabsTrigger>
            <TabsTrigger value="read">{i18next.t("store:Read")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" loading={markingAll} disabled={unreadCount === 0} onClick={markAllRead}>
          <CheckCheck />
          {i18next.t("general:Mark all as read")}
        </Button>
      </div>

      {loading ? (
        <Loading className="py-20" />
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
          <Inbox className="h-10 w-10 opacity-40" />
          {i18next.t("general:No notifications yet")}
        </div>
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {notifications.map((notification) => (
              <li key={`${notification.owner}/${notification.name}`}>
                <button
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={cn(
                    "grid w-full grid-cols-[8px_20px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/60",
                    !notification.isRead && "bg-muted/50",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", !notification.isRead && "bg-primary")} />
                  <span className={notification.isRead ? "text-muted-foreground" : "text-success"}>
                    <EventIcon event={notification.event} />
                  </span>
                  <div className="min-w-0">
                    <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{notification.storeOwner}/{notification.storeName}</span>
                      <Badge variant="outline" className="font-normal">{notification.event}</Badge>
                    </div>
                    <div className={cn("truncate text-sm", !notification.isRead && "font-semibold")}>
                      {notification.title || notification.event}
                    </div>
                    {notification.content ? (
                      <div className="truncate text-sm text-muted-foreground">{notification.content}</div>
                    ) : null}
                  </div>
                  <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {Setting.getFormattedDate(notification.createdTime)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {pageCount > 1 ? (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button variant="outline" size="iconSm" disabled={page <= 1} onClick={() => fetchNotifications(page - 1, readStatus)} aria-label="Previous">
                <ChevronLeft />
              </Button>
              <span className="tabular-nums text-muted-foreground">{page} / {pageCount}</span>
              <Button variant="outline" size="iconSm" disabled={page >= pageCount} onClick={() => fetchNotifications(page + 1, readStatus)} aria-label="Next">
                <ChevronRight />
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
