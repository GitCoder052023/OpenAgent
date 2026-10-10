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
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const whatsAppApiBaseUrl = "https://graph.facebook.com/v19.0"

type WhatsAppPipe struct {
	accessToken   string
	phoneNumberId string
	verifyToken   string
	httpClient    *http.Client
}

type whatsAppWebhookPayload struct {
	Object string          `json:"object"`
	Entry  []whatsAppEntry `json:"entry"`
}

type whatsAppEntry struct {
	Id      string           `json:"id"`
	Changes []whatsAppChange `json:"changes"`
}

type whatsAppChange struct {
	Value whatsAppValue `json:"value"`
	Field string        `json:"field"`
}

type whatsAppValue struct {
	MessagingProduct string            `json:"messaging_product"`
	Metadata         whatsAppMetadata  `json:"metadata"`
	Contacts         []whatsAppContact `json:"contacts"`
	Messages         []whatsAppMessage `json:"messages"`
}

type whatsAppMetadata struct {
	DisplayPhoneNumber string `json:"display_phone_number"`
	PhoneNumberId      string `json:"phone_number_id"`
}

type whatsAppContact struct {
	Profile whatsAppProfile `json:"profile"`
	WaId    string          `json:"wa_id"`
}

type whatsAppProfile struct {
	Name string `json:"name"`
}

type whatsAppMessage struct {
	From      string        `json:"from"`
	Id        string        `json:"id"`
	Timestamp string        `json:"timestamp"`
	Type      string        `json:"type"`
	Text      *whatsAppText `json:"text,omitempty"`
}

type whatsAppText struct {
	Body string `json:"body"`
}

type whatsAppSendPayload struct {
	MessagingProduct string              `json:"messaging_product"`
	To               string              `json:"to"`
	Type             string              `json:"type"`
	Text             whatsAppTextPayload `json:"text"`
}

type whatsAppTextPayload struct {
	Body string `json:"body"`
}

func NewWhatsAppPipe(accessToken string, phoneNumberId string, verifyToken string, httpClient *http.Client) (*WhatsAppPipe, error) {
	return &WhatsAppPipe{
		accessToken:   accessToken,
		phoneNumberId: strings.TrimSpace(phoneNumberId),
		verifyToken:   verifyToken,
		httpClient:    httpClient,
	}, nil
}

func (p *WhatsAppPipe) authorizationHeaders() map[string]string {
	return map[string]string{
		"Authorization": fmt.Sprintf("Bearer %s", p.accessToken),
	}
}

func (p *WhatsAppPipe) SendMessage(chatId string, text string) error {
	payload := whatsAppSendPayload{
		MessagingProduct: "whatsapp",
		To:               chatId,
		Type:             "text",
		Text:             whatsAppTextPayload{Body: text},
	}
	_, err := doJSONRequest(
		p.httpClient,
		"WhatsApp",
		http.MethodPost,
		fmt.Sprintf("%s/%s/messages", whatsAppApiBaseUrl, p.phoneNumberId),
		p.authorizationHeaders(),
		payload,
		http.StatusOK,
		http.StatusCreated,
	)
	return err
}

func (p *WhatsAppPipe) ParseWebhookRequest(body []byte) (*IncomingMessage, error) {
	var payload whatsAppWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	for _, entry := range payload.Entry {
		for _, change := range entry.Changes {
			if change.Field != "messages" {
				continue
			}
			contacts := change.Value.Contacts
			for i, message := range change.Value.Messages {
				if message.Type != "text" || message.Text == nil || message.Text.Body == "" {
					continue
				}

				userId := message.From
				username := message.From
				if i < len(contacts) {
					username = contacts[i].Profile.Name
				}

				return &IncomingMessage{
					ChatId:   message.From,
					UserId:   userId,
					Text:     message.Text.Body,
					Username: username,
				}, nil
			}
		}
	}

	return nil, nil
}

// VerifyWebhook handles the Meta webhook verification challenge (GET request).
// The verify token is the pipe name, which must match what is configured in
// the Meta Developer Console as the webhook verify token.
func (p *WhatsAppPipe) VerifyWebhook(params map[string]string) (*WebhookResponse, error) {
	mode := params["hub.mode"]
	verifyToken := params["hub.verify_token"]
	challenge := params["hub.challenge"]

	if mode != "subscribe" || verifyToken != p.verifyToken {
		return &WebhookResponse{StatusCode: http.StatusForbidden}, nil
	}

	return &WebhookResponse{
		StatusCode:  http.StatusOK,
		ContentType: "text/plain",
		Body:        []byte(challenge),
	}, nil
}

// SetWebhook returns nil because WhatsApp webhooks are configured manually in
// the Meta Developer Console. The caller displays the webhook URL to the user.
func (p *WhatsAppPipe) SetWebhook(webhookUrl string) error {
	return nil
}
