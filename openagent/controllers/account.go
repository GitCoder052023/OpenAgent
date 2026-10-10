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
	_ "embed"
	"fmt"
	"strings"
	"time"

	"github.com/beego/beego"
	"github.com/the-open-agent/openagent/auth"
	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
)

func init() {
	InitAuthConfig()
}

func tryInitAuthConfig() error {
	issuer := conf.GetIssuer()
	clientId := conf.GetConfigString("clientId")
	clientSecret := conf.GetConfigString("clientSecret")
	casdoorOrganization := conf.GetConfigString("casdoorOrganization") // casdoor backward compat
	casdoorApplication := conf.GetConfigString("casdoorApplication")   // casdoor backward compat

	auth.InitConfig(issuer, clientId, clientSecret, "", casdoorOrganization, casdoorApplication)

	application, err := auth.GetApplication(casdoorApplication)
	if err != nil {
		return err
	}
	if application == nil {
		return fmt.Errorf("the application %q does not exist", casdoorApplication)
	}

	cert, err := auth.GetCert(application.Cert)
	if err != nil {
		return err
	}
	if cert == nil {
		return fmt.Errorf("the cert %q does not exist", application.Cert)
	}

	auth.InitConfig(issuer, clientId, clientSecret, cert.Certificate, casdoorOrganization, casdoorApplication)
	conf.SetCasdoorAvailable(true)
	return nil
}

func InitAuthConfig() {
	issuer := conf.GetIssuer()
	if issuer == "" {
		conf.SetCasdoorAvailable(false)
		return
	}

	if err := tryInitAuthConfig(); err != nil {
		conf.SetCasdoorAvailable(false)
		beego.Warning("InitAuthConfig: casdoor unreachable, will retry in background:", err)
		go func() {
			for {
				time.Sleep(10 * time.Second)
				if err := tryInitAuthConfig(); err != nil {
					conf.SetCasdoorAvailable(false)
					beego.Warning("InitAuthConfig: retry failed:", err)
				} else {
					beego.Info("InitAuthConfig: casdoor connected successfully")
					return
				}
			}
		}()
	}
}

// Signin
// @Title Signin
// @Tag Account API
// @Description sign in with Casdoor OAuth code or password
// @Param code  query string false "code of account"
// @Param state query string false "state of account"
// @Success 200 {casdoorsdk} auth.Claims The Response object
// @router /signin [post]
func (c *ApiController) Signin() {
	code := c.Input().Get("code")
	state := c.Input().Get("state")
	if code == "" && state == "" {
		c.signinWithPassword()
		return
	}

	token, err := auth.GetOAuthToken(code, state)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	claims, err := auth.ParseJwtToken(token.AccessToken)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	if strings.Count(claims.Type, "-") <= 1 {
		if !util.IsAdmin(&claims.User) {
			claims.Type = "chat-user"
		}
	}

	err = c.addInitialChatAndMessage(&claims.User)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	claims.AccessToken = token.AccessToken
	if err = c.startUserSession(claims); err != nil {
		c.ResponseError(err.Error())
		return
	}
	userId := claims.User.Owner + "/" + claims.User.Name
	c.Ctx.Input.SetParam("recordUserId", userId)

	// Record session ID
	sessionId := c.Ctx.Input.CruSession.SessionID()
	if sessionId != "" && userId != "" {
		session := &object.Session{
			Owner:     claims.User.Owner,
			Name:      claims.User.Name,
			SessionId: []string{sessionId},
		}

		object.AddSession(session)
	}

	c.ResponseOk(getSanitizedClaims(claims))
}

// Signout
// @Title Signout
// @Tag Account API
// @Description sign out
// @Success 200 {object} controllers.Response The Response object
// @router /signout [post]
func (c *ApiController) Signout() {
	user := c.GetSessionUser()
	if user != nil {
		_, err := object.DeleteSessionId(util.GetIdFromOwnerAndName(user.Owner, user.Name), c.Ctx.Input.CruSession.SessionID())
		if err != nil {
			c.ResponseError(err.Error())
			return
		}
	}

	c.SetSessionClaims(nil)

	c.ResponseOk()
}

