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
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

var discordApiBaseUrl = "https://discord.com/api/v10"

const (
	discordInteractionTypePing               = 1
	discordInteractionTypeApplicationCommand = 2

	discordInteractionResponseTypePong                       = 1
	discordInteractionResponseTypeDeferredChannelMessage     = 5
	discordApplicationCommandOptionTypeString            int = 3
)

type DiscordPipe struct {
	botToken     string
	publicKeyHex string
	httpClient   *http.Client
}

type discordUser struct {
	Id       string `json:"id"`
	Username string `json:"username"`
	Bot      bool   `json:"bot"`
}

type discordMember struct {
	User *discordUser `json:"user"`
}

type discordApplicationCommandOption struct {
	Name    string                            `json:"name"`
	Type    int                               `json:"type"`
	Value   interface{}                       `json:"value"`
	Options []discordApplicationCommandOption `json:"options"`
}

type discordApplicationCommandData struct {
	Name    string                            `json:"name"`
	Options []discordApplicationCommandOption `json:"options"`
}

type discordInteraction struct {
	Id            string                         `json:"id"`
	ApplicationId string                         `json:"application_id"`
	Type          int                            `json:"type"`
	ChannelId     string                         `json:"channel_id"`
	GuildId       string                         `json:"guild_id"`
	Token         string                         `json:"token"`
	Member        *discordMember                 `json:"member"`
	User          *discordUser                   `json:"user"`
	Data          *discordApplicationCommandData `json:"data"`
}

type discordGatewayEvent struct {
	Type string          `json:"t"`
	Data json.RawMessage `json:"d"`
}

type discordMessageCreate struct {
	Id        string       `json:"id"`
	ChannelId string       `json:"channel_id"`
	Content   string       `json:"content"`
	Author    *discordUser `json:"author"`
}

type discordWebhookResponse struct {
	Type int `json:"type"`
}

func NewDiscordPipe(botToken string, publicKeyHex string, httpClient *http.Client) (*DiscordPipe, error) {
	return &DiscordPipe{
		botToken:     botToken,
		publicKeyHex: strings.TrimSpace(publicKeyHex),
		httpClient:   httpClient,
	}, nil
}

func (p *DiscordPipe) authorizationHeaders() map[string]string {
	return map[string]string{
		"Authorization": fmt.Sprintf("Bot %s", p.botToken),
	}
}

func (p *DiscordPipe) SendMessage(chatId string, text string) error {
	payload := map[string]interface{}{
		"content": text,
	}
	_, err := doJSONRequest(
		p.httpClient,
		"Discord",
		http.MethodPost,
		fmt.Sprintf("%s/channels/%s/messages", discordApiBaseUrl, chatId),
		p.authorizationHeaders(),
		payload,
		http.StatusOK,
		http.StatusCreated,
	)
	return err
}

func (p *DiscordPipe) ParseWebhookRequest(body []byte) (*IncomingMessage, error) {
	var interaction discordInteraction
	if err := json.Unmarshal(body, &interaction); err != nil {
		return nil, err
	}
	if interaction.Type != 0 {
		return p.parseInteraction(interaction), nil
	}

	var event discordGatewayEvent
	if err := json.Unmarshal(body, &event); err == nil && event.Type == "MESSAGE_CREATE" {
		return p.parseGatewayMessageCreate(event.Data)
	}

	return nil, nil
}

func (p *DiscordPipe) parseInteraction(interaction discordInteraction) *IncomingMessage {
	if interaction.Type == discordInteractionTypePing {
		return nil
	}
	if interaction.Type != discordInteractionTypeApplicationCommand || interaction.ChannelId == "" {
		return nil
	}

	text := ""
	if interaction.Data != nil {
		text = buildDiscordCommandText(interaction.Data.Name, interaction.Data.Options)
	}
	if text == "" {
		return nil
	}

	user := interaction.User
	if user == nil && interaction.Member != nil {
		user = interaction.Member.User
	}
	userId := ""
	username := ""
	if user != nil {
		userId = user.Id
		username = user.Username
	}

	return &IncomingMessage{
		ChatId:   interaction.ChannelId,
		UserId:   userId,
		Text:     text,
		Username: username,
		Metadata: map[string]string{
			"interaction_token": interaction.Token,
			"application_id":    interaction.ApplicationId,
		},
	}
}

func (p *DiscordPipe) parseGatewayMessageCreate(body []byte) (*IncomingMessage, error) {
	var message discordMessageCreate
	if err := json.Unmarshal(body, &message); err != nil {
		return nil, err
	}
	if message.Content == "" || message.ChannelId == "" || (message.Author != nil && message.Author.Bot) {
		return nil, nil
	}

	userId := ""
	username := ""
	if message.Author != nil {
		userId = message.Author.Id
		username = message.Author.Username
	}

	return &IncomingMessage{
		ChatId:   message.ChannelId,
		UserId:   userId,
		Text:     message.Content,
		Username: username,
	}, nil
}

func buildDiscordCommandText(commandName string, options []discordApplicationCommandOption) string {
	values := []string{}
	for _, option := range options {
		values = append(values, flattenDiscordCommandOption(option)...)
	}
	if len(values) > 0 {
		return strings.Join(values, " ")
	}
	return commandName
}

func flattenDiscordCommandOption(option discordApplicationCommandOption) []string {
	values := []string{}
	if len(option.Options) > 0 {
		for _, child := range option.Options {
			values = append(values, flattenDiscordCommandOption(child)...)
		}
		return values
	}

	if option.Type == discordApplicationCommandOptionTypeString {
		if value, ok := option.Value.(string); ok && value != "" {
			return []string{value}
		}
	}

	return values
}

