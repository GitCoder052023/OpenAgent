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
	"crypto/sha1"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

const wechatApiBaseUrl = "https://api.weixin.qq.com"

// WeChatPipe integrates with the WeChat Official Account (公众号) platform.
// Token = AppID, SecretKey = AppSecret, verifyToken = pipe name.
type WeChatPipe struct {
	appID       string
	appSecret   string
	verifyToken string
	httpClient  *http.Client

	mu          sync.Mutex
	accessToken string
	tokenExpiry time.Time
}

type wechatXMLMessage struct {
	ToUserName   string `xml:"ToUserName"`
	FromUserName string `xml:"FromUserName"`
	CreateTime   int64  `xml:"CreateTime"`
	MsgType      string `xml:"MsgType"`
	Content      string `xml:"Content"`
	MsgId        int64  `xml:"MsgId"`
}

type wechatAccessTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	ErrCode     int    `json:"errcode"`
	ErrMsg      string `json:"errmsg"`
}

type wechatAPIResponse struct {
	ErrCode int    `json:"errcode"`
	ErrMsg  string `json:"errmsg"`
}

type wechatCustomMessagePayload struct {
	ToUser  string         `json:"touser"`
	MsgType string         `json:"msgtype"`
	Text    wechatTextBody `json:"text"`
}

type wechatTextBody struct {
	Content string `json:"content"`
}

func NewWeChatPipe(appID string, appSecret string, verifyToken string, httpClient *http.Client) (*WeChatPipe, error) {
	return &WeChatPipe{
		appID:       strings.TrimSpace(appID),
		appSecret:   strings.TrimSpace(appSecret),
		verifyToken: verifyToken,
		httpClient:  httpClient,
	}, nil
}

// verifySignature validates the SHA1 signature used by WeChat for both GET
// challenges and POST message delivery.
func (p *WeChatPipe) verifySignature(signature, timestamp, nonce string) bool {
	strs := []string{p.verifyToken, timestamp, nonce}
	sort.Strings(strs)
	h := sha1.New()
	h.Write([]byte(strings.Join(strs, "")))
	return fmt.Sprintf("%x", h.Sum(nil)) == signature
}

// VerifyWebhook handles the GET challenge that the WeChat platform sends when
// a server URL is configured in the WeChat Official Account settings.
func (p *WeChatPipe) VerifyWebhook(params map[string]string) (*WebhookResponse, error) {
	signature := params["signature"]
	timestamp := params["timestamp"]
	nonce := params["nonce"]
	echostr := params["echostr"]

	if !p.verifySignature(signature, timestamp, nonce) {
		return &WebhookResponse{StatusCode: http.StatusForbidden}, nil
	}

	return &WebhookResponse{
		StatusCode:  http.StatusOK,
		ContentType: "text/plain",
		Body:        []byte(echostr),
	}, nil
}

// GetWebhookResponse responds to the WeChat platform immediately with "success"
// so processing can happen asynchronously. WeChat retries if the server does not
// respond within 5 seconds, so the AI response must be sent via SendMessage.
func (p *WeChatPipe) GetWebhookResponse(body []byte, header http.Header) (*WebhookResponse, error) {
	return &WebhookResponse{
		StatusCode:  http.StatusOK,
		ContentType: "text/plain",
		Body:        []byte("success"),
	}, nil
}

// ParseWebhookRequest parses the XML message body sent by the WeChat platform.
// Only text messages are processed; other event types return nil.
func (p *WeChatPipe) ParseWebhookRequest(body []byte) (*IncomingMessage, error) {
	var msg wechatXMLMessage
	if err := xml.Unmarshal(body, &msg); err != nil {
		return nil, err
	}

	if msg.MsgType != "text" || strings.TrimSpace(msg.Content) == "" {
		return nil, nil
	}

	return &IncomingMessage{
		ChatId:   msg.FromUserName,
		UserId:   msg.FromUserName,
		Text:     strings.TrimSpace(msg.Content),
		Username: msg.FromUserName,
	}, nil
}

// getAccessToken returns a valid access token, refreshing it when near expiry.
func (p *WeChatPipe) getAccessToken() (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.accessToken != "" && time.Now().Before(p.tokenExpiry) {
		return p.accessToken, nil
	}

	url := fmt.Sprintf("%s/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s",
		wechatApiBaseUrl, p.appID, p.appSecret)

	respBody, err := doJSONRequest(p.httpClient, "WeChat", http.MethodGet, url, nil, nil, http.StatusOK)
	if err != nil {
		return "", err
	}

	var tokenResp wechatAccessTokenResponse
	if err := json.Unmarshal(respBody, &tokenResp); err != nil {
		return "", fmt.Errorf("WeChat: failed to parse access token response: %w", err)
	}

	if tokenResp.ErrCode != 0 {
		return "", fmt.Errorf("WeChat: access token error %d: %s", tokenResp.ErrCode, tokenResp.ErrMsg)
	}

	p.accessToken = tokenResp.AccessToken
	// Refresh 5 minutes before the token actually expires.
	p.tokenExpiry = time.Now().Add(time.Duration(tokenResp.ExpiresIn-300) * time.Second)
	return p.accessToken, nil
}

// SendMessage sends a text message to the user via the WeChat Customer Service
// Message API (客服消息). The user must have interacted within the last 48 hours.
func (p *WeChatPipe) SendMessage(chatId string, text string) error {
	token, err := p.getAccessToken()
	if err != nil {
		return err
	}

	payload := wechatCustomMessagePayload{
		ToUser:  chatId,
		MsgType: "text",
		Text:    wechatTextBody{Content: text},
	}

	url := fmt.Sprintf("%s/cgi-bin/message/custom/send?access_token=%s", wechatApiBaseUrl, token)
	respBody, err := doJSONRequest(p.httpClient, "WeChat", http.MethodPost, url, nil, payload, http.StatusOK)
	if err != nil {
		return err
	}

	var apiResp wechatAPIResponse
	if jsonErr := json.Unmarshal(respBody, &apiResp); jsonErr != nil {
		return nil
	}
	if apiResp.ErrCode != 0 {
		return fmt.Errorf("WeChat: customer service message error %d: %s", apiResp.ErrCode, apiResp.ErrMsg)
	}

	return nil
}

// SetWebhook returns nil because the WeChat server URL must be configured
// manually in the WeChat Official Account Platform (mp.weixin.qq.com).
func (p *WeChatPipe) SetWebhook(webhookUrl string) error {
	return nil
}
