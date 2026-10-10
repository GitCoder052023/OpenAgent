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

package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/object"
	pipepkg "github.com/the-open-agent/openagent/pipe"
	"github.com/the-open-agent/openagent/util"
)

type pipeAnswerSender interface {
	WriteMessage(text string) error
	WriteError(text string) error
	CloseMessage(text string) error
}

type defaultPipeAnswerSender struct {
	provider  pipepkg.Pipe
	incoming  *pipepkg.IncomingMessage
	text      string
	errorText string
}

type streamPipeAnswerSender struct {
	writer    pipepkg.PipeMessageWriter
	text      string
	errorText string
}

// ChatWebhookVerify handles the HTTP GET challenge that some platforms (e.g. WhatsApp
// Cloud API) send to verify webhook ownership before they start delivering events.
// The URL format is: /api/chat-webhook/:pipeType/:pipeName
// This endpoint does not require authentication.
// @router /api/chat-webhook/:pipeType/:pipeName [get]
func (c *ApiController) ChatWebhookVerify() {
	pipeType := c.Ctx.Input.Param(":pipeType")
	pipeName := c.Ctx.Input.Param(":pipeName")

	pipeObj, err := object.GetPipeByName("admin", pipeName)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		return
	}
	if pipeObj == nil || pipepkg.NormalizeType(pipeObj.Type) != pipeType {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
		return
	}

	provider, err := pipeObj.GetProvider(c.GetAcceptLanguage())
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		return
	}

	verifier, ok := provider.(pipepkg.WebhookVerifier)
	if !ok {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	params := map[string]string{}
	for key, values := range c.Ctx.Request.URL.Query() {
		if len(values) > 0 {
			params[key] = values[0]
		}
	}

	response, err := verifier.VerifyWebhook(params)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		return
	}

	writePipeWebhookResponse(c, response)
}

// ChatWebhook receives incoming updates from a chat pipe.
// The URL format is: /api/chat-webhook/:pipeType/:pipeName
// This endpoint does not require authentication because it is called by chat platform servers.
// @router /api/chat-webhook/:pipeType/:pipeName [post]
func (c *ApiController) ChatWebhook() {
	pipeType := c.Ctx.Input.Param(":pipeType")
	pipeName := c.Ctx.Input.Param(":pipeName")
	host := c.Ctx.Request.Host
	lang := c.GetAcceptLanguage()

	pipeObj, err := object.GetPipeByName("admin", pipeName)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		return
	}
	if pipeObj == nil || pipepkg.NormalizeType(pipeObj.Type) != pipeType {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
		return
	}

	provider, err := pipeObj.GetProvider(lang)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		return
	}

	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		return
	}

	immediateResponse, err := getImmediatePipeResponse(provider, body, c.Ctx.Request.Header)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		return
	}
	// A 4xx/5xx immediate response means the request was rejected (e.g. a bad signature),
	// so the update must not be processed.
	if immediateResponse != nil && immediateResponse.StatusCode >= http.StatusBadRequest {
		writePipeWebhookResponse(c, immediateResponse)
		return
	}

	incoming, err := provider.ParseWebhookRequest(body)
	if err != nil {
		// Acknowledge malformed updates so chat platforms do not keep retrying them.
		c.Ctx.ResponseWriter.WriteHeader(http.StatusOK)
		return
	}
	if incoming == nil {
		writePipeWebhookResponse(c, immediateResponse)
		return
	}

	if immediateResponse != nil {
		writePipeWebhookResponse(c, immediateResponse)
		go sendPipeAnswer(provider, pipeObj, incoming, host, lang, false)
		return
	}

	sendPipeAnswer(provider, pipeObj, incoming, host, lang, false)
	c.Ctx.ResponseWriter.WriteHeader(http.StatusOK)
}

func getImmediatePipeResponse(provider pipepkg.Pipe, body []byte, header http.Header) (*pipepkg.WebhookResponse, error) {
	responder, ok := provider.(pipepkg.ImmediateWebhookResponder)
	if !ok {
		return nil, nil
	}
	return responder.GetWebhookResponse(body, header)
}

func writePipeWebhookResponse(c *ApiController, response *pipepkg.WebhookResponse) {
	if response == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusOK)
		return
	}

	if response.ContentType != "" {
		c.Ctx.Output.Header("Content-Type", response.ContentType)
	}
	statusCode := response.StatusCode
	if statusCode == 0 {
		statusCode = http.StatusOK
	}

	c.Ctx.ResponseWriter.WriteHeader(statusCode)
	if len(response.Body) > 0 {
		_, _ = c.Ctx.ResponseWriter.Write(response.Body)
	}
}

type pipeSSERecorder struct {
	header http.Header
	body   bytes.Buffer
	status int
	sender pipeAnswerSender
}

