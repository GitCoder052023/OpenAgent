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
import {ExternalLink} from "lucide-react";
import * as UserBackend from "@/backend/UserBackend";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Button} from "@/components/ui/button";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {useAccount} from "@/hooks/use-account";
import * as Setting from "@/lib/setting";
import {cn} from "@/lib/utils";

/**
 * Anonymous "u-" runtime ids and the "AI" author are not Casdoor users: they
 * render as plain text and are never looked up.
 */
export function isRealUser(user: string | undefined | null) {
  return !!user && !user.startsWith("u-") && user !== "AI";
}

function UserAvatar({user, name, avatar, className}: {user: string; name: string; avatar: string; className?: string}) {
  return (
    <Avatar className={cn("h-[22px] w-[22px]", className)}>
      {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
      <AvatarFallback className="text-[10px] text-white" style={{backgroundColor: Setting.getAvatarColor(user || name)}}>
        {(name || user || "?").charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * A username shown with its Casdoor display name and avatar, and a profile card
 * on hover. Only the username is needed; the rest is looked up once per page.
 */
export function UserLabel({user, className}: {user: string; className?: string}) {
  const {account} = useAccount();
  const [info, setInfo] = React.useState<{displayName: string; avatar: string}>({displayName: "", avatar: ""});
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const real = isRealUser(user);

  React.useEffect(() => {
    if (!real) {
      return;
    }
    let cancelled = false;
    UserBackend.getUserInfo(user).then((res: any) => {
      if (!cancelled && res) {
        setInfo({displayName: res.displayName || "", avatar: res.avatar || ""});
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user, real]);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  if (!user) {
    return null;
  }
  if (!real) {
    return <span className={className}>{user}</span>;
  }

  const name = info.displayName || Setting.getShortName(user);
  const profileUrl = account && !Setting.isBasicLoginMode(account) ? Setting.getUserProfileUrl(user, account) : null;
  const openProfile = () => {
    if (profileUrl && profileUrl !== "#") {
      Setting.openLink(profileUrl);
    }
  };

  const hover = (next: boolean, delay: number) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") {
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), delay);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onPointerEnter={hover(true, 300)} onPointerLeave={hover(false, 150)}>
        <button
          type="button"
          onClick={openProfile}
          className={cn("inline-flex min-w-0 max-w-full items-center gap-2 align-middle", profileUrl ? "cursor-pointer" : "cursor-default", className)}
        >
          <UserAvatar user={user} name={name} avatar={info.avatar} />
          <span className="truncate">{name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60" onPointerEnter={hover(true, 0)} onPointerLeave={hover(false, 150)}>
        <div className="flex items-center gap-3">
          <UserAvatar user={user} name={name} avatar={info.avatar} className="h-12 w-12 text-base" />
          <div className="min-w-0 flex-1">
            <div className="break-words text-[15px] font-semibold leading-tight">{name}</div>
            <div className="truncate text-sm text-muted-foreground" title={user}>@{user}</div>
          </div>
        </div>
        {profileUrl && profileUrl !== "#" ? (
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={openProfile}>
            <ExternalLink />
            {i18next.t("general:View profile")}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export default UserLabel;
