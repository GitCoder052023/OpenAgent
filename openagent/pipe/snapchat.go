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

package pipe

import (
	"crypto/hmac"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const snapchatApiBaseUrl = "https://kit.snapchat.com/v1"

// SnapchatPipe integrates with the Snapchat Kit Bot API.
// Token = OAuth access token, SecretKey = App Secret for webhook verification.
type SnapchatPipe struct {
	accessToken string
	appSecret   string
	httpClient  *http.Client
}

type snapchatWebhookPayload struct {
	Events []snapchatEvent `json:"events"`
}

type snapchatEvent struct {
	Type    string           `json:"type"`
	Sender  *snapchatSender  `json:"sender,omitempty"`
	Message *snapchatMessage `json:"message,omitempty"`
}

type snapchatSender struct {
	ExternalId  string `json:"external_id"`
	DisplayName string `json:"display_name"`
}

type snapchatMessage struct {
	Id             string `json:"id"`
	ConversationId string `json:"conversation_id"`
	Text           string `json:"text"`
}

func NewSnapchatPipe(accessToken string, appSecret string, httpClient *http.Client) (*SnapchatPipe, error) {
	return &SnapchatPipe{
		accessToken: strings.TrimSpace(accessToken),
		appSecret:   strings.TrimSpace(appSecret),
		httpClient:  httpClient,
	}, nil
}

func (p *SnapchatPipe) SendMessage(chatId string, text string) error {
	payload := map[string]interface{}{
		"external_id": chatId,
		"message": map[string]string{
			"text": text,
		},
	}
	headers := map[string]string{
		"Authorization": "Bearer " + p.accessToken,
	}
	_, err := doJSONRequest(
		p.httpClient,
		"Snapchat",
		http.MethodPost,
		snapchatApiBaseUrl+"/messages",
		headers,
		payload,
		http.StatusOK,
	)
	return err
}

func (p *SnapchatPipe) ParseWebhookRequest(body []byte) (*IncomingMessage, error) {
	var payload snapchatWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	for _, event := range payload.Events {
		if event.Type != "MESSAGE" || event.Message == nil || event.Message.Text == "" {
			continue
		}
		if event.Sender == nil {
			continue
		}

		senderId := event.Sender.ExternalId
		displayName := event.Sender.DisplayName
		if displayName == "" {
			displayName = senderId
		}

		return &IncomingMessage{
			ChatId:   senderId,
			UserId:   senderId,
			Text:     strings.TrimSpace(event.Message.Text),
			Username: displayName,
		}, nil
	}

	return nil, nil
}

// SetWebhook returns nil because the Snapchat webhook URL must be configured
// manually in the Snap Developer Portal under the bot's Webhook settings.
func (p *SnapchatPipe) SetWebhook(webhookUrl string) error {
	return nil
}

// GetWebhookResponse validates the HMAC-SHA256 signature on every incoming event.
func (p *SnapchatPipe) GetWebhookResponse(body []byte, header http.Header) (*WebhookResponse, error) {
	if err := p.verifySignature(body, header); err != nil {
		return &WebhookResponse{
			StatusCode:  http.StatusUnauthorized,
			ContentType: "text/plain",
			Body:        []byte(err.Error()),
		}, nil
	}
	return nil, nil
}

func (p *SnapchatPipe) verifySignature(body []byte, header http.Header) error {
	if p.appSecret == "" {
		return nil
	}

	signature := header.Get("X-Snapchat-Signature")
	if signature == "" {
		return fmt.Errorf("missing X-Snapchat-Signature header")
	}

	expected := "sha256=" + computeHmacSha256(body, p.appSecret)
	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return fmt.Errorf("invalid Snapchat signature")
	}

	return nil
}