func newPipeSSERecorder(sender pipeAnswerSender) *pipeSSERecorder {
	return &pipeSSERecorder{header: http.Header{}, status: http.StatusOK, sender: sender}
}

func (r *pipeSSERecorder) Header() http.Header {
	return r.header
}

func (r *pipeSSERecorder) WriteHeader(statusCode int) {
	r.status = statusCode
}

func (r *pipeSSERecorder) Write(p []byte) (int, error) {
	n, err := r.body.Write(p)
	if err != nil {
		return n, err
	}

	if r.sender != nil {
		r.consumeBody()
	}

	return n, nil
}

func (r *pipeSSERecorder) Flush() {}

var sseDelimiter = []byte("\n\n")

func (r *pipeSSERecorder) consumeBody() {
	for {
		buf := r.body.Bytes()
		idx := bytes.Index(buf, sseDelimiter)
		if idx == -1 {
			return
		}

		chunk := string(buf[:idx])
		remaining := make([]byte, len(buf)-idx-2)
		copy(remaining, buf[idx+2:])
		r.body.Reset()
		_, _ = r.body.Write(remaining)

		r.consumeChunk(chunk)
	}
}

func (r *pipeSSERecorder) consumeChunk(chunk string) {
	lines := strings.Split(chunk, "\n")
	if len(lines) == 0 {
		return
	}

	eventType := ""
	if strings.HasPrefix(lines[0], "event: ") {
		eventType = strings.TrimPrefix(lines[0], "event: ")
	}

	switch eventType {
	case "message":
		for _, line := range lines {
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			payload := strings.TrimPrefix(line, "data: ")
			var data map[string]string
			if err := json.Unmarshal([]byte(payload), &data); err == nil && r.sender != nil {
				_ = r.sender.WriteMessage(data["text"])
			}
		}
	case "myerror":
		for _, line := range lines {
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			payload := strings.TrimPrefix(line, "data: ")
			if r.sender != nil {
				_ = r.sender.WriteError(payload)
			}
		}
	}
}

func ensurePipeChat(pipeObj *object.Pipe, incoming *pipepkg.IncomingMessage) (*object.Chat, error) {
	chatName := fmt.Sprintf("pipe_%s_%s", pipeObj.Name, incoming.ChatId)
	chatId := util.GetIdFromOwnerAndName("admin", chatName)
	chat, err := object.GetChat(chatId)
	if err != nil {
		return nil, err
	}
	// Users choose their own chat names, so a chat with this name that the pipe did not create
	// (its user is the chat name) must not receive the pipe's messages.
	if chat != nil && chat.User != chatName {
		return nil, fmt.Errorf("the chat: %s is not a pipe chat", chatId)
	}
	if chat != nil {
		if pipeObj.Store != "" && chat.Store != pipeObj.Store {
			chat.Store = pipeObj.Store
			chat.UpdatedTime = util.GetCurrentTime()
			if _, err = object.UpdateChat(chat.GetId(), chat); err != nil {
				return nil, err
			}
		}
		return chat, nil
	}

	casdoorOrganization := conf.GetConfigString("casdoorOrganization")
	storeName := ""
	if pipeObj.Store != "" {
		storeName = pipeObj.Store
	} else {
		defaultStore, err := object.GetDefaultStore("admin")
		if err != nil {
			return nil, err
		}
		if defaultStore != nil {
			storeName = defaultStore.Name
		}
	}

	currentTime := util.GetCurrentTime()
	chat = &object.Chat{
		Owner:         "admin",
		Name:          chatName,
		CreatedTime:   currentTime,
		UpdatedTime:   currentTime,
		Organization:  casdoorOrganization,
		DisplayName:   incoming.Username,
		Store:         storeName,
		ModelProvider: "",
		Category:      "Pipe",
		User:          chatName,
		ClientIp:      "",
		UserAgent:     fmt.Sprintf("pipe/%s", pipeObj.Type),
		MessageCount:  0,
		IsHidden:      true,
	}
	_, err = object.AddChat(chat)
	if err != nil {
		return nil, err
	}
	return chat, nil
}

