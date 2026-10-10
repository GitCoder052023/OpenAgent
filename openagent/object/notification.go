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

package object

import (
	"fmt"
	"strings"
	"time"

	"github.com/beego/beego/logs"
	"github.com/the-open-agent/openagent/auth"
	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/util"
	"xorm.io/core"
	"xorm.io/xorm"
)

const (
	NotificationEventStoreUpdated   = "store-updated"
	NotificationEventIssueCreated   = "issue-created"
	NotificationEventIssueUpdated   = "issue-updated"
	NotificationEventCommentAdded   = "comment-added"
	NotificationStatusPending       = "Pending"
	NotificationStatusSending       = "Sending"
	NotificationStatusSent          = "Sent"
	NotificationStatusFailed        = "Failed"
	notificationRetryLimit          = 5
	notificationScanBatchSize       = 50
	notificationScanIntervalSecond  = 30
	notificationSendingStaleMinute  = 10
	notificationRetentionDay        = 90
	notificationCleanupIntervalHour = 24
)

type Notification struct {
	Owner       string `xorm:"varchar(100) notnull pk" json:"owner"`
	Name        string `xorm:"varchar(100) notnull pk" json:"name"`
	CreatedTime string `xorm:"varchar(100) index" json:"createdTime"`
	UpdatedTime string `xorm:"varchar(100)" json:"updatedTime"`

	Recipient string `xorm:"varchar(100) index" json:"recipient"`
	Actor     string `xorm:"varchar(100) index" json:"actor"`

	StoreOwner string `xorm:"varchar(100) index(idx_notification_store)" json:"storeOwner"`
	StoreName  string `xorm:"varchar(100) index(idx_notification_store)" json:"storeName"`

	Event   string `xorm:"varchar(50) index" json:"event"`
	Title   string `xorm:"varchar(255)" json:"title"`
	Content string `xorm:"mediumtext" json:"content"`
	Url     string `xorm:"varchar(500)" json:"url"`

	Status     string `xorm:"varchar(20) index" json:"status"`
	RetryCount int    `json:"retryCount"`
	ErrorText  string `xorm:"mediumtext" json:"errorText"`
	SentTime   string `xorm:"varchar(100)" json:"sentTime"`
	IsRead     bool   `xorm:"index" json:"isRead"`
}

func buildNotificationContent(recipient, title, content, url string) string {
	parts := []string{fmt.Sprintf("[OpenAgent] %s", title)}
	if recipient != "" {
		parts = append(parts, fmt.Sprintf("Recipient: %s", recipient))
	}
	if strings.TrimSpace(content) != "" {
		parts = append(parts, strings.TrimSpace(content))
	}
	if url != "" {
		parts = append(parts, url)
	}
	return strings.Join(parts, "\n")
}

func AddStoreNotifications(storeOwner, storeName, event, actor, title, content, url string) error {
	store, err := getStore(storeOwner, storeName)
	if err != nil {
		return err
	}
	if store == nil || store.PublishState != "Published" {
		return nil
	}

	watchers, err := GetStoreWatchers(storeOwner, storeName)
	if err != nil {
		return err
	}
	if len(watchers) == 0 {
		return nil
	}

	now := util.GetCurrentTimeWithMilli()
	notifications := make([]*Notification, 0, len(watchers))
	for _, watcher := range watchers {
		if watcher.Owner == "" || watcher.Owner == actor {
			continue
		}
		notification := &Notification{
			Owner:       storeOwner,
			Name:        util.GetRandomString(24),
			CreatedTime: now,
			UpdatedTime: now,
			Recipient:   watcher.Owner,
			Actor:       actor,
			StoreOwner:  storeOwner,
			StoreName:   storeName,
			Event:       event,
			Title:       title,
			Content:     strings.TrimSpace(content),
			Url:         url,
			Status:      NotificationStatusPending,
		}
		notifications = append(notifications, notification)
	}
	if len(notifications) == 0 {
		return nil
	}

	_, err = adapter.engine.Insert(notifications)
	return err
}

func GetNotificationCount(owner, field, value string) (int64, error) {
	session := GetDbSession(owner, -1, -1, field, value, "", "")
	defer session.Close()
	return session.Count(&Notification{})
}

func GetPaginationNotifications(owner string, offset, limit int, field, value, sortField, sortOrder string) ([]*Notification, error) {
	notifications := []*Notification{}
	session := GetDbSession(owner, offset, limit, field, value, sortField, sortOrder)
	defer session.Close()
	err := session.Find(&notifications)
	return notifications, err
}

func applyUserNotificationFilter(session *xorm.Session, recipient string, readStatus string) *xorm.Session {
	session = session.Where("recipient = ?", recipient)
	if readStatus == "read" {
		session = session.And("is_read = ?", true)
	} else if readStatus == "unread" {
		session = session.And("is_read = ?", false)
	}
	return session
}

func GetUserNotificationCount(recipient string, readStatus string) (int64, error) {
	session := adapter.engine.NewSession()
	defer session.Close()
	session = applyUserNotificationFilter(session, recipient, readStatus)
	return session.Count(&Notification{})
}

func GetUserUnreadNotificationCount(recipient string) (int64, error) {
	return GetUserNotificationCount(recipient, "unread")
}

