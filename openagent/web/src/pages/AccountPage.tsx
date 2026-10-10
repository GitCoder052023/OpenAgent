// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
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
import * as AccountBackend from "@/backend/AccountBackend";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Loading} from "@/components/common/Loading";
import {PasswordInput} from "@/components/common/PasswordInput";
import {FormGrid, FormRow} from "@/components/crud/FormRow";
import {PageHeader} from "@/components/crud/PageHeader";
import {useAccount} from "@/hooks/use-account";
import * as Setting from "@/lib/setting";

function isImageUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:image/");
}

function PasswordDialog({open, onOpenChange, profile}: {open: boolean; onOpenChange: (open: boolean) => void; profile: Record<string, string>}) {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
    }
  }, [open]);

  const submit = async() => {
    setSaving(true);
    try {
      // the endpoint takes the profile with the passwords, so the profile goes along unchanged
      const res: any = await AccountBackend.updateAccount({...profile, currentPassword, newPassword});
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Successfully saved"));
        onOpenChange(false);
      } else {
        Setting.showMessage("error", res.msg);
      }
    } catch (error: any) {
      Setting.showMessage("error", error?.message ?? String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{i18next.t("account:Modify password")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <FormRow label={i18next.t("account:Old Password")}>
            <PasswordInput autoComplete="current-password" placeholder={i18next.t("account:Enter current password")} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </FormRow>
          <FormRow label={i18next.t("account:New password")}>
            <PasswordInput autoComplete="new-password" placeholder={i18next.t("account:Enter new password")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </FormRow>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>{i18next.t("general:Cancel")}</Button>
          <Button loading={saving} disabled={!newPassword} onClick={submit}>{i18next.t("account:Set Password")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The signed-in user's own profile, for sites that sign in without Casdoor. */
export default function AccountPage() {
  const {account, reload} = useAccount();
  const [displayName, setDisplayName] = React.useState(account?.displayName ?? "");
  const [avatar, setAvatar] = React.useState(account?.avatar ?? "");
  const [saving, setSaving] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);

  if (!account) {
    return <Loading />;
  }

  const profile = {username: account.name, displayName, avatar};

  const save = async() => {
    setSaving(true);
    try {
      const res: any = await AccountBackend.updateAccount(profile);
      if (res.status === "ok") {
        Setting.showMessage("success", i18next.t("general:Successfully saved"));
        // the header shows the name and avatar, so it has to see the change
        await reload();
      } else {
        Setting.showMessage("error", res.msg);
      }
    } catch (error: any) {
      Setting.showMessage("error", error?.message ?? String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={i18next.t("account:My Account")} actions={<Button loading={saving} onClick={save}>{i18next.t("general:Save")}</Button>} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{i18next.t("account:Profile")}</CardTitle>
          <CardDescription>{i18next.t("account:Profile desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FormGrid>
            <FormRow labelKey="general:Name">
              <Input value={account.name} disabled placeholder={i18next.t("account:Account ID")} />
            </FormRow>
            <FormRow labelKey="general:Display name">
              <Input value={displayName} placeholder={i18next.t("account:Name shown in OpenAgent")} onChange={(e) => setDisplayName(e.target.value)} />
            </FormRow>
            <FormRow labelKey="general:Avatar" block>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {isImageUrl(avatar) ? <AvatarImage src={avatar} alt="" /> : null}
                  <AvatarFallback className="text-lg text-white" style={{backgroundColor: Setting.getAvatarColor(account.name)}}>
                    {Setting.getShortName(account.name).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Input className="flex-1" value={avatar} placeholder={i18next.t("account:Avatar image URL, optional")} onChange={(e) => setAvatar(e.target.value)} />
              </div>
            </FormRow>
          </FormGrid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{i18next.t("general:Password")}</CardTitle>
          <CardDescription>{i18next.t("account:Password desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setPasswordOpen(true)}>{i18next.t("account:Modify password...")}</Button>
        </CardContent>
      </Card>

      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} profile={profile} />
    </div>
  );
}
