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
	"strconv"
	"strings"
	"sync"
	"syscall"
	"unsafe"

	"github.com/go-ole/go-ole"
	"github.com/uandersonricardo/uiautomation"
)

type uiaEngine struct {
	auto *uiautomation.UIAutomation
	mu   sync.Mutex
	// elementIds maps stable ids to UIA elements; accessed only on STA thread.
	elementIds map[string]*uiautomation.Element
	nextID     int64
}

var (
	engineOnce sync.Once
	engineInst *uiaEngine
	engineErr  error
)

func getUiaEngine() (*uiaEngine, error) {
	engineOnce.Do(func() {
		engineInst = &uiaEngine{
			elementIds: map[string]*uiautomation.Element{},
		}
		engineErr = globalSta.run(func() error {
			auto, err := uiautomation.NewUIAutomation()
			if err != nil {
				return err
			}
			engineInst.auto = auto
			return nil
		})
	})
	return engineInst, engineErr
}

func (e *uiaEngine) elementFromHandle(hwnd uintptr) (*uiautomation.Element, error) {
	var elem *uiautomation.Element
	err := globalSta.run(func() error {
		ue, err := e.auto.ElementFromHandle(syscall.Handle(hwnd))
		if err != nil {
			return err
		}
		elem = ue
		return nil
	})
	return elem, err
}

func (e *uiaEngine) createPropertyConditionString(property uiautomation.PropertyId, value string, flags uiautomation.PropertyConditionFlags) (*uiautomation.Condition, error) {
	var cond *uiautomation.Condition
	err := globalSta.run(func() error {
		bstr := ole.SysAllocString(value)
		defer ole.SysFreeString(bstr)
		v := &ole.VARIANT{}
		ole.VariantInit(v)
		v.VT = ole.VT_BSTR
		v.Val = int64(uintptr(unsafe.Pointer(bstr)))
		defer ole.VariantClear(v)

		c, err := e.auto.CreatePropertyConditionEx(property, v, flags)
		if err != nil {
			return err
		}
		cond = c
		return nil
	})
	return cond, err
}

func (e *uiaEngine) createPropertyConditionControlType(controlType uiautomation.ControlTypeId) (*uiautomation.Condition, error) {
	var cond *uiautomation.Condition
	err := globalSta.run(func() error {
		v := &ole.VARIANT{}
		ole.VariantInit(v)
		v.VT = ole.VT_I4
		v.Val = int64(controlType)
		defer ole.VariantClear(v)

		c, err := e.auto.CreatePropertyCondition(uiautomation.ControlTypePropertyId, v)
		if err != nil {
			return err
		}
		cond = c
		return nil
	})
	return cond, err
}

func (e *uiaEngine) and(c1, c2 *uiautomation.Condition) (*uiautomation.Condition, error) {
	var cond *uiautomation.Condition
	err := globalSta.run(func() error {
		c, err := e.auto.CreateAndCondition(c1, c2)
		if err != nil {
			return err
		}
		cond = c
		return nil
	})
	return cond, err
}

func (e *uiaEngine) findFirst(root *uiautomation.Element, scope uiautomation.TreeScope, cond *uiautomation.Condition) (*uiautomation.Element, error) {
	var elem *uiautomation.Element
	err := globalSta.run(func() error {
		el, err := root.FindFirst(scope, cond)
		if err != nil {
			return err
		}
		if el == nil {
			return fmt.Errorf("element not found")
		}
		elem = el
		return nil
	})
	return elem, err
}

func controlTypeFromName(name string) (uiautomation.ControlTypeId, bool) {
	n := strings.TrimSpace(strings.ToLower(name))
	switch n {
	case "button":
		return uiautomation.ButtonControlTypeId, true
	case "edit", "textbox", "text_box", "input":
		return uiautomation.EditControlTypeId, true
	case "document":
		return uiautomation.DocumentControlTypeId, true
	case "window":
		return uiautomation.WindowControlTypeId, true
	case "menuitem", "menu_item":
		return uiautomation.MenuItemControlTypeId, true
	case "text", "label":
		return uiautomation.TextControlTypeId, true
	case "listitem", "list_item":
		return uiautomation.ListItemControlTypeId, true
	default:
		return 0, false
	}
}

func (e *uiaEngine) nextElementID() string {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.nextID++
	return "el_" + strconv.FormatInt(e.nextID, 10)
}

func (e *uiaEngine) putElement(elem *uiautomation.Element) string {
	id := e.nextElementID()
	e.mu.Lock()
	e.elementIds[id] = elem
	e.mu.Unlock()
	return id
}

func (e *uiaEngine) getElement(id string) (*uiautomation.Element, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	elem := e.elementIds[id]
	if elem == nil {
		return nil, fmt.Errorf("unknown element_id: %s", id)
	}
	return elem, nil
}

