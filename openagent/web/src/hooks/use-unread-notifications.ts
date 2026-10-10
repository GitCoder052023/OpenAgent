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
import {useLocation} from "react-router-dom";
import * as NotificationBackend from "@/backend/NotificationBackend";
import * as Setting from "@/lib/setting";

const UnreadCountEvent = "unreadNotificationCount";

/** The notifications page knows the count after every fetch; this tells the header bell. */
export function setUnreadNotificationCount(count: number) {
  window.dispatchEvent(new CustomEvent(UnreadCountEvent, {detail: count}));
}

/** The header bell's count: polled every 30 seconds and on every navigation. */
export function useUnreadNotificationCount(account: any) {
  const [count, setCount] = React.useState(0);
  const location = useLocation();
  const signedIn = !!account && !Setting.isAnonymousUser(account);

  const refresh = React.useCallback(() => {
    if (!signedIn) {
      setCount(0);
      return;
    }
    NotificationBackend.getUserNotifications(1, 1, "unread").then((res: any) => {
      if (res.status === "ok") {
        setCount(res.data2?.unreadCount || 0);
      }
    }).catch(() => {});
  }, [signedIn]);

  React.useEffect(() => {
    refresh();
    if (!signedIn) {
      return undefined;
    }
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh, signedIn, location.pathname]);

  React.useEffect(() => {
    const onChange = (e: Event) => setCount((e as CustomEvent<number>).detail);
    window.addEventListener(UnreadCountEvent, onChange);
    return () => window.removeEventListener(UnreadCountEvent, onChange);
  }, []);

  return count;
}
