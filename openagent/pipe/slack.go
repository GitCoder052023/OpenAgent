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
	"strconv"
	"strings"
	"time"
)

var slackApiBaseUrl = "https://slack.com/api"

type SlackPipe struct {
	botToken      string
	signingSecret string
	httpClient    *http.Client
}

type slackEventPayload struct {
	Type      string         `json:"type"`
	Challenge string         `json:"challenge"`
	Event     *slackMsgEvent `json:"event"`
}

type slackMsgEvent struct {
	Type    string `json:"type"`
	Subtype string `json:"subtype"`
	Channel string `json:"channel"`
	User    string `json:"user"`
	Text    string `json:"text"`
	BotId   string `json:"bot_id"`
}

func NewSlackPipe(botToken string, signingSecret string, httpClient *http.Client) (*SlackPipe, error) {
	return &SlackPipe{
		botToken:      botToken,
		signingSecret: signingSecret,
		httpClient:    httpClient,
	}, nil
}

func (p *SlackPipe) SendMessage(chatId string, text string) error {
	payload := map[string]interface{}{
		"channel": chatId,
		"text":    text,
	}
	headers := map[string]string{
		"Authorization": "Bearer " + p.botToken,
	}
	_, err := doJSONRequest(
		p.httpClient,
		"Slack",
		http.MethodPost,
		slackApiBaseUrl+"/chat.postMessage",
		headers,
		payload,
		http.StatusOK,
	)
	return err
}

func (p *SlackPipe) ParseWebhookRequest(body []byte) (*IncomingMessage, error) {
	var payload slackEventPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	if payload.Type != "event_callback" || payload.Event == nil {
		return nil, nil
	}

	event := payload.Event
	// Skip bot messages and message subtypes (edits, deletions, etc.)
	if event.Type != "message" || event.BotId != "" || event.Subtype != "" {
		return nil, nil
	}

	if event.Channel == "" || event.Text == "" {
		return nil, nil
	}

	return &IncomingMessage{
		ChatId:   event.Channel,
		UserId:   event.User,
		Text:     strings.TrimSpace(event.Text),
		Username: event.User,
	}, nil
}

// SetWebhook for Slack requires manual configuration in the Slack App settings.
// The webhook URL should be set under Event Subscriptions in the Slack API portal.
func (p *SlackPipe) SetWebhook(webhookUrl string) error {
	return nil
}

type slackPostMessageResult struct {
	Ok      bool   `json:"ok"`
	Channel string `json:"channel"`
	Ts      string `json:"ts"`
}

type slackMessageWriter struct {
	pipe     *SlackPipe
	channel  string
	ts       string
	lastText string
}

func (w *slackMessageWriter) editText(text string) error {
	if text == w.lastText {
		return nil
	}
	payload := map[string]interface{}{
		"channel": w.channel,
		"ts":      w.ts,
		"text":    text,
	}
	headers := map[string]string{
		"Authorization": "Bearer " + w.pipe.botToken,
	}
	_, err := doJSONRequest(
		w.pipe.httpClient,
		"Slack",
		http.MethodPost,
		slackApiBaseUrl+"/chat.update",
		headers,
		payload,
		http.StatusOK,
	)
	if err == nil {
		w.lastText = text
	}
	return err
}

func (w *slackMessageWriter) WriteMessage(text string) error {
	return w.editText(text)
}

func (w *slackMessageWriter) CloseMessage(text string) error {
	return w.editText(text)
}

func (p *SlackPipe) SendStreamMessage(incoming *IncomingMessage, text string) (PipeMessageWriter, error) {
	initialText := text
	if initialText == "" {
		initialText = "..."
	}
	payload := map[string]interface{}{
		"channel": incoming.ChatId,
		"text":    initialText,
	}
	headers := map[string]string{
		"Authorization": "Bearer " + p.botToken,
	}
	respBody, err := doJSONRequest(
		p.httpClient,
		"Slack",
		http.MethodPost,
		slackApiBaseUrl+"/chat.postMessage",
		headers,
		payload,
		http.StatusOK,
	)
	if err != nil {
		return nil, err
	}

	var result slackPostMessageResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}
	if !result.Ok || result.Ts == "" {
		return nil, fmt.Errorf("Slack: postMessage failed or returned no ts")
	}

	return &slackMessageWriter{
		pipe:     p,
		channel:  result.Channel,
		ts:       result.Ts,
		lastText: initialText,
	}, nil
}

// GetWebhookResponse handles Slack's URL verification challenge and validates
// the HMAC-SHA256 request signature on every incoming event.
func (p *SlackPipe) GetWebhookResponse(body []byte, header http.Header) (*WebhookResponse, error) {
	if err := p.verifySignature(body, header); err != nil {
		return &WebhookResponse{
			StatusCode:  http.StatusUnauthorized,
			ContentType: "text/plain",
			Body:        []byte(err.Error()),
		}, nil
	}

	var payload slackEventPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	if payload.Type == "url_verification" {
		respBody, err := json.Marshal(map[string]string{"challenge": payload.Challenge})
		if err != nil {
			return nil, err
		}
		return &WebhookResponse{
			StatusCode:  http.StatusOK,
			ContentType: "application/json",
			Body:        respBody,
		}, nil
	}

	// Return an immediate 200 for regular events so Slack does not retry.
	// The actual message processing happens asynchronously in sendPipeAnswer.
	return &WebhookResponse{StatusCode: http.StatusOK}, nil
}

func (p *SlackPipe) verifySignature(body []byte, header http.Header) error {
	if p.signingSecret == "" {
		return nil
	}

	timestamp := header.Get("X-Slack-Request-Timestamp")
	signature := header.Get("X-Slack-Signature")
	if timestamp == "" || signature == "" {
		return fmt.Errorf("missing Slack signature headers")
	}

	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid Slack request timestamp")
	}
	diff := time.Now().Unix() - ts
	if diff < 0 {
		diff = -diff
	}
	if diff > 300 {
		return fmt.Errorf("Slack request timestamp is too old")
	}

	sigBase := fmt.Sprintf("v0:%s:%s", timestamp, string(body))
	mac := hmac.New(sha256.New, []byte(p.signingSecret))
	mac.Write([]byte(sigBase))
	expected := "v0=" + hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return fmt.Errorf("invalid Slack signature")
	}

	return nil
}