func (c *ApiController) addInitialChat(organization string, userName string, storeName string, modelProvider string) (*object.Chat, error) {
	var store *object.Store
	var err error

	if storeName != "" {
		store, err = object.ResolveStoreByOwnerAndName("admin", storeName)
		if err != nil {
			return nil, err
		}
		if store == nil {
			return nil, fmt.Errorf(c.T("account:The store: %s is not found"), storeName)
		}
	} else {
		store, err = object.GetDefaultStore(c.defaultStoreOwner())
		if err != nil {
			return nil, err
		}
		if store == nil {
			return nil, nil
		}
	}

	if modelProvider == "" {
		modelProvider = store.ModelProvider
	}

	currentTime := util.GetCurrentTime()
	chat := &object.Chat{
		Owner:         "admin",
		Name:          fmt.Sprintf("chat_%s", util.GetRandomName()),
		CreatedTime:   currentTime,
		UpdatedTime:   currentTime,
		Organization:  organization,
		DisplayName:   "New Chat",
		Store:         store.Name,
		ModelProvider: modelProvider,
		Category:      "Default Category",
		User:          userName,
		ClientIp:      c.getClientIp(),
		UserAgent:     c.getUserAgent(),
		MessageCount:  0,
		NeedTitle:     true,
	}

	if store.Welcome != "Hello" {
		chat.DisplayName = "新会话"
		chat.Category = "默认分类"
	}

	chat.ClientIpDesc = util.GetDescFromIP(chat.ClientIp)
	chat.UserAgentDesc = util.GetDescFromUserAgent(chat.UserAgent)

	_, err = object.AddChat(chat)
	if err != nil {
		return nil, err
	}

	return chat, nil
}

func (c *ApiController) addInitialChatAndMessage(user *auth.User) error {
	chats, err := object.GetChats("admin", "", user.Name)
	if err != nil {
		return err
	}

	if len(chats) != 0 {
		return nil
	}

	organizationName := user.Owner
	userName := user.Name

	chat, err := c.addInitialChat(organizationName, userName, "", "")
	if err != nil {
		return err
	}
	if chat == nil {
		return nil
	}

	store, err := object.ResolveStoreByOwnerAndName("admin", chat.Store)
	if err != nil {
		return err
	}
	if store == nil {
		return fmt.Errorf(c.T("account:The store: %s is not found"), chat.Store)
	}

	userMessage := &object.Message{
		Owner:        "admin",
		Name:         fmt.Sprintf("message_%s", util.GetRandomName()),
		CreatedTime:  util.AdjustTimeFromSecToMilli(chat.CreatedTime, -100),
		Organization: chat.Organization,
		Store:        chat.Store,
		User:         userName,
		Chat:         chat.Name,
		ReplyTo:      "",
		Author:       userName,
		Text:         store.Welcome,
		IsHidden:     true,
		VectorScores: []object.VectorScore{},
	}
	_, err = object.AddMessage(userMessage)
	if err != nil {
		return err
	}

	answerMessage := &object.Message{
		Owner:        "admin",
		Name:         fmt.Sprintf("message_%s", util.GetRandomName()),
		CreatedTime:  util.GetCurrentTimeEx(chat.CreatedTime),
		Organization: chat.Organization,
		Store:        chat.Store,
		User:         userName,
		Chat:         chat.Name,
		ReplyTo:      "Welcome",
		Author:       "AI",
		Text:         "",
		VectorScores: []object.VectorScore{},
	}
	_, err = object.AddMessage(answerMessage)
	return err
}

func (c *ApiController) isSafePassword() (bool, error) {
	claims := c.GetSessionClaims()
	if claims == nil {
		return true, nil
	}

	if len(claims.User.Id) != 11 || !strings.HasPrefix(claims.User.Id, "270") {
		return true, nil
	}

	// Use the user data from claims which has been updated with fresh data from Casdoor in GetAccount()
	if claims.User.Password == "#NeedToModify#" {
		return false, nil
	} else {
		return true, nil
	}
}

