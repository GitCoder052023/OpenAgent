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
	"github.com/the-open-agent/openagent/util"
	"xorm.io/core"
)

type PipeRuntime struct {
	Owner       string `xorm:"varchar(100) notnull pk" json:"owner"`
	Pipe        string `xorm:"varchar(100) notnull pk" json:"pipe"`
	Key         string `xorm:"varchar(200) notnull pk" json:"key"`
	Value       string `xorm:"text" json:"value"`
	UpdatedTime string `xorm:"varchar(100)" json:"updatedTime"`
}

func GetPipeRuntimeValue(owner string, pipeName string, key string) (string, error) {
	runtime := PipeRuntime{Owner: owner, Pipe: pipeName, Key: key}
	existed, err := adapter.engine.Get(&runtime)
	if err != nil || !existed {
		return "", err
	}
	return runtime.Value, nil
}

func SetPipeRuntimeValue(owner string, pipeName string, key string, value string) error {
	runtime := &PipeRuntime{
		Owner:       owner,
		Pipe:        pipeName,
		Key:         key,
		Value:       value,
		UpdatedTime: util.GetCurrentTimeWithMilli(),
	}
	existed, err := adapter.engine.Get(&PipeRuntime{Owner: owner, Pipe: pipeName, Key: key})
	if err != nil {
		return err
	}
	if existed {
		_, err = adapter.engine.ID(core.PK{owner, pipeName, key}).AllCols().Update(runtime)
		return err
	}
	_, err = adapter.engine.Insert(runtime)
	return err
}

func DeletePipeRuntime(owner string, pipeName string) error {
	_, err := adapter.engine.Delete(&PipeRuntime{Owner: owner, Pipe: pipeName})
	return err
}
