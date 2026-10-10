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
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	WeixinClawType           = "Weixin Claw"
	WeixinClawDefaultBaseUrl = "https://ilinkai.weixin.qq.com"
	WeixinClawDefaultBotType = "3"

	weixinClawAppId             = "bot"
	weixinClawClientVersion     = "131335"
	weixinClawChannel           = "openagent"
	weixinClawMessageText       = 1
	weixinClawMessageBot        = 2
	weixinClawMessageFinish     = 2
	weixinClawQRStatusTimeoutMs = 40000
)

type WeixinClawPipe struct {
	client *WeixinClawClient
}

type WeixinClawClient struct {
	baseUrl    string
	token      string
	httpClient *http.Client
}

type WeixinClawQRCodeResponse struct {
	Qrcode             string `json:"qrcode"`
	QrcodeImageContent string `json:"qrcode_img_content"`
}

type WeixinClawQRCodeStatus struct {
	Status       string `json:"status"`
	BotToken     string `json:"bot_token"`
	IlinkBotId   string `json:"ilink_bot_id"`
	BaseUrl      string `json:"baseurl"`
	IlinkUserId  string `json:"ilink_user_id"`
	RedirectHost string `json:"redirect_host"`
}

type WeixinClawBaseInfo struct {
	ChannelVersion string `json:"channel_version"`
}

type WeixinClawGetUpdatesResponse struct {
	Ret                  int                  `json:"ret"`
	ErrCode              int                  `json:"errcode"`
	ErrMsg               string               `json:"errmsg"`
	Messages             []*WeixinClawMessage `json:"msgs"`
	GetUpdatesBuf        string               `json:"get_updates_buf"`
	LongPollingTimeoutMs int                  `json:"longpolling_timeout_ms"`
}

type WeixinClawMessage struct {
	Seq          int64                    `json:"seq"`
	MessageId    int64                    `json:"message_id"`
	FromUserId   string                   `json:"from_user_id"`
	ToUserId     string                   `json:"to_user_id"`
	ClientId     string                   `json:"client_id"`
	CreateTimeMs int64                    `json:"create_time_ms"`
	SessionId    string                   `json:"session_id"`
	MessageType  int                      `json:"message_type"`
	MessageState int                      `json:"message_state"`
	ItemList     []*WeixinClawMessageItem `json:"item_list"`
	ContextToken string                   `json:"context_token"`
}

type WeixinClawMessageItem struct {
	Type     int                 `json:"type"`
	TextItem *WeixinClawTextItem `json:"text_item,omitempty"`
}

type WeixinClawTextItem struct {
	Text string `json:"text"`
}

type weixinClawGetUpdatesRequest struct {
	GetUpdatesBuf string             `json:"get_updates_buf"`
	BaseInfo      WeixinClawBaseInfo `json:"base_info"`
}

type weixinClawSendMessageRequest struct {
	Message  WeixinClawMessage  `json:"msg"`
	BaseInfo WeixinClawBaseInfo `json:"base_info"`
}

type weixinClawApiResponse struct {
	Ret     int    `json:"ret"`
	ErrCode int    `json:"errcode"`
	ErrMsg  string `json:"errmsg"`
}

func NewWeixinClawPipe(baseUrl string, token string, httpClient *http.Client) (*WeixinClawPipe, error) {
	if strings.TrimSpace(token) == "" {
		return nil, fmt.Errorf("Weixin Claw bot token should not be empty")
	}
	return &WeixinClawPipe{client: NewWeixinClawClient(baseUrl, token, httpClient)}, nil
}

func NewWeixinClawClient(baseUrl string, token string, httpClient *http.Client) *WeixinClawClient {
	if strings.TrimSpace(baseUrl) == "" {
		baseUrl = WeixinClawDefaultBaseUrl
	}
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &WeixinClawClient{
		baseUrl:    strings.TrimRight(strings.TrimSpace(baseUrl), "/"),
		token:      strings.TrimSpace(token),
		httpClient: httpClient,
	}
}

func (p *WeixinClawPipe) SendMessage(chatId string, text string) error {
	return p.client.SendTextMessage(chatId, "", text)
}

func (p *WeixinClawPipe) SendIncomingMessage(incoming *IncomingMessage, text string) error {
	if incoming == nil {
		return fmt.Errorf("Weixin Claw incoming message should not be nil")
	}
	contextToken := ""
	if incoming != nil && incoming.Metadata != nil {
		contextToken = incoming.Metadata["contextToken"]
	}
	return p.client.SendTextMessage(incoming.ChatId, contextToken, text)
}

func (p *WeixinClawPipe) ParseWebhookRequest(body []byte) (*IncomingMessage, error) {
	return nil, fmt.Errorf("Weixin Claw uses long polling and does not support webhook parsing")
}

func (p *WeixinClawPipe) SetWebhook(webhookUrl string) error {
	return fmt.Errorf("Weixin Claw uses long polling and does not support webhook setup")
}

func (c *WeixinClawClient) StartQRCodeLogin() (*WeixinClawQRCodeResponse, error) {
	var response WeixinClawQRCodeResponse
	err := c.doGet(fmt.Sprintf("ilink/bot/get_bot_qrcode?bot_type=%s", url.QueryEscape(WeixinClawDefaultBotType)), 0, &response)
	if err != nil {
		return nil, err
	}
	if response.Qrcode == "" || response.QrcodeImageContent == "" {
		return nil, fmt.Errorf("Weixin Claw get_bot_qrcode response is missing qrcode")
	}
	return &response, nil
}