// autoLoginAdmin automatically signs in the admin user when the default password is still in use.
// Returns true if the session was established successfully, false if an error occurred (response already written).
func (c *ApiController) autoLoginAdmin() bool {
	accountUser, ok, err := object.VerifyUser("admin", "123")
	if err != nil {
		c.ResponseError(err.Error())
		return false
	}
	if !ok {
		c.ResponseError(c.T("auth:Please sign in first"))
		return false
	}

	user := accountUser.ToCasdoorUser()
	claims := &auth.Claims{
		User:         user,
		SigninMethod: "Sign In",
	}

	if err = c.addInitialChatAndMessage(&claims.User); err != nil {
		c.ResponseError(err.Error())
		return false
	}

	if err = c.startUserSession(claims); err != nil {
		c.ResponseError(err.Error())
		return false
	}
	userId := util.GetIdFromOwnerAndName(claims.User.Owner, claims.User.Name)

	sessionId := c.Ctx.Input.CruSession.SessionID()
	if sessionId != "" && userId != "" {
		object.AddSession(&object.Session{
			Owner:     claims.User.Owner,
			Name:      claims.User.Name,
			SessionId: []string{sessionId},
		})
	}

	return true
}

// GetAccount
// @Title GetAccount
// @Tag Account API
// @Description get account
// @Success 200 {casdoorsdk} auth.Claims The Response object
// @router /get-account [get]
func (c *ApiController) GetAccount() {
	err := util.AppendWebConfigCookie(c.Ctx)
	if err != nil {
		fmt.Println(err)
	}

	if object.IsSigninEnabled() {
		if c.GetSessionUsername() == "" {
			fromPath := c.GetString("fromPath")
			// Auto sign-in with the default admin password is only allowed for requests made
			// directly from the local machine, never for remote visitors.
			if fromPath != "/signin" && util.IsLoopbackRequest(c.Ctx.Request) && object.IsAdminUsingDefaultPassword() {
				if !c.autoLoginAdmin() {
					return
				}
			} else {
				c.ResponseError(c.T("auth:Please sign in first"))
				return
			}
		}
	} else {
		_, ok := c.RequireSignedIn()
		if !ok {
			return
		}
	}

	claims := c.GetSessionClaims()

	// Fetch fresh user data from Casdoor in real-time for non-anonymous users
	if conf.IsCasdoorAvailable() && claims.User.Type != "anonymous-user" && claims.User.Owner != object.UserOwner {
		user, err := auth.GetUser(claims.User.Name)
		if err != nil {
			c.ResponseError(err.Error())
			return
		}

		if user != nil {
			// Update the session with fresh user data from Casdoor
			// Only update the User field, preserving all other claims fields (AccessToken, Type, IsAdmin, etc.)
			claims.User = *user
			c.SetSessionClaims(claims)
		}
	}

	isSafePassword, err := c.isSafePassword()
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	res := getSanitizedClaims(claims)
	if !isSafePassword {
		res.User.Password = "#NeedToModify#"
	}

	c.ResponseOk(res)
}

func getSanitizedClaims(claims *auth.Claims) *auth.Claims {
	if claims == nil {
		return nil
	}

	res := *claims
	res.AccessToken = ""
	res.User = getSanitizedUser(claims.User)
	return &res
}

func getSanitizedUser(user auth.User) auth.User {
	if user.Password != "#NeedToModify#" {
		user.Password = ""
	}
	user.PasswordSalt = ""
	user.PasswordType = ""
	user.Hash = ""
	user.PreHash = ""
	user.AccessKey = ""
	user.AccessSecret = ""
	user.AccessToken = ""
	user.OriginalToken = ""
	user.OriginalRefreshToken = ""
	user.TotpSecret = ""
	user.RecoveryCodes = nil
	user.MfaAccounts = nil
	user.Phone = util.MaskPhone(user.Phone)
	user.IdCard = util.MaskIdCard(user.IdCard)
	return user
}
