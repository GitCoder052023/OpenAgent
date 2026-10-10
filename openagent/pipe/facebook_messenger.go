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
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const facebookMessengerApiBaseUrl = "https://graph.facebook.com/v19.0"

type FacebookMessengerPipe struct {
	pageAccessToken string
	appSecret       string
	verifyToken     string
	httpClient      *http.Client
}

type facebookMessengerWebhookPayload struct {
	Object string                   `json:"object"`
	Entry  []facebookMessengerEntry `json:"entry"`
}

type facebookMessengerEntry struct {
	Id        string                            `json:"id"`
	Time      int64                             `json:"time"`
	Messaging []facebookMessengerMessagingEvent `json:"messaging"`
}

type facebookMessengerMessagingEvent struct {
	Sender    facebookMessengerParticipant `json:"sender"`
	Recipient facebookMessengerParticipant `json:"recipient"`
	Timestamp int64                        `json:"timestamp"`
	Message   *facebookMessengerMessage    `json:"message,omitempty"`
}

type facebookMessengerParticipant struct {
	Id string `json:"id"`
}

type facebookMessengerMessage struct {
	Mid    string `json:"mid"`
	Text   string `json:"text"`
	IsEcho bool   `json:"is_echo,omitempty"`
}

type facebookMessengerSendPayload struct {
	Recipient facebookMessengerRecipient   `json:"recipient"`
	Message   facebookMessengerTextMessage `json:"message"`
}

type facebookMessengerRecipient struct {
	Id string `json:"id"`
}

type facebookMessengerTextMessage struct {
	Text string `json:"text"`
}

func NewFacebookMessengerPipe(pageAccessToken string, appSecret string, verifyToken string, httpClient *http.Client) (*FacebookMessengerPipe, error) {
	return &FacebookMessengerPipe{
		pageAccessToken: strings.TrimSpace(pageAccessToken),
		appSecret:       strings.TrimSpace(appSecret),
		verifyToken:     verifyToken,
		httpClient:      httpClient,
	}, nil
}

func (p *FacebookMessengerPipe) SendMessage(chatId string, text string) error {
	payload := facebookMessengerSendPayload{
		Recipient: facebookMessengerRecipient{Id: chatId},
		Message:   facebookMessengerTextMessage{Text: text},
	}
	url := fmt.Sprintf("%s/me/messages?access_token=%s", facebookMessengerApiBaseUrl, p.pageAccessToken)
	_, err := doJSONRequest(
		p.httpClient,
		"Facebook Messenger",
		http.MethodPost,
		url,
		nil,
		payload,
		http.StatusOK,
	)
	return err
}

func (p *FacebookMessengerPipe) ParseWebhookRequest(body []byte) (*IncomingMessage, error) {
	var payload facebookMessengerWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	if payload.Object != "page" {
		return nil, nil
	}

	for _, entry := range payload.Entry {
		for _, event := range entry.Messaging {
			if event.Message == nil || event.Message.Text == "" {
				continue
			}
			// Skip echo messages sent by the page itself
			if event.Message.IsEcho {
				continue
			}

			senderId := event.Sender.Id
			return &IncomingMessage{
				ChatId:   senderId,
				UserId:   senderId,
				Text:     event.Message.Text,
				Username: senderId,
			}, nil
		}
	}

	return nil, nil
}

// VerifyWebhook handles the Meta webhook verification challenge (GET request).
// The verify token is the pipe name, which must match what is configured in
// the Meta Developer Console as the webhook verify token.
func (p *FacebookMessengerPipe) VerifyWebhook(params map[string]string) (*WebhookResponse, error) {
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

// SetWebhook returns nil because Facebook Messenger webhooks are configured
// manually in the Meta Developer Console. The caller displays the webhook URL.
func (p *FacebookMessengerPipe) SetWebhook(webhookUrl string) error {
	return nil
}

// verifySignature validates the X-Hub-Signature-256 header using the app secret.
func (p *FacebookMessengerPipe) verifySignature(body []byte, header http.Header) error {
	if p.appSecret == "" {
		return nil
	}

	signature := header.Get("X-Hub-Signature-256")
	if signature == "" {
		return fmt.Errorf("missing X-Hub-Signature-256 header")
	}

	expected := "sha256=" + computeHmacSha256(body, p.appSecret)
	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return fmt.Errorf("invalid Facebook Messenger signature")
	}

	return nil
}

// GetWebhookResponse validates the HMAC-SHA256 signature on every incoming event.
func (p *FacebookMessengerPipe) GetWebhookResponse(body []byte, header http.Header) (*WebhookResponse, error) {
	if err := p.verifySignature(body, header); err != nil {
		return &WebhookResponse{
			StatusCode:  http.StatusUnauthorized,
			ContentType: "text/plain",
			Body:        []byte(err.Error()),
		}, nil
	}
	return nil, nil
}

func computeHmacSha256(data []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(data)
	return hex.EncodeToString(mac.Sum(nil))
}
