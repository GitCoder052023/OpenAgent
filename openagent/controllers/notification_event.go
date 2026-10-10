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

package controllers

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/beego/beego/logs"
	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
	"golang.org/x/net/html"
)

func joinNotificationURL(parts ...string) string {
	res, err := url.JoinPath("/", parts...)
	if err != nil {
		return ""
	}
	return res
}

func getCommentAnchor(comment *object.Comment) string {
	if comment == nil || comment.Owner == "" || comment.Name == "" {
		return ""
	}
	return fmt.Sprintf("#comment-%s-%s", url.PathEscape(comment.Owner), url.PathEscape(comment.Name))
}

func plainNotificationText(content string) string {
	content = strings.TrimSpace(content)
	if content == "" {
		return ""
	}
	nodes, err := html.ParseFragment(strings.NewReader(content), nil)
	if err != nil {
		return content
	}

	var builder strings.Builder
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.TextNode {
			text := strings.TrimSpace(node.Data)
			if text != "" {
				if builder.Len() != 0 {
					builder.WriteByte(' ')
				}
				builder.WriteString(text)
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	for _, node := range nodes {
		walk(node)
	}
	res := strings.TrimSpace(builder.String())
	if res == "" {
		return content
	}
	return res
}

func trimNotificationText(content string, limit int) string {
	content = strings.TrimSpace(content)
	if len([]rune(content)) <= limit {
		return content
	}
	runes := []rune(content)
	return string(runes[:limit]) + "..."
}

func notifyStoreWatchers(storeOwner, storeName, event, actor, title, content, url string) {
	err := object.AddStoreNotifications(storeOwner, storeName, event, actor, title, content, url)
	if err != nil {
		logs.Warning("Failed to enqueue store notifications for %s/%s: %v", storeOwner, storeName, err)
	}
}

func notifyIssueWatchers(issue *object.Issue, event, actor, action, url string) {
	if issue == nil {
		return
	}
	storeOwner, storeName, err := util.GetOwnerAndNameFromIdWithError(issue.Store)
	if err != nil {
		logs.Warning("Failed to parse issue store %s: %v", issue.Store, err)
		return
	}
	title := fmt.Sprintf("%s %s issue \"%s\"", actor, action, issue.Title)
	content := trimNotificationText(issue.Content, 500)
	notifyStoreWatchers(storeOwner, storeName, event, actor, title, content, url)
}

func notifyCommentWatchers(comment *object.Comment, actor string) {
	if comment == nil {
		return
	}
	content := trimNotificationText(plainNotificationText(comment.Content), 500)
	switch comment.TargetType {
	case object.CommentTargetTypeAgentHub:
		storeOwner, storeName, err := util.GetOwnerAndNameFromIdWithError(comment.TargetKey)
		if err != nil {
			logs.Warning("Failed to parse comment store target %s: %v", comment.TargetKey, err)
			return
		}
		title := fmt.Sprintf("%s commented on agent %s/%s", actor, storeOwner, storeName)
		url := joinNotificationURL("agents", storeOwner, storeName) + getCommentAnchor(comment)
		notifyStoreWatchers(storeOwner, storeName, object.NotificationEventCommentAdded, actor, title, content, url)
	case object.CommentTargetTypeIssue:
		issueOwner, issueName, err := util.GetOwnerAndNameFromIdWithError(comment.TargetKey)
		if err != nil {
			logs.Warning("Failed to parse comment issue target %s: %v", comment.TargetKey, err)
			return
		}
		issue, err := object.GetIssue(issueOwner, issueName)
		if err != nil {
			logs.Warning("Failed to load issue %s: %v", comment.TargetKey, err)
			return
		}
		if issue == nil {
			return
		}
		storeOwner, storeName, err := util.GetOwnerAndNameFromIdWithError(issue.Store)
		if err != nil {
			logs.Warning("Failed to parse issue store %s: %v", issue.Store, err)
			return
		}
		title := fmt.Sprintf("%s commented on issue \"%s\"", actor, issue.Title)
		url := joinNotificationURL("agents", storeOwner, storeName, "issues", issue.Owner, issue.Name) + getCommentAnchor(comment)
		notifyStoreWatchers(storeOwner, storeName, object.NotificationEventCommentAdded, actor, title, content, url)
	}
}