func addPipeQuestionAndAnswerMessages(chat *object.Chat, incoming *pipepkg.IncomingMessage) (*object.Message, *object.Message, error) {
	questionMessage := &object.Message{
		Owner:        "admin",
		Name:         fmt.Sprintf("message_%s", util.GetRandomName()),
		CreatedTime:  util.GetCurrentTimeWithMilli(),
		Organization: chat.Organization,
		Store:        chat.Store,
		User:         chat.User,
		Chat:         chat.Name,
		ReplyTo:      "",
		Author:       incoming.Username,
		Text:         incoming.Text,
	}
	if questionMessage.Author == "" {
		questionMessage.Author = incoming.UserId
	}
	if questionMessage.Author == "" {
		questionMessage.Author = "User"
	}

	_, err := object.AddMessage(questionMessage)
	if err != nil {
		return nil, nil, err
	}

	answerMessage := &object.Message{
		Owner:         "admin",
		Name:          fmt.Sprintf("message_%s", util.GetRandomName()),
		CreatedTime:   util.GetCurrentTimeEx(questionMessage.CreatedTime),
		Organization:  chat.Organization,
		Store:         chat.Store,
		User:          chat.User,
		Chat:          chat.Name,
		ReplyTo:       questionMessage.Name,
		Author:        "AI",
		Text:          "",
		ModelProvider: chat.ModelProvider,
	}

	_, err = object.AddMessage(answerMessage)
	if err != nil {
		return nil, nil, err
	}

	return questionMessage, answerMessage, nil
}

// sendPipeAnswer answers an incoming pipe message. allowHighRiskTools must only be true when the
// sender is authenticated by the transport; public webhooks can be called by anyone who knows the URL.
func sendPipeAnswer(provider pipepkg.Pipe, pipeObj *object.Pipe, incoming *pipepkg.IncomingMessage, host string, lang string, allowHighRiskTools bool) {
	chat, err := ensurePipeChat(pipeObj, incoming)
	if err != nil {
		_ = provider.SendMessage(incoming.ChatId, fmt.Sprintf("Error: %v", err))
		return
	}

	_, answerMessage, err := addPipeQuestionAndAnswerMessages(chat, incoming)
	if err != nil {
		_ = provider.SendMessage(incoming.ChatId, fmt.Sprintf("Error: %v", err))
		return
	}

	var sender pipeAnswerSender = newDefaultPipeAnswerSender(provider, incoming)
	if streamProvider, ok := provider.(pipepkg.StreamPipe); ok {
		if writer, streamErr := streamProvider.SendStreamMessage(incoming, ""); streamErr == nil && writer != nil {
			sender = newStreamPipeAnswerSender(writer)
		}
	}

	recorder := newPipeSSERecorder(sender)
	generateMessageAnswer(answerMessage.GetId(), recorder, host, lang, false, allowHighRiskTools, nil)

	answer, err := object.GetMessage(answerMessage.GetId())
	if err == nil && answer != nil && answer.Text != "" {
		_ = sender.CloseMessage(answer.Text)
		return
	}
	if answer != nil && answer.ErrorText != "" {
		_ = sender.CloseMessage(answer.ErrorText)
		return
	}
	_ = sender.CloseMessage("")
}

func newDefaultPipeAnswerSender(provider pipepkg.Pipe, incoming *pipepkg.IncomingMessage) *defaultPipeAnswerSender {
	return &defaultPipeAnswerSender{provider: provider, incoming: incoming}
}

func (s *defaultPipeAnswerSender) WriteMessage(text string) error {
	if text != "" {
		s.text = text
	}
	return nil
}

func (s *defaultPipeAnswerSender) WriteError(text string) error {
	if text != "" {
		s.errorText = text
	}
	return nil
}

func (s *defaultPipeAnswerSender) CloseMessage(text string) error {
	finalText := text
	if finalText == "" {
		switch {
		case s.text != "":
			finalText = s.text
		case s.errorText != "":
			finalText = s.errorText
		default:
			return nil
		}
	}
	if sender, ok := s.provider.(pipepkg.IncomingMessageSender); ok {
		return sender.SendIncomingMessage(s.incoming, finalText)
	}
	return s.provider.SendMessage(s.incoming.ChatId, finalText)
}

func newStreamPipeAnswerSender(writer pipepkg.PipeMessageWriter) *streamPipeAnswerSender {
	return &streamPipeAnswerSender{writer: writer}
}

func (s *streamPipeAnswerSender) WriteMessage(text string) error {
	if text == "" {
		return nil
	}
	s.text += text
	cleaned := s.text
	if idx := strings.Index(cleaned, "|||"); idx >= 0 {
		cleaned = strings.TrimSpace(cleaned[:idx])
	}
	if cleaned == "" {
		return nil
	}
	return s.writer.WriteMessage(cleaned)
}

func (s *streamPipeAnswerSender) WriteError(text string) error {
	if text != "" {
		s.errorText = text
	}
	return nil
}

func (s *streamPipeAnswerSender) CloseMessage(text string) error {
	finalText := text
	if finalText == "" {
		switch {
		case s.text != "":
			finalText = s.text
		case s.errorText != "":
			finalText = s.errorText
		default:
			finalText = "No response generated"
		}
	}
	if idx := strings.Index(finalText, "|||"); idx >= 0 {
		finalText = strings.TrimSpace(finalText[:idx])
	}
	return s.writer.CloseMessage(finalText)
}
