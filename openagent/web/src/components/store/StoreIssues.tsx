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
import {ArrowLeft, CircleCheck, CircleDot, MessageSquare, Pencil, Plus, Trash2} from "lucide-react";
import * as IssueBackend from "@/backend/IssueBackend";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Textarea} from "@/components/ui/textarea";
import {Loading} from "@/components/common/Loading";
import {ConfirmButton} from "@/components/common/ConfirmButton";
import {UserLabel} from "@/components/common/UserLabel";
import {CommentArea} from "@/components/comment/CommentArea";
import * as Setting from "@/lib/setting";
import {cn} from "@/lib/utils";

const StatusOpen = "Open";
const StatusClosed = "Closed";

type Filter = "open" | "closed" | "all";

function StatusIcon({status, className}: {status: string; className?: string}) {
  return status === StatusClosed
    ? <CircleCheck className={cn("h-4 w-4 text-violet-600 dark:text-violet-400", className)} />
    : <CircleDot className={cn("h-4 w-4 text-success", className)} />;
}

function StatusBadge({status}: {status: string}) {
  return status === StatusClosed ? (
    <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"><CircleCheck className="h-3 w-3" />{i18next.t("store:Closed")}</Badge>
  ) : (
    <Badge variant="success"><CircleDot className="h-3 w-3" />{i18next.t("store:Open")}</Badge>
  );
}

interface StoreIssuesProps {
  account: any;
  store: any;
  activeIssueName: string | null;
  onIssueChange: (issueName: string | null) => void;
}

