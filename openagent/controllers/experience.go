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
	"encoding/json"
	"fmt"
	"strings"

	"github.com/beego/beego/logs"
	"github.com/beego/beego/utils/pagination"
	"github.com/the-open-agent/openagent/object"
	"github.com/the-open-agent/openagent/util"
)

// GetGlobalExperiences
// @Title GetGlobalExperiences
// @Tag Experience API
// @Description get global experiences
// @Success 200 {array} object.Experience The Response object
// @router /get-global-experiences [get]
func (c *ApiController) GetGlobalExperiences() {
	if !c.RequireAdmin() {
		return
	}

	experiences, err := object.GetGlobalExperiences()
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(object.GetMaskedExperiences(experiences))
}

// GetExperiences
// @Title GetExperiences
// @Tag Experience API
// @Description get experiences
// @Param store query string false "The store of experience"
// @Success 200 {array} object.Experience The Response object
// @router /get-experiences [get]
func (c *ApiController) GetExperiences() {
	owner := "admin"
	storeName := c.Input().Get("store")
	limit := c.Input().Get("pageSize")
	page := c.Input().Get("p")
	field := c.Input().Get("field")
	value := c.Input().Get("value")
	sortField := c.Input().Get("sortField")
	sortOrder := c.Input().Get("sortOrder")

	if limit == "" || page == "" {
		if !c.RequireAdmin() {
			return
		}

		experiences, err := object.GetExperiences(owner)
		if err != nil {
			c.ResponseError(err.Error())
			return
		}
		c.ResponseOk(object.GetMaskedExperiences(experiences))
	} else {
		if !c.RequireAdmin() {
			return
		}

		limit := util.ParseInt(limit)
		count, err := object.GetExperienceCount(owner, storeName, field, value)
		if err != nil {
			c.ResponseError(err.Error())
			return
		}

		paginator := pagination.SetPaginator(c.Ctx, limit, count)
		experiences, err := object.GetPaginationExperiences(owner, storeName, paginator.Offset(), limit, field, value, sortField, sortOrder)
		if err != nil {
			c.ResponseError(err.Error())
			return
		}

		c.ResponseOk(object.GetMaskedExperiences(experiences), paginator.Nums())
	}
}

// GetExperience
// @Title GetExperience
// @Tag Experience API
// @Description get experience
// @Param id query string true "The id (owner/name) of the experience"
// @Success 200 {object} object.Experience The Response object
// @router /get-experience [get]
func (c *ApiController) GetExperience() {
	id := c.Input().Get("id")

	experience, err := object.GetExperience(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(object.GetMaskedExperience(experience))
}

// GetMessageExperience
// @Title GetMessageExperience
// @Tag Experience API
// @Description get the correction attached to an AI message, if any
// @Param message query string true "The name of the corrected message"
// @Success 200 {object} object.Experience The Response object
// @router /get-message-experience [get]
func (c *ApiController) GetMessageExperience() {
	if _, ok := c.RequireSignedIn(); !ok {
		return
	}

	messageName := c.Input().Get("message")

	experience, err := object.GetExperienceByMessage("admin", messageName)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	c.ResponseOk(object.GetMaskedExperience(experience))
}

// AddExperience
// @Title AddExperience
// @Tag Experience API
// @Description save a human correction of an AI answer into the experience library
// @Param body body object.Experience true "The details of the experience"
// @Success 200 {object} object.Experience The Response object
// @router /add-experience [post]
func (c *ApiController) AddExperience() {
	userName, ok := c.RequireSignedIn()
	if !ok {
		return
	}

	var experience object.Experience
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &experience)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	// A correction of a real answer must actually carry one. A hand-written standing
	// rule has no message behind it, and is allowed to start as an empty draft.
	if experience.Message != "" && strings.TrimSpace(experience.CorrectedText) == "" {
		c.ResponseError(c.T("experience:The corrected answer should not be empty"))
		return
	}

	experience.Owner = "admin"
	experience.User = userName
	experience.HitCount = 0

	message, err := c.resolveExperienceMessage(&experience)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	if experience.Message != "" && strings.TrimSpace(experience.Question) == "" {
		c.ResponseError(c.T("experience:The question should not be empty"))
		return
	}

	isCurator, err := c.isExperienceCurator(experience.Store)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if isCurator {
		experience.State = object.ExperienceStateActive
	} else {
		// Corrections from ordinary users wait for review so a shared agent's
		// experience library cannot be poisoned by a single chat.
		experience.State = object.ExperienceStateDraft
		experience.IsGlobalRule = false
	}

	// A missing embedding provider only costs similarity retrieval; the correction is
	// still worth storing, and still applies if it is promoted to a standing rule.
	if err = object.FillExperienceEmbedding(&experience, c.GetAcceptLanguage()); err != nil {
		logs.Warn("AddExperience() embedding failed: %s", err.Error())
	}

	affected, err := object.AddExperience(&experience)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if !affected {
		c.ResponseError(c.T("experience:Failed to save the experience"))
		return
	}

	if message != nil {
		if _, err = object.UpdateMessageCorrectedText(message.Owner, message.Name, experience.CorrectedText); err != nil {
			c.ResponseError(err.Error())
			return
		}
	}

	c.ResponseOk(object.GetMaskedExperience(&experience))
}

