// Copyright 2023 The OpenAgent Authors. All Rights Reserved.
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
	"encoding/gob"
	"encoding/json"
	"strings"
	"time"

	"github.com/beego/beego"
	"github.com/beego/beego/logs"
	"github.com/the-open-agent/openagent/auth"
	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
)

type ApiController struct {
	beego.Controller
}

func init() {
	gob.Register(auth.Claims{})
}

func GetUserName(user *auth.User) string {
	if user == nil {
		return ""
	}

	return user.Name
}

func (c *ApiController) GetSessionClaims() *auth.Claims {
	s := c.GetSession("user")
	if s == nil {
		return nil
	}

	claims := s.(auth.Claims)
	return &claims
}

func (c *ApiController) SetSessionClaims(claims *auth.Claims) {
	if claims == nil {
		c.DelSession("user")
		return
	}

	c.SetSession("user", *claims)
}

// startUserSession gives the signed-in user a fresh session ID and binds the session to the browser.
func (c *ApiController) startUserSession(claims *auth.Claims) error {
	if err := c.SessionRegenerateID(); err != nil {
		return err
	}
	c.SetSessionClaims(claims)
	c.SetSession("userAgent", c.Ctx.Request.UserAgent())
	return nil
}

func (c *ApiController) GetSessionUser() *auth.User {
	claims := c.GetSessionClaims()
	if claims == nil {
		return nil
	}

	return &claims.User
}

func (c *ApiController) SetSessionUser(user *auth.User) {
	if user == nil {
		c.DelSession("user")
		return
	}

	claims := c.GetSessionClaims()
	if claims != nil {
		claims.User = *user
		c.SetSessionClaims(claims)
	}
}

func (c *ApiController) GetSessionUsername() string {
	user := c.GetSessionUser()
	if user == nil {
		return ""
	}

	return GetUserName(user)
}

// defaultStoreOwner returns the store owner used to pick a default store for the current session.
// Store-level admins use their own stores; everyone else uses the built-in "admin" namespace.
func (c *ApiController) defaultStoreOwner() string {
	if c.IsStoreAdmin() {
		return c.GetSessionUsername()
	}
	return "admin"
}

// EnforceStoreIsolation enforces store isolation based on user's Homepage field.
// Returns the enforced store name and true if isolation check passes, or empty string and false if access denied.
func (c *ApiController) EnforceStoreIsolation(requestedStoreName string) (string, bool) {
	user := c.GetSessionUser()
	if user == nil || user.Homepage == "" {
		// No user or no Homepage binding, no isolation
		return requestedStoreName, true
	}

	// User is bound to a specific store via Homepage
	if requestedStoreName == "" || requestedStoreName == "All" {
		// Force the store to be their bound store
		return user.Homepage, true
	} else if requestedStoreName != user.Homepage {
		// User is trying to access a different store, deny access
		c.ResponseError(c.T("controllers:You can only access data from your assigned store"))
		return "", false
	}

	return requestedStoreName, true
}

// FilterStoresByHomepage filters stores based on user's Homepage field.
func FilterStoresByHomepage(stores []*object.Store, user *auth.User) []*object.Store {
	if user == nil || user.Homepage == "" {
		// No Homepage binding, return all stores
		return stores
	}

	// Check if Homepage matches any store name
	var filteredStores []*object.Store
	for _, store := range stores {
		if store.Name == user.Homepage {
			filteredStores = append(filteredStores, store)
			break
		}
	}

	// If Homepage matches a store, only return that store
	if len(filteredStores) > 0 {
		return filteredStores
	}

	// If Homepage doesn't match any store, return all stores (no isolation)
	return stores
}

// getStoreNamesForUser returns names of all stores owned by the given user.
func getStoreNamesForUser(username string) ([]string, error) {
	stores, err := object.GetStores(username)
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(stores))
	for _, s := range stores {
		names = append(names, s.Name)
	}
	return names, nil
}

// narrowStoreAdminStoreNames applies optional ?store= filter for store-level admins.
// If requestedStore is empty, returns allowed unchanged. If non-empty, returns that store
// only when it exists in allowed; otherwise ok is false.
// canAccessUserData reports whether the session user may access data that user created in store.
// Regular users only reach their own data and the global admin reaches everything, while a store
// admin reaches their own data plus the data in the stores they own.
func (c *ApiController) canAccessUserData(user string, store string) bool {
	if c.IsGlobalAdmin() {
		return true
	}
	username := c.GetSessionUsername()
	// Without a session the username is empty, which must not match data whose user is empty.
	if username == "" {
		return false
	}
	if username == user {
		return true
	}
	if !c.IsStoreAdmin() || store == "" {
		return false
	}

	storeNames, err := getStoreNamesForUser(username)
	if err != nil {
		return false
	}
	for _, name := range storeNames {
		if name == store {
			return true
		}
	}
	return false
}