/** An agent's issues: a filtered list, a form to open or edit one, and one issue with its comments. */
export function StoreIssues({account, store, activeIssueName, onIssueChange}: StoreIssuesProps) {
  const [issues, setIssues] = React.useState<any[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState<Filter>("open");
  const [form, setForm] = React.useState<{mode: "new" | "edit"; title: string; content: string} | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const storeId = `${store.owner}/${store.name}`;

  const fetchIssues = React.useCallback(() => {
    setLoading(true);
    IssueBackend.getIssues(storeId).then((res: any) => {
      if (res.status === "ok") {
        setIssues(res.data ?? []);
      } else {
        Setting.showMessage("error", res.msg);
        setIssues((prev) => prev ?? []);
      }
    }).catch((error: any) => {
      Setting.showMessage("error", error.message || String(error));
      setIssues((prev) => prev ?? []);
    }).finally(() => setLoading(false));
  }, [storeId]);

  React.useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // moving to another issue (back and forward) drops an open edit form
  React.useEffect(() => {
    setForm((prev) => (prev?.mode === "edit" ? null : prev));
  }, [activeIssueName]);

  if (issues === null) {
    return <Loading />;
  }

  const current = activeIssueName ? issues.find((issue) => issue.name === activeIssueName) ?? null : null;
  const canCreate = account && !Setting.isAnonymousUser(account);
  const canManage = (issue: any) => account && (account.name === issue.owner || account.name === store.owner || Setting.isAdminUser(account));

  const openList = () => {
    setForm(null);
    onIssueChange(null);
  };

  const submit = async() => {
    if (!form) {
      return;
    }
    const title = form.title.trim();
    if (title === "") {
      Setting.showMessage("error", i18next.t("store:Issue title cannot be empty"));
      return;
    }
    setSubmitting(true);
    try {
      const editing = form.mode === "edit" && current;
      const res: any = editing
        ? await IssueBackend.updateIssue(current.owner, current.name, {...current, title, content: form.content})
        : await IssueBackend.addIssue({store: storeId, title, content: form.content});
      if (res.status === "ok") {
        if (!editing) {
          Setting.showMessage("success", i18next.t("general:Successfully added"));
        }
        setForm(null);
        fetchIssues();
      } else {
        Setting.showMessage("error", res.msg);
      }
    } catch (error: any) {
      Setting.showMessage("error", error.message || String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async(issue: any) => {
    const status = issue.status === StatusClosed ? StatusOpen : StatusClosed;
    const res: any = await IssueBackend.updateIssue(issue.owner, issue.name, {...issue, status});
    if (res.status === "ok") {
      fetchIssues();
    } else {
      Setting.showMessage("error", res.msg);
    }
  };

  const deleteIssue = async(issue: any) => {
    const res: any = await IssueBackend.deleteIssue(issue.owner, issue.name);
    if (res.status === "ok") {
      Setting.showMessage("success", i18next.t("general:Successfully deleted"));
      fetchIssues();
      openList();
    } else {
      Setting.showMessage("error", res.msg);
    }
  };

  if (form) {
    const editing = form.mode === "edit";
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{editing ? i18next.t("store:Edit issue") : i18next.t("store:New issue")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder={i18next.t("store:Issue title")} value={form.title} maxLength={200} onChange={(e) => setForm({...form, title: e.target.value})} />
          <Textarea
            placeholder={i18next.t("store:Leave a description")}
            value={form.content}
            rows={8}
            maxLength={2000}
            onChange={(e) => setForm({...form, content: e.target.value})}
          />
          <div className="flex gap-2">
            <Button loading={submitting} onClick={submit}>{editing ? i18next.t("general:Save") : i18next.t("store:Submit new issue")}</Button>
            <Button variant="outline" onClick={() => (editing ? setForm(null) : openList())}>{i18next.t("general:Cancel")}</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const backLink = (
    <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={openList}><ArrowLeft />{i18next.t("store:Back to issues")}</Button>
  );

  if (activeIssueName) {
    if (!current) {
      return (
        <div>
          {backLink}
          <p className="py-10 text-center text-sm text-muted-foreground">{i18next.t("store:No issues yet")}</p>
        </div>
      );
    }
    const isClosed = current.status === StatusClosed;
    return (
      <div className="space-y-4">
        <div>
          {backLink}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1 break-words text-xl font-semibold">{current.title}</h2>
            {canManage(current) ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleStatus(current)}>
                  {isClosed ? i18next.t("store:Reopen") : i18next.t("store:Close issue")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setForm({mode: "edit", title: current.title, content: current.content})}>
                  <Pencil />{i18next.t("general:Edit")}
                </Button>
                <ConfirmButton variant="destructiveGhost" size="sm" aria-label={i18next.t("general:Delete")} onConfirm={() => deleteIssue(current)}>
                  <Trash2 />
                </ConfirmButton>
              </div>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge status={current.status} />
            <UserLabel user={current.owner} />
            <span>· {Setting.getFormattedDate(current.createdTime)}</span>
          </div>
        </div>
        <Card>
          <CardContent className="p-4">
            {current.content ? (
              <p className="whitespace-pre-wrap break-words text-sm">{current.content}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{i18next.t("store:No description provided")}</p>
            )}
          </CardContent>
        </Card>
        <CommentArea account={account} targetType="issue" targetKey={`${current.owner}/${current.name}`} targetOwner={store.owner} />
      </div>
    );
  }

  const openCount = issues.filter((issue) => issue.status !== StatusClosed).length;
  const closedCount = issues.length - openCount;
  const shown = issues.filter((issue) => filter === "all" || (filter === "closed") === (issue.status === StatusClosed));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList>
            <TabsTrigger value="open">{i18next.t("store:Open")} ({openCount})</TabsTrigger>
            <TabsTrigger value="closed">{i18next.t("store:Closed")} ({closedCount})</TabsTrigger>
            <TabsTrigger value="all">{i18next.t("store:All")} ({issues.length})</TabsTrigger>
          </TabsList>
        </Tabs>
        {canCreate ? (
          <Button onClick={() => setForm({mode: "new", title: "", content: ""})}><Plus />{i18next.t("store:New issue")}</Button>
        ) : null}
      </div>
      <Card className={cn("overflow-hidden", loading && "opacity-60")}>
        {shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{i18next.t("store:No issues yet")}</p>
        ) : shown.map((issue) => (
          // a div, not a button: the user label inside is a button of its own
          <div
            key={issue.name}
            role="link"
            tabIndex={0}
            onClick={() => onIssueChange(issue.name)}
            onKeyDown={(e) => e.key === "Enter" && onIssueChange(issue.name)}
            className="flex w-full cursor-pointer items-start gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
          >
            <StatusIcon status={issue.status} className="mt-1 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium" title={issue.title}>{issue.title}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>{i18next.t("store:opened by")}</span>
                <span onClick={(e) => e.stopPropagation()}><UserLabel user={issue.owner} /></span>
                <span>· {Setting.getFormattedDate(issue.createdTime)}</span>
              </div>
            </div>
            {issue.commentCount > 0 ? (
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" />{issue.commentCount}</span>
            ) : null}
          </div>
        ))}
      </Card>
    </div>
  );
}

export default StoreIssues;
