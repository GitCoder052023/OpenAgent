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

package object

import (
	"fmt"

	"github.com/the-open-agent/openagent/auth"
	"github.com/the-open-agent/openagent/i18n"
	"github.com/the-open-agent/openagent/pipe"
	"github.com/the-open-agent/openagent/util"
	"xorm.io/core"
)

type Pipe struct {
	Owner       string `xorm:"varchar(100) notnull pk" json:"owner"`
	Name        string `xorm:"varchar(100) notnull pk" json:"name"`
	CreatedTime string `xorm:"varchar(100)" json:"createdTime"`

	DisplayName string `xorm:"varchar(100)" json:"displayName"`
	Type        string `xorm:"varchar(100)" json:"type"`
	Token       string `xorm:"varchar(2000)" json:"token"`
	SecretKey   string `xorm:"varchar(100) 'provider_key'" json:"secretKey"`
	Store       string `xorm:"varchar(100)" json:"store"`
	Domain      string `xorm:"varchar(200)" json:"domain"`

	IsDefault bool   `json:"isDefault"`
	State     string `xorm:"varchar(100)" json:"state"`

	ChatId          string `xorm:"varchar(200)" json:"chatId"`
	ChatTestMessage string `xorm:"varchar(1000)" json:"chatTestMessage"`
}

func GetMaskedPipe(pipe *Pipe, isMaskEnabled bool, user *auth.User) *Pipe {
	if !isMaskEnabled || pipe == nil {
		return pipe
	}

	if pipe.Token != "" {
		pipe.Token = "***"
	}

	if !util.IsAdmin(user) {
		if pipe.SecretKey != "" {
			pipe.SecretKey = "***"
		}
	}

	return pipe
}

func GetMaskedPipes(pipes []*Pipe, isMaskEnabled bool, user *auth.User) []*Pipe {
	if !isMaskEnabled {
		return pipes
	}

	for _, pipe := range pipes {
		pipe = GetMaskedPipe(pipe, isMaskEnabled, user)
	}
	return pipes
}

func GetGlobalPipes() ([]*Pipe, error) {
	pipes := []*Pipe{}
	err := adapter.engine.Asc("owner").Desc("created_time").Find(&pipes)
	if err != nil {
		return pipes, err
	}
	return pipes, nil
}

func GetPipes(owner string) ([]*Pipe, error) {
	pipes := []*Pipe{}
	err := adapter.engine.Desc("created_time").Find(&pipes, &Pipe{Owner: owner})
	if err != nil {
		return pipes, err
	}
	return pipes, nil
}

func getPipe(owner string, name string) (*Pipe, error) {
	pipe := Pipe{Owner: owner, Name: name}
	existed, err := adapter.engine.Get(&pipe)
	if err != nil {
		return &pipe, err
	}

	if existed {
		return &pipe, nil
	}
	return nil, nil
}

func GetPipe(id string) (*Pipe, error) {
	owner, name, err := util.GetOwnerAndNameFromIdWithError(id)
	if err != nil {
		return nil, err
	}
	return getPipe(owner, name)
}

func GetPipeByName(owner string, name string) (*Pipe, error) {
	return getPipe(owner, name)
}

func UpdatePipe(id string, pipe *Pipe) (bool, error) {
	owner, name, err := util.GetOwnerAndNameFromIdWithError(id)
	if err != nil {
		return false, err
	}
	pipeDb, err := getPipe(owner, name)
	if err != nil {
		return false, err
	}
	if pipe == nil {
		return false, nil
	}

	pipe.processPipeParams(pipeDb)

	_, err = adapter.engine.ID(core.PK{owner, name}).AllCols().Update(pipe)
	if err != nil {
		return false, err
	}

	return true, nil
}

func AddPipe(pipe *Pipe) (bool, error) {
	affected, err := adapter.engine.Insert(pipe)
	if err != nil {
		return false, err
	}
	return affected != 0, nil
}

func DeletePipe(pipe *Pipe) (bool, error) {
	affected, err := adapter.engine.ID(core.PK{pipe.Owner, pipe.Name}).Delete(&Pipe{})
	if err != nil {
		return false, err
	}
	return affected != 0, nil
}

func (p *Pipe) GetId() string {
	return fmt.Sprintf("%s/%s", p.Owner, p.Name)
}

func (p *Pipe) GetProvider(lang string) (pipe.Pipe, error) {
	pipeObj, err := pipe.Get(p.Type, p.Token, p.SecretKey, p.Name, lang)
	if err != nil {
		return nil, err
	}

	if pipeObj == nil {
		return nil, fmt.Errorf(i18n.Translate(lang, "object:the pipe type: %s is not supported"), p.Type)
	}

	return pipeObj, nil
}

func (p *Pipe) processPipeParams(pipeDb *Pipe) {
	if p.Token == "***" {
		p.Token = pipeDb.Token
	}
	if p.SecretKey == "***" {
		p.SecretKey = pipeDb.SecretKey
	}
}
