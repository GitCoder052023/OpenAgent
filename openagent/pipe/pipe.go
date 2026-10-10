// Copyright 2025 The OpenAgent Authors. All Rights Reserved.
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
	"fmt"
	"net/http"
	"strings"

	"github.com/the-open-agent/openagent/i18n"
	"github.com/the-open-agent/openagent/proxy"
)

type IncomingMessage struct {
	ChatId   string
	UserId   string
	Text     string
	Username string
	Metadata map[string]string // platform-specific data (e.g. Discord interaction token)
}

// Pipe is the core interface every pipe platform must implement.
type Pipe interface {
	SendMessage(chatId string, text string) error
	ParseWebhookRequest(body []byte) (*IncomingMessage, error)
	SetWebhook(webhookUrl string) error
}

type PipeMessageWriter interface {
	WriteMessage(text string) error
	CloseMessage(text string) error
}

type IncomingMessageSender interface {
	SendIncomingMessage(incoming *IncomingMessage, text string) error
}

// StreamPipe is implemented by pipes that can progressively update an
// in-flight response (for example via send + edit message APIs).
type StreamPipe interface {
	SendStreamMessage(incoming *IncomingMessage, text string) (PipeMessageWriter, error)
}

type WebhookResponse struct {
	StatusCode  int
	ContentType string
	Body        []byte
}

// ImmediateWebhookResponder is implemented by pipes that must reply to the
// webhook HTTP request before processing the message (e.g. Discord interactions).
type ImmediateWebhookResponder interface {
	GetWebhookResponse(body []byte, header http.Header) (*WebhookResponse, error)
}

// WebhookVerifier is implemented by pipes that verify webhook ownership via
// a GET request challenge (e.g. WhatsApp Cloud API hub.challenge handshake).
type WebhookVerifier interface {
	VerifyWebhook(params map[string]string) (*WebhookResponse, error)
}

func NormalizeType(typ string) string {
	return strings.ToLower(strings.ReplaceAll(typ, " ", "-"))
}

// Get returns a Pipe implementation for the given pipe type.
// pipeName is passed to implementations that use it as part of their configuration
// (e.g. WhatsApp uses it as the webhook verify token).
func Get(typ string, token string, secretKey string, pipeName string, lang string) (Pipe, error) {
	var p Pipe
	var err error

	if typ == "Telegram" {
		p, err = NewTelegramPipe(token, proxy.ProxyHttpClient)
	} else if typ == "Discord" {
		p, err = NewDiscordPipe(token, secretKey, proxy.ProxyHttpClient)
	} else if typ == "WhatsApp" {
		p, err = NewWhatsAppPipe(token, secretKey, pipeName, proxy.ProxyHttpClient)
	} else if typ == "Slack" {
		p, err = NewSlackPipe(token, secretKey, proxy.ProxyHttpClient)
	} else if typ == "Facebook Messenger" {
		p, err = NewFacebookMessengerPipe(token, secretKey, pipeName, proxy.ProxyHttpClient)
	} else if typ == "WeChat" {
		p, err = NewWeChatPipe(token, secretKey, pipeName, proxy.ProxyHttpClient)
	} else if typ == WeixinClawType {
		p, err = NewWeixinClawPipe(secretKey, token, proxy.ProxyHttpClient)
	} else if typ == "Snapchat" {
		p, err = NewSnapchatPipe(token, secretKey, proxy.ProxyHttpClient)
	} else if typ == "X Direct Messages" {
		p, err = NewXDMPipe(token, secretKey, proxy.ProxyHttpClient)
	} else if typ == "Threads" {
		p, err = NewThreadsPipe(token, secretKey, pipeName, proxy.ProxyHttpClient)
	} else {
		return nil, fmt.Errorf(i18n.Translate(lang, "object:the pipe type: %s is not supported"), typ)
	}

	if err != nil {
		return nil, err
	}

	return p, nil
}
