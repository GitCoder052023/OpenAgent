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
	"sync"
)

const threadsApiBaseUrl = "https://graph.threads.net/v1.0"

// ThreadsPipe integrates with the Meta Threads API.
// Token     = long-lived User Access Token with threads_basic and threads_manage_replies scopes.
// SecretKey = App Secret from the Meta Developer Console, used to verify X-Hub-Signature-256.
// verifyToken is set to the pipe name and must match the webhook verify token configured in
// the Meta Developer Console.
type ThreadsPipe struct {
	accessToken string
	appSecret   string
	verifyToken string
	httpClient  *http.Client

	mu     sync.Mutex
	userId string
}

type threadsWebhookPayload struct {
	Object string         `json:"object"`
	Entry  []threadsEntry `json:"entry"`
}

type threadsEntry struct {
	Id      string          `json:"id"`
	Time    int64           `json:"time"`
	Changes []threadsChange `json:"changes"`
}

type threadsChange struct {
	Field string       `json:"field"`
	Value threadsValue `json:"value"`
}

type threadsValue struct {
	MediaId   string       `json:"media_id"`
	Text      string       `json:"text"`
	From      *threadsFrom `json:"from,omitempty"`
	Timestamp string       `json:"timestamp"`
}

type threadsFrom struct {
	Id       string `json:"id"`
	Username string `json:"username"`
}

type threadsCreateResponse struct {
	Id string `json:"id"`
}

type threadsMeResponse struct {
	Id       string `json:"id"`
	Username string `json:"username"`
}

func NewThreadsPipe(accessToken string, appSecret string, verifyToken string, httpClient *http.Client) (*ThreadsPipe, error) {
	return &ThreadsPipe{
		accessToken: strings.TrimSpace(accessToken),
		appSecret:   strings.TrimSpace(appSecret),
		verifyToken: verifyToken,
		httpClient:  httpClient,
	}, nil
}

func (p *ThreadsPipe) authHeaders() map[string]string {
	return map[string]string{
		"Authorization": "Bearer " + p.accessToken,
	}
}

// getUserId fetches and caches the Threads user ID for the configured access token.
func (p *ThreadsPipe) getUserId() (string, error) {
	p.mu.Lock()
	uid := p.userId
	p.mu.Unlock()
	if uid != "" {
		return uid, nil
	}

	url := fmt.Sprintf("%s/me?fields=id,username", threadsApiBaseUrl)
	respBody, err := doJSONRequest(p.httpClient, "Threads", http.MethodGet, url, p.authHeaders(), nil, http.StatusOK)
	if err != nil {
		return "", err
	}

	var me threadsMeResponse
	if err := json.Unmarshal(respBody, &me); err != nil {
		return "", err
	}
	if me.Id == "" {
		return "", fmt.Errorf("Threads API returned empty user ID")
	}

	p.mu.Lock()
	p.userId = me.Id
	p.mu.Unlock()
	return me.Id, nil
}

// SendMessage publishes a Threads post replying to chatId, or a new top-level post if
// chatId is empty. The two-step container-then-publish flow is required by the API.
func (p *ThreadsPipe) SendMessage(chatId string, text string) error {
	userId, err := p.getUserId()
	if err != nil {
		return err
	}

	createPayload := map[string]interface{}{
		"media_type": "TEXT",
		"text":       text,
	}
	if chatId != "" {
		createPayload["reply_to_id"] = chatId
	}

	createUrl := fmt.Sprintf("%s/%s/threads", threadsApiBaseUrl, userId)
	createBody, err := doJSONRequest(p.httpClient, "Threads", http.MethodPost, createUrl, p.authHeaders(), createPayload, http.StatusOK)
	if err != nil {
		return err
	}

	var createResp threadsCreateResponse
	if err := json.Unmarshal(createBody, &createResp); err != nil {
		return err
	}
	if createResp.Id == "" {
		return fmt.Errorf("Threads API returned empty creation ID")
	}

	publishUrl := fmt.Sprintf("%s/%s/threads_publish", threadsApiBaseUrl, userId)
	publishPayload := map[string]interface{}{
		"creation_id": createResp.Id,
	}
	_, err = doJSONRequest(p.httpClient, "Threads", http.MethodPost, publishUrl, p.authHeaders(), publishPayload, http.StatusOK)
	return err
}

// ParseWebhookRequest extracts the first reply or mention from a Threads webhook event.
// chatId is the media_id of the triggering thread, which is used as reply_to_id when
// SendMessage is called in response.
func (p *ThreadsPipe) ParseWebhookRequest(body []byte) (*IncomingMessage, error) {
	var payload threadsWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	if payload.Object != "threads" {
		return nil, nil
	}

	for _, entry := range payload.Entry {
		for _, change := range entry.Changes {
			if change.Field != "replies" && change.Field != "mentions" {
				continue
			}
			v := change.Value
			if v.Text == "" || v.MediaId == "" {
				continue
			}

			userId := ""
			username := ""
			if v.From != nil {
				userId = v.From.Id
				username = v.From.Username
			}

			return &IncomingMessage{
				ChatId:   v.MediaId,
				UserId:   userId,
				Text:     strings.TrimSpace(v.Text),
				Username: username,
			}, nil
		}
	}

	return nil, nil
}

// VerifyWebhook handles the Meta hub.challenge verification handshake (GET request).
// The verify token must equal the pipe name configured in the Meta Developer Console.
func (p *ThreadsPipe) VerifyWebhook(params map[string]string) (*WebhookResponse, error) {
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

// SetWebhook returns nil because Threads webhooks are configured manually in the
// Meta Developer Console. The caller displays the webhook URL to the user.
func (p *ThreadsPipe) SetWebhook(webhookUrl string) error {
	return nil
}

// GetWebhookResponse validates the X-Hub-Signature-256 header on every incoming event.
func (p *ThreadsPipe) GetWebhookResponse(body []byte, header http.Header) (*WebhookResponse, error) {
	if err := p.verifySignature(body, header); err != nil {
		return &WebhookResponse{
			StatusCode:  http.StatusUnauthorized,
			ContentType: "text/plain",
			Body:        []byte(err.Error()),
		}, nil
	}
	return nil, nil
}

func (p *ThreadsPipe) verifySignature(body []byte, header http.Header) error {
	if p.appSecret == "" {
		return nil
	}

	signature := header.Get("X-Hub-Signature-256")
	if signature == "" {
		return fmt.Errorf("missing X-Hub-Signature-256 header")
	}

	expected := "sha256=" + computeHmacSha256(body, p.appSecret)
	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return fmt.Errorf("invalid Threads webhook signature")
	}

	return nil
}
