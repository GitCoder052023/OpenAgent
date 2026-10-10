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
)

const telegramApiBaseUrl = "https://api.telegram.org"

type TelegramPipe struct {
	botToken   string
	httpClient *http.Client
}

type telegramUser struct {
	Id        int64  `json:"id"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
}

type telegramChat struct {
	Id int64 `json:"id"`
}

type telegramMessage struct {
	MessageId int64         `json:"message_id"`
	From      *telegramUser `json:"from"`
	Chat      *telegramChat `json:"chat"`
	Text      string        `json:"text"`
}

type telegramUpdate struct {
	UpdateId int64            `json:"update_id"`
	Message  *telegramMessage `json:"message"`
}

func NewTelegramPipe(botToken string, httpClient *http.Client) (*TelegramPipe, error) {
	return &TelegramPipe{
		botToken:   botToken,
		httpClient: httpClient,
	}, nil
}

func (p *TelegramPipe) buildUrl(method string) string {
	return fmt.Sprintf("%s/bot%s/%s", telegramApiBaseUrl, p.botToken, method)
}

func (p *TelegramPipe) doPost(method string, payload interface{}) ([]byte, error) {
	return doJSONRequest(p.httpClient, "Telegram", http.MethodPost, p.buildUrl(method), nil, payload, http.StatusOK)
}

func (p *TelegramPipe) SendMessage(chatId string, text string) error {
	payload := map[string]interface{}{
		"chat_id": chatId,
		"text":    text,
	}
	_, err := p.doPost("sendMessage", payload)
	return err
}

func (p *TelegramPipe) ParseWebhookRequest(body []byte) (*IncomingMessage, error) {
	var update telegramUpdate
	if err := json.Unmarshal(body, &update); err != nil {
		return nil, err
	}

	if update.Message == nil || update.Message.Text == "" {
		return nil, nil
	}

	chatId := fmt.Sprintf("%d", update.Message.Chat.Id)
	userId := ""
	username := ""
	if update.Message.From != nil {
		userId = fmt.Sprintf("%d", update.Message.From.Id)
		username = update.Message.From.Username
		if username == "" {
			username = update.Message.From.FirstName
		}
	}

	return &IncomingMessage{
		ChatId:   chatId,
		UserId:   userId,
		Text:     update.Message.Text,
		Username: username,
	}, nil
}

func (p *TelegramPipe) SetWebhook(webhookUrl string) error {
	payload := map[string]interface{}{
		"url": webhookUrl,
	}
	_, err := p.doPost("setWebhook", payload)
	return err
}

type telegramSendResult struct {
	Ok     bool             `json:"ok"`
	Result *telegramMessage `json:"result"`
}

type telegramMessageWriter struct {
	pipe      *TelegramPipe
	chatId    string
	messageId int64
	lastText  string
}

func (w *telegramMessageWriter) editText(text string) error {
	if text == w.lastText {
		return nil
	}
	payload := map[string]interface{}{
		"chat_id":    w.chatId,
		"message_id": w.messageId,
		"text":       text,
	}
	_, err := w.pipe.doPost("editMessageText", payload)
	if err == nil {
		w.lastText = text
	}
	return err
}

func (w *telegramMessageWriter) WriteMessage(text string) error {
	return w.editText(text)
}

func (w *telegramMessageWriter) CloseMessage(text string) error {
	return w.editText(text)
}

func (p *TelegramPipe) SendStreamMessage(incoming *IncomingMessage, text string) (PipeMessageWriter, error) {
	initialText := text
	if initialText == "" {
		initialText = "..."
	}
	payload := map[string]interface{}{
		"chat_id": incoming.ChatId,
		"text":    initialText,
	}
	respBody, err := p.doPost("sendMessage", payload)
	if err != nil {
		return nil, err
	}

	var result telegramSendResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}
	if result.Result == nil || result.Result.MessageId == 0 {
		return nil, fmt.Errorf("Telegram: sendMessage returned no message_id")
	}

	return &telegramMessageWriter{
		pipe:      p,
		chatId:    incoming.ChatId,
		messageId: result.Result.MessageId,
		lastText:  initialText,
	}, nil
}
