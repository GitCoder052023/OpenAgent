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

//go:build windows

package windowsuia

import (
	"fmt"
	"runtime"
	"sync"

	"github.com/go-ole/go-ole"
)

// staScheduler runs all COM/UIA operations on a single STA OS thread.
type staScheduler struct {
	once sync.Once
	ch   chan func()
}

func (s *staScheduler) start() {
	s.once.Do(func() {
		s.ch = make(chan func(), 128)
		go func() {
			runtime.LockOSThread()
			defer runtime.UnlockOSThread()

			// STA init is required for UI Automation.
			if err := ole.CoInitializeEx(0, ole.COINIT_APARTMENTTHREADED); err != nil {
				// CoInitializeEx returns S_FALSE as error sometimes; treat as ok.
				// go-ole wraps HRESULT in error; accept 0x00000001 too.
				if oleErr, ok := err.(*ole.OleError); ok {
					if oleErr.Code() != 0x00000001 {
						panic(fmt.Sprintf("CoInitializeEx failed: %v", err))
					}
				} else {
					panic(fmt.Sprintf("CoInitializeEx failed: %v", err))
				}
			}
			defer ole.CoUninitialize()

			for fn := range s.ch {
				if fn != nil {
					fn()
				}
			}
		}()
	})
}

func (s *staScheduler) run(fn func() error) error {
	s.start()
	done := make(chan error, 1)
	s.ch <- func() {
		defer func() {
			if r := recover(); r != nil {
				done <- fmt.Errorf("panic in STA task: %v", r)
			}
		}()
		done <- fn()
	}
	return <-done
}

var globalSta = &staScheduler{}