func (c *WeixinClawClient) PollQRCodeStatus(qrcode string) (*WeixinClawQRCodeStatus, error) {
	if strings.TrimSpace(qrcode) == "" {
		return nil, fmt.Errorf("Weixin Claw qrcode should not be empty")
	}
	var response WeixinClawQRCodeStatus
	err := c.doGet(fmt.Sprintf("ilink/bot/get_qrcode_status?qrcode=%s", url.QueryEscape(qrcode)), weixinClawQRStatusTimeoutMs, &response)
	if err != nil {
		if strings.Contains(err.Error(), "context deadline exceeded") || strings.Contains(err.Error(), "Client.Timeout exceeded") {
			return &WeixinClawQRCodeStatus{Status: "wait"}, nil
		}
		return nil, err
	}
	return &response, nil
}

func (c *WeixinClawClient) GetUpdates(ctx context.Context, getUpdatesBuf string, timeoutMs int) (*WeixinClawGetUpdatesResponse, error) {
	request := weixinClawGetUpdatesRequest{
		GetUpdatesBuf: getUpdatesBuf,
		BaseInfo:      WeixinClawBaseInfo{ChannelVersion: weixinClawChannel},
	}
	var response WeixinClawGetUpdatesResponse
	if err := c.doPost(ctx, "ilink/bot/getupdates", request, timeoutMs, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *WeixinClawClient) SendTextMessage(toUserId string, contextToken string, text string) error {
	if strings.TrimSpace(toUserId) == "" {
		return fmt.Errorf("Weixin Claw to_user_id should not be empty")
	}
	request := weixinClawSendMessageRequest{
		Message: WeixinClawMessage{
			ToUserId:     toUserId,
			ClientId:     generateWeixinClawClientId(),
			MessageType:  weixinClawMessageBot,
			MessageState: weixinClawMessageFinish,
			ContextToken: contextToken,
			ItemList: []*WeixinClawMessageItem{
				{Type: weixinClawMessageText, TextItem: &WeixinClawTextItem{Text: text}},
			},
		},
		BaseInfo: WeixinClawBaseInfo{ChannelVersion: weixinClawChannel},
	}
	var response weixinClawApiResponse
	if err := c.doPost(context.Background(), "ilink/bot/sendmessage", request, 0, &response); err != nil {
		return err
	}
	if response.Ret != 0 || response.ErrCode != 0 {
		return fmt.Errorf("Weixin Claw sendmessage error: ret=%d errcode=%d errmsg=%s", response.Ret, response.ErrCode, response.ErrMsg)
	}
	return nil
}

func (m *WeixinClawMessage) Text() string {
	if m == nil {
		return ""
	}
	for _, item := range m.ItemList {
		if item != nil && item.Type == weixinClawMessageText && item.TextItem != nil {
			return item.TextItem.Text
		}
	}
	return ""
}

func (c *WeixinClawClient) doGet(endpoint string, timeoutMs int, target interface{}) error {
	ctx := context.Background()
	var cancel context.CancelFunc
	if timeoutMs > 0 {
		ctx, cancel = context.WithTimeout(ctx, time.Duration(timeoutMs)*time.Millisecond)
		defer cancel()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.buildUrl(endpoint), nil)
	if err != nil {
		return err
	}
	setWeixinClawCommonHeaders(req.Header)
	return c.do(req, target)
}

func (c *WeixinClawClient) doPost(ctx context.Context, endpoint string, payload interface{}, timeoutMs int, target interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if ctx == nil {
		ctx = context.Background()
	}
	var cancel context.CancelFunc
	if timeoutMs > 0 {
		ctx, cancel = context.WithTimeout(ctx, time.Duration(timeoutMs+5000)*time.Millisecond)
		defer cancel()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.buildUrl(endpoint), bytes.NewReader(body))
	if err != nil {
		return err
	}
	setWeixinClawCommonHeaders(req.Header)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("AuthorizationType", "ilink_bot_token")
	req.Header.Set("Content-Length", strconv.Itoa(len(body)))
	req.Header.Set("X-WECHAT-UIN", randomWeixinClawUin())
	if c.token != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.token))
	}
	return c.do(req, target)
}

func (c *WeixinClawClient) do(req *http.Request, target interface{}) error {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Weixin Claw API error (status %d): %s", resp.StatusCode, string(respBody))
	}
	if target == nil || len(respBody) == 0 {
		return nil
	}
	return json.Unmarshal(respBody, target)
}

func (c *WeixinClawClient) buildUrl(endpoint string) string {
	return fmt.Sprintf("%s/%s", c.baseUrl, strings.TrimLeft(endpoint, "/"))
}

func setWeixinClawCommonHeaders(header http.Header) {
	header.Set("iLink-App-Id", weixinClawAppId)
	header.Set("iLink-App-ClientVersion", weixinClawClientVersion)
}

func randomWeixinClawUin() string {
	buf := make([]byte, 4)
	if _, err := rand.Read(buf); err != nil {
		return base64.StdEncoding.EncodeToString([]byte("0"))
	}
	value := binary.BigEndian.Uint32(buf)
	return base64.StdEncoding.EncodeToString([]byte(strconv.FormatUint(uint64(value), 10)))
}

func generateWeixinClawClientId() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("openagent-%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("openagent-%x", buf)
}