func (p *DiscordPipe) GetWebhookResponse(body []byte, header http.Header) (*WebhookResponse, error) {
	if err := p.verifyWebhookSignature(body, header); err != nil {
		return nil, err
	}

	var interaction discordInteraction
	if err := json.Unmarshal(body, &interaction); err != nil {
		return nil, err
	}

	responseType := 0
	if interaction.Type == discordInteractionTypePing {
		responseType = discordInteractionResponseTypePong
	} else if interaction.Type == discordInteractionTypeApplicationCommand {
		responseType = discordInteractionResponseTypeDeferredChannelMessage
	}
	if responseType == 0 {
		return nil, nil
	}

	responseBody, err := json.Marshal(discordWebhookResponse{Type: responseType})
	if err != nil {
		return nil, err
	}
	return &WebhookResponse{
		StatusCode:  http.StatusOK,
		ContentType: "application/json",
		Body:        responseBody,
	}, nil
}

func (p *DiscordPipe) verifyWebhookSignature(body []byte, header http.Header) error {
	if p.publicKeyHex == "" {
		return nil
	}

	signatureHex := header.Get("X-Signature-Ed25519")
	timestamp := header.Get("X-Signature-Timestamp")
	if signatureHex == "" || timestamp == "" {
		return fmt.Errorf("missing Discord signature headers")
	}

	publicKey, err := hex.DecodeString(p.publicKeyHex)
	if err != nil {
		return fmt.Errorf("invalid Discord public key: %w", err)
	}
	if len(publicKey) != ed25519.PublicKeySize {
		return fmt.Errorf("invalid Discord public key length: %d", len(publicKey))
	}

	signature, err := hex.DecodeString(signatureHex)
	if err != nil {
		return fmt.Errorf("invalid Discord signature: %w", err)
	}
	if len(signature) != ed25519.SignatureSize {
		return fmt.Errorf("invalid Discord signature length: %d", len(signature))
	}

	message := append([]byte(timestamp), body...)
	if !ed25519.Verify(publicKey, message, signature) {
		return fmt.Errorf("invalid Discord signature")
	}

	return nil
}

type discordSentMessage struct {
	Id        string `json:"id"`
	ChannelId string `json:"channel_id"`
}

type discordMessageWriter struct {
	pipe             *DiscordPipe
	channelId        string
	messageId        string
	applicationId    string
	interactionToken string
	lastText         string
}

func (w *discordMessageWriter) editText(text string) error {
	if text == w.lastText {
		return nil
	}
	payload := map[string]interface{}{
		"content": text,
	}
	var url string
	if w.interactionToken != "" {
		url = fmt.Sprintf("%s/webhooks/%s/%s/messages/@original", discordApiBaseUrl, w.applicationId, w.interactionToken)
	} else {
		url = fmt.Sprintf("%s/channels/%s/messages/%s", discordApiBaseUrl, w.channelId, w.messageId)
	}
	_, err := doJSONRequest(
		w.pipe.httpClient,
		"Discord",
		http.MethodPatch,
		url,
		w.pipe.authorizationHeaders(),
		payload,
		http.StatusOK,
	)
	if err == nil {
		w.lastText = text
	}
	return err
}

func (w *discordMessageWriter) WriteMessage(text string) error {
	return w.editText(text)
}

func (w *discordMessageWriter) CloseMessage(text string) error {
	return w.editText(text)
}

func (p *DiscordPipe) SendStreamMessage(incoming *IncomingMessage, text string) (PipeMessageWriter, error) {
	initialText := text
	if initialText == "" {
		initialText = "..."
	}

	// Deferred interaction: edit the original response instead of creating a new message
	if token := incoming.Metadata["interaction_token"]; token != "" {
		appID := incoming.Metadata["application_id"]
		payload := map[string]interface{}{
			"content": initialText,
		}
		_, err := doJSONRequest(
			p.httpClient,
			"Discord",
			http.MethodPatch,
			fmt.Sprintf("%s/webhooks/%s/%s/messages/@original", discordApiBaseUrl, appID, token),
			p.authorizationHeaders(),
			payload,
			http.StatusOK,
		)
		if err != nil {
			return nil, err
		}
		return &discordMessageWriter{
			pipe:             p,
			applicationId:    appID,
			interactionToken: token,
			lastText:         initialText,
		}, nil
	}

	// Gateway message: create a new channel message
	payload := map[string]interface{}{
		"content": initialText,
	}
	respBody, err := doJSONRequest(
		p.httpClient,
		"Discord",
		http.MethodPost,
		fmt.Sprintf("%s/channels/%s/messages", discordApiBaseUrl, incoming.ChatId),
		p.authorizationHeaders(),
		payload,
		http.StatusOK,
		http.StatusCreated,
	)
	if err != nil {
		return nil, err
	}

	var sent discordSentMessage
	if err := json.Unmarshal(respBody, &sent); err != nil {
		return nil, err
	}
	if sent.Id == "" {
		return nil, fmt.Errorf("Discord: sendMessage returned no message ID")
	}

	return &discordMessageWriter{
		pipe:      p,
		channelId: incoming.ChatId,
		messageId: sent.Id,
		lastText:  initialText,
	}, nil
}

func (p *DiscordPipe) SetWebhook(webhookUrl string) error {
	payload := map[string]interface{}{
		"interactions_endpoint_url": webhookUrl,
	}
	_, err := doJSONRequest(
		p.httpClient,
		"Discord",
		http.MethodPatch,
		fmt.Sprintf("%s/applications/@me", discordApiBaseUrl),
		p.authorizationHeaders(),
		payload,
		http.StatusOK,
	)
	return err
}