// UpdateExperience
// @Title UpdateExperience
// @Tag Experience API
// @Description update experience
// @Param id query string true "The id (owner/name) of the experience"
// @Param body body object.Experience true "The details of the experience"
// @Success 200 {object} controllers.Response The Response object
// @router /update-experience [post]
func (c *ApiController) UpdateExperience() {
	id := c.Input().Get("id")

	var experience object.Experience
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &experience)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	experienceDb, err := object.GetExperience(id)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if experienceDb == nil {
		c.ResponseError(c.T("experience:The experience is not found"))
		return
	}

	if !c.canMutateExperience(experienceDb) {
		return
	}

	// The stored vector describes the old question; without this the edited row would
	// silently stop matching anything.
	if experience.Question != experienceDb.Question && strings.TrimSpace(experience.Question) != "" {
		if err = object.FillExperienceEmbedding(&experience, c.GetAcceptLanguage()); err != nil {
			logs.Warn("UpdateExperience() embedding failed: %s", err.Error())
		}
	}

	success, err := object.UpdateExperience(id, &experience)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	if success && experienceDb.Message != "" && experience.CorrectedText != experienceDb.CorrectedText {
		if err = syncMessageCorrectedText(experienceDb.Owner, experienceDb.Message, experience.CorrectedText); err != nil {
			c.ResponseError(err.Error())
			return
		}
	}

	c.ResponseOk(success)
}

// DeleteExperience
// @Title DeleteExperience
// @Tag Experience API
// @Description delete experience and revert the message it corrected
// @Param body body object.Experience true "The details of the experience"
// @Success 200 {object} controllers.Response The Response object
// @router /delete-experience [post]
func (c *ApiController) DeleteExperience() {
	var experience object.Experience
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &experience)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	experienceDb, err := object.GetExperience(util.GetId(experience.Owner, experience.Name))
	if err != nil {
		c.ResponseError(err.Error())
		return
	}
	if experienceDb == nil {
		c.ResponseError(c.T("experience:The experience is not found"))
		return
	}

	if !c.canMutateExperience(experienceDb) {
		return
	}

	success, err := object.DeleteExperience(experienceDb)
	if err != nil {
		c.ResponseError(err.Error())
		return
	}

	// Reverting the correction restores the model's original answer everywhere,
	// including the history fed back into later turns.
	if success && experienceDb.Message != "" {
		if err = syncMessageCorrectedText(experienceDb.Owner, experienceDb.Message, ""); err != nil {
			c.ResponseError(err.Error())
			return
		}
	}

	c.ResponseOk(success)
}

// resolveExperienceMessage fills the question and the original answer from the corrected
// message, so the caller cannot claim the agent said something it never said.
func (c *ApiController) resolveExperienceMessage(experience *object.Experience) (*object.Message, error) {
	if experience.Message == "" {
		return nil, nil
	}

	message, err := object.GetMessage(util.GetId(experience.Owner, experience.Message))
	if err != nil {
		return nil, err
	}
	if message == nil {
		return nil, fmt.Errorf(c.T("experience:The message is not found"))
	}
	if message.Author != "AI" {
		return nil, fmt.Errorf(c.T("experience:Only an AI answer can be corrected"))
	}

	experience.Chat = message.Chat
	experience.Store = message.Store
	experience.OriginalText = message.Text

	if strings.TrimSpace(experience.Question) == "" && message.ReplyTo != "" && message.ReplyTo != "Welcome" {
		questionMessage, err := object.GetMessage(util.GetId(experience.Owner, message.ReplyTo))
		if err != nil {
			return nil, err
		}
		if questionMessage != nil {
			experience.Question = questionMessage.Text
		}
	}

	return message, nil
}

// isExperienceCurator reports whether the signed-in user may publish corrections for a
// store directly, instead of queuing them for review.
func (c *ApiController) isExperienceCurator(storeName string) (bool, error) {
	if c.IsAdmin() {
		return true, nil
	}
	if storeName == "" {
		return false, nil
	}

	store, err := object.GetStore(util.GetId("admin", storeName))
	if err != nil {
		return false, err
	}
	if store == nil {
		return false, nil
	}

	userName := c.GetSessionUsername()
	for _, owner := range store.Owners {
		if owner == userName {
			return true, nil
		}
	}
	return false, nil
}

func (c *ApiController) canMutateExperience(experience *object.Experience) bool {
	if c.IsAdmin() {
		return true
	}

	isCurator, err := c.isExperienceCurator(experience.Store)
	if err != nil {
		c.ResponseError(err.Error())
		return false
	}
	if isCurator {
		return true
	}

	return c.IsCurrentUser(experience.User)
}

func syncMessageCorrectedText(owner string, messageName string, correctedText string) error {
	_, err := object.UpdateMessageCorrectedText(owner, messageName, correctedText)
	return err
}