func (c *ApiController) requireUserDataAccess(user string, store string) bool {
	if !c.canAccessUserData(user, store) {
		c.ResponseError(c.T("auth:Unauthorized operation"))
		return false
	}
	return true
}

// filterStoreAdminChats limits a store admin to their own chats and the chats in stores they own.
func (c *ApiController) filterStoreAdminChats(chats []*object.Chat) ([]*object.Chat, error) {
	if c.IsGlobalAdmin() || !c.IsStoreAdmin() {
		return chats, nil
	}

	username := c.GetSessionUsername()
	storeNames, err := getStoreNamesForUser(username)
	if err != nil {
		return nil, err
	}
	res := []*object.Chat{}
	for _, chat := range chats {
		if chat.User == username || util.InSlice(storeNames, chat.Store) {
			res = append(res, chat)
		}
	}
	return res, nil
}

// filterStoreAdminMessages limits a store admin to their own messages and the messages in stores they own.
func (c *ApiController) filterStoreAdminMessages(messages []*object.Message) ([]*object.Message, error) {
	if c.IsGlobalAdmin() || !c.IsStoreAdmin() {
		return messages, nil
	}

	username := c.GetSessionUsername()
	storeNames, err := getStoreNamesForUser(username)
	if err != nil {
		return nil, err
	}
	res := []*object.Message{}
	for _, message := range messages {
		if message.User == username || util.InSlice(storeNames, message.Store) {
			res = append(res, message)
		}
	}
	return res, nil
}

func narrowStoreAdminStoreNames(allowed []string, requestedStore string) ([]string, bool) {
	if requestedStore == "" {
		return allowed, true
	}
	for _, n := range allowed {
		if n == requestedStore {
			return []string{requestedStore}, true
		}
	}
	return nil, false
}

func wrapActionResponse(affected bool, e ...error) *Response {
	if len(e) != 0 && e[0] != nil {
		return &Response{Status: "error", Msg: e[0].Error()}
	} else if affected {
		return &Response{Status: "ok", Msg: "", Data: "Affected"}
	} else {
		return &Response{Status: "ok", Msg: "", Data: "Unaffected"}
	}
}

func wrapActionResponse2(affected bool, data interface{}, e ...error) *Response {
	if len(e) != 0 && e[0] != nil {
		return &Response{Status: "error", Msg: e[0].Error()}
	} else if affected {
		return &Response{Status: "ok", Msg: "", Data: "Affected", Data2: data}
	} else {
		return &Response{Status: "ok", Msg: "", Data: "Unaffected", Data2: data}
	}
}

func (c *ApiController) Finish() {
	if strings.HasPrefix(c.Ctx.Input.URL(), "/api") {
		startTime := c.Ctx.Input.GetData("startTime")
		if startTime != nil {
			latency := time.Since(startTime.(time.Time)).Milliseconds()
			object.ApiLatency.WithLabelValues(c.Ctx.Input.URL(), c.Ctx.Input.Method()).Observe(float64(latency))
		}
	}
	c.errorLogFilter()
	c.Controller.Finish()
}

func (c *ApiController) errorLogFilter() {
	if v, ok := c.Data["json"]; ok {
		var status string
		switch r := v.(type) {
		case Response:
			status = r.Status
		case *Response:
			if r != nil {
				status = r.Status
			}
		default:
			status = ""
		}
		if status == "error" {
			method := c.Ctx.Input.Method()
			path := c.Ctx.Input.URL()
			query := ""
			if c.Ctx.Request != nil && c.Ctx.Request.URL != nil {
				query = util.RedactSensitiveUrl("?" + c.Ctx.Request.URL.RawQuery)[1:]
			}
			body := util.RedactSensitiveJson(string(c.Ctx.Input.RequestBody))
			if len(body) > 4096 {
				body = body[:4096] + "...(truncated)"
			}
			// Never write credentials to the log; only record whether one was sent.
			token := ""
			if c.Ctx.Request.Header.Get("Authorization") != "" {
				token = "<redacted>"
			}
			respJSON, _ := json.Marshal(v)
			respStr := string(respJSON)
			if len(respStr) > 4096 {
				respStr = respStr[:4096] + "...(truncated)"
			}
			logs.Error("API error: method=%s path=%s query=%s token=%s body=%s response=%s", method, path, query, token, body, respStr)
		}
	}
}