func (e *uiaEngine) findElementByCriteria(windowTitleContains, nameContains, className, controlType string) (string, map[string]any, error) {
	if strings.TrimSpace(windowTitleContains) == "" {
		return "", nil, fmt.Errorf("window_title_contains is required")
	}
	hwnd, err := findTopLevelWindowByTitleContains(windowTitleContains)
	if err != nil {
		return "", nil, err
	}
	if err := focusWindow(hwnd); err != nil {
		return "", nil, err
	}
	root, err := e.elementFromHandle(hwnd)
	if err != nil {
		return "", nil, err
	}

	conds := make([]*uiautomation.Condition, 0, 3)
	if strings.TrimSpace(nameContains) != "" {
		c, err := e.createPropertyConditionString(
			uiautomation.NamePropertyId,
			strings.TrimSpace(nameContains),
			uiautomation.PropertyConditionFlagsIgnoreCase|uiautomation.PropertyConditionFlagsMatchSubstring,
		)
		if err == nil {
			conds = append(conds, c)
		}
	}
	if strings.TrimSpace(className) != "" {
		c, err := e.createPropertyConditionString(
			uiautomation.ClassNamePropertyId,
			strings.TrimSpace(className),
			uiautomation.PropertyConditionFlagsIgnoreCase|uiautomation.PropertyConditionFlagsMatchSubstring,
		)
		if err == nil {
			conds = append(conds, c)
		}
	}
	if strings.TrimSpace(controlType) != "" {
		if ct, ok := controlTypeFromName(controlType); ok {
			c, err := e.createPropertyConditionControlType(ct)
			if err == nil {
				conds = append(conds, c)
			}
		}
	}

	var merged *uiautomation.Condition
	if len(conds) == 0 {
		err = globalSta.run(func() error {
			c, cErr := e.auto.CreateTrueCondition()
			if cErr != nil {
				return cErr
			}
			merged = c
			return nil
		})
		if err != nil {
			return "", nil, err
		}
	} else {
		merged = conds[0]
		for i := 1; i < len(conds); i++ {
			merged, err = e.and(merged, conds[i])
			if err != nil {
				return "", nil, err
			}
		}
	}

	elem, err := e.findFirst(root, uiautomation.TreeScopeDescendants, merged)
	if err != nil {
		return "", nil, err
	}

	var elemName, elemClass string
	var ct uiautomation.ControlTypeId
	_ = globalSta.run(func() error {
		if n, nErr := elem.CurrentName(); nErr == nil {
			elemName = n
		}
		if c, cErr := elem.CurrentClassName(); cErr == nil {
			elemClass = c
		}
		if t, tErr := elem.CurrentControlType(); tErr == nil {
			ct = t
		}
		return nil
	})

	id := e.putElement(elem)
	meta := map[string]any{
		"element_id":   id,
		"window_hwnd":  hwnd,
		"name":         elemName,
		"class_name":   elemClass,
		"control_type": int(ct),
	}
	return id, meta, nil
}

func (e *uiaEngine) clickElement(id string) error {
	elem, err := e.getElement(id)
	if err != nil {
		return err
	}
	return globalSta.run(func() error {
		patObj, patErr := elem.GetCurrentPatternAs(uiautomation.InvokePatternId, uiautomation.IID_IUIAutomationInvokePattern)
		if patErr == nil && patObj != nil {
			ip := (*uiautomation.InvokePattern)(unsafe.Pointer(patObj))
			return ip.Invoke()
		}
		return elem.SetFocus()
	})
}

func (e *uiaEngine) setTextElement(id, text string) error {
	elem, err := e.getElement(id)
	if err != nil {
		return err
	}
	return globalSta.run(func() error {
		patObj, patErr := elem.GetCurrentPatternAs(uiautomation.ValuePatternId, uiautomation.IID_IUIAutomationValuePattern)
		if patErr == nil && patObj != nil {
			vp := (*uiautomation.ValuePattern)(unsafe.Pointer(patObj))
			if err := vp.SetValue(text); err == nil {
				return nil
			}
		}
		if err := elem.SetFocus(); err != nil {
			return err
		}
		// Fallback for complex apps (e.g. Word): clipboard paste is more reliable than per-char input.
		if err := setClipboardUnicodeText(text); err != nil {
			return err
		}
		return sendKeyTap("v", "ctrl")
	})
}

func (e *uiaEngine) getTextElement(id string) (string, error) {
	elem, err := e.getElement(id)
	if err != nil {
		return "", err
	}
	var out string
	err = globalSta.run(func() error {
		patObj, patErr := elem.GetCurrentPatternAs(uiautomation.ValuePatternId, uiautomation.IID_IUIAutomationValuePattern)
		if patErr == nil && patObj != nil {
			vp := (*uiautomation.ValuePattern)(unsafe.Pointer(patObj))
			if v, vErr := vp.CurrentValue(); vErr == nil {
				out = v
				return nil
			}
		}
		if n, nErr := elem.CurrentName(); nErr == nil {
			out = n
			return nil
		}
		return fmt.Errorf("failed to read text from element")
	})
	return out, err
}
