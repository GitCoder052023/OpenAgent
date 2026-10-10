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
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const xApiBaseUrl = "https://api.twitter.com/2"

// XDMPipe integrates with the X (Twitter) Direct Messages API v2.
// Token = OAuth 2.0 User Access Token (with dm.read, dm.write, tweet.read scopes).
// SecretKey = Consumer Secret (API Secret Key) for CRC webhook validation.
type XDMPipe struct {
	accessToken    string
	consumerSecret string
	httpClient     *http.Client
}

type xDMWebhookPayload struct {
	ForUserId           string             `json:"for_user_id"`
	DirectMessageEvents []xDMEvent         `json:"direct_message_events"`
	Users               map[string]xDMUser `json:"users"`
}

type xDMEvent struct {
	Type          string           `json:"type"`
	Id            string           `json:"id"`
	MessageCreate xDMMessageCreate `json:"message_create"`
}

type xDMMessageCreate struct {
	Target      xDMTarget      `json:"target"`
	SenderId    string         `json:"sender_id"`
	MessageData xDMMessageData `json:"message_data"`
}

type xDMTarget struct {
	RecipientId string `json:"recipient_id"`
}

type xDMMessageData struct {
	Text string `json:"text"`
}

type xDMUser struct {
	Id         string `json:"id"`
	Name       string `json:"name"`
	ScreenName string `json:"screen_name"`
}

func NewXDMPipe(accessToken string, consumerSecret string, httpClient *http.Client) (*XDMPipe, error) {
	return &XDMPipe{
		accessToken:    strings.TrimSpace(accessToken),
		consumerSecret: strings.TrimSpace(consumerSecret),
		httpClient:     httpClient,
	}, nil
}

func (p *XDMPipe) SendMessage(chatId string, text string) error {
	url := fmt.Sprintf("%s/dm_conversations/with/%s/messages", xApiBaseUrl, chatId)
	payload := map[string]interface{}{
		"text": text,
	}
	headers := map[string]string{
		"Authorization": "Bearer " + p.accessToken,
	}
	_, err := doJSONRequest(
		p.httpClient,
		"X Direct Messages",
		http.MethodPost,
		url,
		headers,
		payload,
		http.StatusCreated,
	)
	return err
}

func (p *XDMPipe) ParseWebhookRequest(body []byte) (*IncomingMessage, error) {
	var payload xDMWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	botUserId := payload.ForUserId

	for _, event := range payload.DirectMessageEvents {
		if event.Type != "message_create" {
			continue
		}

		senderId := event.MessageCreate.SenderId
		// Skip messages sent by the bot itself to avoid infinite loops.
		if senderId == botUserId {
			continue
		}

		text := strings.TrimSpace(event.MessageCreate.MessageData.Text)
		if text == "" {
			continue
		}

		username := senderId
		if user, ok := payload.Users[senderId]; ok {
			if user.Name != "" {
				username = user.Name
			} else if user.ScreenName != "" {
				username = "@" + user.ScreenName
			}
		}

		return &IncomingMessage{
			ChatId:   senderId,
			UserId:   senderId,
			Text:     text,
			Username: username,
		}, nil
	}

	return nil, nil
}

// SetWebhook returns nil because the X Account Activity API webhook URL must
// be registered manually in the X Developer Portal.
func (p *XDMPipe) SetWebhook(webhookUrl string) error {
	return nil
}

// VerifyWebhook handles the CRC challenge issued by the X Account Activity API.
// X sends a GET request with a crc_token query parameter; the response must
// contain the HMAC-SHA256 of crc_token signed with the Consumer Secret.
func (p *XDMPipe) VerifyWebhook(params map[string]string) (*WebhookResponse, error) {
	crcToken, ok := params["crc_token"]
	if !ok || crcToken == "" {
		return &WebhookResponse{
			StatusCode:  http.StatusBadRequest,
			ContentType: "text/plain",
			Body:        []byte("missing crc_token"),
		}, nil
	}

	mac := hmac.New(sha256.New, []byte(p.consumerSecret))
	mac.Write([]byte(crcToken))
	responseToken := "sha256=" + base64.StdEncoding.EncodeToString(mac.Sum(nil))

	respBody, _ := json.Marshal(map[string]string{
		"response_token": responseToken,
	})

	return &WebhookResponse{
		StatusCode:  http.StatusOK,
		ContentType: "application/json",
		Body:        respBody,
	}, nil
}