func GetPaginationUserNotifications(recipient string, offset, limit int, readStatus string) ([]*Notification, error) {
	notifications := []*Notification{}
	session := adapter.engine.NewSession()
	defer session.Close()
	session = applyUserNotificationFilter(session, recipient, readStatus)
	err := session.Desc("created_time").Limit(limit, offset).Find(&notifications)
	return notifications, err
}

func MarkNotificationRead(owner, name, recipient string) (bool, error) {
	notification := &Notification{
		IsRead:      true,
		UpdatedTime: util.GetCurrentTimeWithMilli(),
	}
	affected, err := adapter.engine.
		Where("owner = ? AND name = ? AND recipient = ?", owner, name, recipient).
		Cols("is_read", "updated_time").
		Update(notification)
	return affected != 0, err
}

func MarkAllNotificationsRead(recipient string) (int64, error) {
	notification := &Notification{
		IsRead:      true,
		UpdatedTime: util.GetCurrentTimeWithMilli(),
	}
	return adapter.engine.
		Where("recipient = ? AND is_read = ?", recipient, false).
		Cols("is_read", "updated_time").
		Update(notification)
}

func claimNotification(notification *Notification) (bool, error) {
	notification.Status = NotificationStatusSending
	notification.UpdatedTime = util.GetCurrentTimeWithMilli()
	staleTime := util.FormatTimeForCompare(time.Now().Add(-time.Duration(notificationSendingStaleMinute) * time.Minute))

	affected, err := adapter.engine.
		Where("owner = ? AND name = ? AND (status = ? OR (status = ? AND retry_count < ?) OR (status = ? AND updated_time < ?))",
			notification.Owner, notification.Name, NotificationStatusPending, NotificationStatusFailed, notificationRetryLimit, NotificationStatusSending, staleTime).
		Cols("status", "updated_time").
		Update(notification)
	if err != nil {
		return false, err
	}
	return affected != 0, nil
}

func updateNotificationStatus(notification *Notification, status string, err error) error {
	notification.Status = status
	notification.UpdatedTime = util.GetCurrentTimeWithMilli()
	if status == NotificationStatusSent {
		notification.SentTime = notification.UpdatedTime
		notification.ErrorText = ""
	} else if err != nil {
		notification.RetryCount++
		notification.ErrorText = err.Error()
	}

	_, updateErr := adapter.engine.ID(core.PK{notification.Owner, notification.Name}).
		Where("status = ?", NotificationStatusSending).
		Cols("status", "updated_time", "retry_count", "error_text", "sent_time").
		Update(notification)
	return updateErr
}

func ScanPendingNotifications() {
	if !conf.IsCasdoorAvailable() {
		return
	}

	notifications := []*Notification{}
	staleTime := util.FormatTimeForCompare(time.Now().Add(-time.Duration(notificationSendingStaleMinute) * time.Minute))
	err := adapter.engine.Where("status = ? OR (status = ? AND retry_count < ?) OR (status = ? AND updated_time < ?)",
		NotificationStatusPending, NotificationStatusFailed, notificationRetryLimit, NotificationStatusSending, staleTime).
		Asc("created_time").
		Limit(notificationScanBatchSize).
		Find(&notifications)
	if err != nil {
		logs.Warning("Failed to scan notifications: %v", err)
		return
	}

	for _, notification := range notifications {
		claimed, claimErr := claimNotification(notification)
		if claimErr != nil {
			logs.Warning("Failed to claim notification %s/%s: %v", notification.Owner, notification.Name, claimErr)
			continue
		}
		if !claimed {
			continue
		}

		err = auth.SendNotification(buildNotificationContent(notification.Recipient, notification.Title, notification.Content, notification.Url), notification.Recipient)
		if err != nil {
			logs.Warning("Failed to send notification %s/%s: %v", notification.Owner, notification.Name, err)
			if updateErr := updateNotificationStatus(notification, NotificationStatusFailed, err); updateErr != nil {
				logs.Warning("Failed to update notification %s/%s status: %v", notification.Owner, notification.Name, updateErr)
			}
			continue
		}
		if updateErr := updateNotificationStatus(notification, NotificationStatusSent, nil); updateErr != nil {
			logs.Warning("Failed to update notification %s/%s status: %v", notification.Owner, notification.Name, updateErr)
		}
	}
}

func CleanupOldNotifications() {
	cutoff := util.FormatTimeForCompare(time.Now().AddDate(0, 0, -notificationRetentionDay))
	affected, err := adapter.engine.
		Where("created_time < ?", cutoff).
		Delete(&Notification{})
	if err != nil {
		logs.Warning("Failed to cleanup old notifications before %s: %v", cutoff, err)
		return
	}
	if affected > 0 {
		logs.Info("Cleaned up %d notifications before %s", affected, cutoff)
	}
}

func InitNotificationSender() {
	ScanPendingNotifications()
	CleanupOldNotifications()
	scanTicker := time.NewTicker(time.Duration(notificationScanIntervalSecond) * time.Second)
	defer scanTicker.Stop()
	cleanupTicker := time.NewTicker(time.Duration(notificationCleanupIntervalHour) * time.Hour)
	defer cleanupTicker.Stop()

	for {
		select {
		case <-scanTicker.C:
			ScanPendingNotifications()
		case <-cleanupTicker.C:
			CleanupOldNotifications()
		}
	}
}
