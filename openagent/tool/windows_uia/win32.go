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
	"strings"
	"syscall"
	"unicode"
	"unsafe"

	"golang.org/x/sys/windows"
)

func findTopLevelWindowByTitleContains(substr string) (uintptr, error) {
	substr = strings.TrimSpace(substr)
	if substr == "" {
		return 0, fmt.Errorf("empty title substring")
	}
	lower := strings.ToLower(substr)

	var found uintptr
	enumWindows(func(hwnd uintptr) bool {
		if !isWindowVisible(hwnd) {
			return true
		}
		title := getWindowText(hwnd)
		if title == "" {
			return true
		}
		if strings.Contains(strings.ToLower(title), lower) {
			found = hwnd
			return false
		}
		return true
	})
	if found == 0 {
		return 0, fmt.Errorf("window not found (title contains %q)", substr)
	}
	return found, nil
}

func focusWindow(hwnd uintptr) error {
	if hwnd == 0 || !isWindow(hwnd) {
		return fmt.Errorf("invalid hwnd: %d", hwnd)
	}

	// Restore if minimized.
	if isIconic(hwnd) {
		showWindow(hwnd, swRestore)
	}

	// Attach thread input to allow SetForegroundWindow in more cases.
	fg := getForegroundWindow()
	fgTid := getWindowThreadProcessId(fg)
	curTid := getCurrentThreadId()
	targetTid := getWindowThreadProcessId(hwnd)

	if fgTid != 0 && targetTid != 0 && fgTid != targetTid {
		attachThreadInput(fgTid, targetTid, true)
		defer attachThreadInput(fgTid, targetTid, false)
	}
	if curTid != 0 && targetTid != 0 && curTid != targetTid {
		attachThreadInput(curTid, targetTid, true)
		defer attachThreadInput(curTid, targetTid, false)
	}

	// Bring to front.
	bringWindowToTop(hwnd)
	setActiveWindow(hwnd)
	setForegroundWindow(hwnd)

	// Nudge Z order (sometimes needed).
	setWindowPos(hwnd, hwndTop, 0, 0, 0, 0, swpNoMove|swpNoSize)

	// Validate.
	if getForegroundWindow() != hwnd {
		// last resort: simulate Alt
		const vkMenu = 0x12
		keybdEvent(vkMenu, 0, 0, 0)
		keybdEvent(vkMenu, 0, keyeventfKeyUp, 0)
		setForegroundWindow(hwnd)
	}
	return nil
}

// ---- user32 wrappers ----

var (
	user32                    = windows.NewLazySystemDLL("user32.dll")
	procEnumWindows           = user32.NewProc("EnumWindows")
	procIsWindowVisible       = user32.NewProc("IsWindowVisible")
	procGetWindowTextW        = user32.NewProc("GetWindowTextW")
	procGetWindowTextLengthW  = user32.NewProc("GetWindowTextLengthW")
	procIsWindow              = user32.NewProc("IsWindow")
	procIsIconic              = user32.NewProc("IsIconic")
	procShowWindow            = user32.NewProc("ShowWindow")
	procGetForegroundWindow   = user32.NewProc("GetForegroundWindow")
	procGetWindowThreadProcId = user32.NewProc("GetWindowThreadProcessId")
	procGetCurrentThreadId    = windows.NewLazySystemDLL("kernel32.dll").NewProc("GetCurrentThreadId")
	procAttachThreadInput     = user32.NewProc("AttachThreadInput")
	procBringWindowToTop      = user32.NewProc("BringWindowToTop")
	procSetActiveWindow       = user32.NewProc("SetActiveWindow")
	procSetForegroundWindow   = user32.NewProc("SetForegroundWindow")
	procSetWindowPos          = user32.NewProc("SetWindowPos")
	procKeybdEvent            = user32.NewProc("keybd_event")
	procSendMessageW          = user32.NewProc("SendMessageW")
	procOpenClipboard         = user32.NewProc("OpenClipboard")
	procCloseClipboard        = user32.NewProc("CloseClipboard")
	procEmptyClipboard        = user32.NewProc("EmptyClipboard")
	procSetClipboardData      = user32.NewProc("SetClipboardData")
)

const (
	swRestore      = 9
	hwndTop        = 0
	swpNoMove      = 0x0002
	swpNoSize      = 0x0001
	keyeventfKeyUp = 0x0002
	wmChar         = 0x0102
	cfUnicodeText  = 13
	gmemMoveable   = 0x0002
)

func enumWindows(cb func(hwnd uintptr) bool) {
	callback := syscall.NewCallback(func(hwnd uintptr, lparam uintptr) uintptr {
		_ = lparam
		if cb(hwnd) {
			return 1
		}
		return 0
	})
	_, _, _ = procEnumWindows.Call(callback, 0)
}

func isWindowVisible(hwnd uintptr) bool {
	r, _, _ := procIsWindowVisible.Call(hwnd)
	return r != 0
}

func getWindowText(hwnd uintptr) string {
	n, _, _ := procGetWindowTextLengthW.Call(hwnd)
	if n == 0 {
		return ""
	}
	buf := make([]uint16, n+1)
	_, _, _ = procGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), uintptr(n+1))
	return windows.UTF16ToString(buf)
}

func isWindow(hwnd uintptr) bool {
	r, _, _ := procIsWindow.Call(hwnd)
	return r != 0
}

func isIconic(hwnd uintptr) bool {
	r, _, _ := procIsIconic.Call(hwnd)
	return r != 0
}

func showWindow(hwnd uintptr, cmd int) {
	_, _, _ = procShowWindow.Call(hwnd, uintptr(cmd))
}

func getForegroundWindow() uintptr {
	r, _, _ := procGetForegroundWindow.Call()
	return r
}

func getWindowThreadProcessId(hwnd uintptr) uint32 {
	r, _, _ := procGetWindowThreadProcId.Call(hwnd, 0)
	return uint32(r)
}

func getCurrentThreadId() uint32 {
	r, _, _ := procGetCurrentThreadId.Call()
	return uint32(r)
}

func attachThreadInput(idAttach, idAttachTo uint32, attach bool) {
	var a uintptr
	if attach {
		a = 1
	}
	_, _, _ = procAttachThreadInput.Call(uintptr(idAttach), uintptr(idAttachTo), a)
}

func bringWindowToTop(hwnd uintptr) {
	_, _, _ = procBringWindowToTop.Call(hwnd)
}

func setActiveWindow(hwnd uintptr) {
	_, _, _ = procSetActiveWindow.Call(hwnd)
}

func setForegroundWindow(hwnd uintptr) {
	_, _, _ = procSetForegroundWindow.Call(hwnd)
}

func setWindowPos(hwnd uintptr, insertAfter uintptr, x, y, cx, cy int, flags uint32) {
	_, _, _ = procSetWindowPos.Call(hwnd, insertAfter, uintptr(x), uintptr(y), uintptr(cx), uintptr(cy), uintptr(flags))
}

func keybdEvent(vk uint8, scan uint8, flags uint32, extraInfo uintptr) {
	_, _, _ = procKeybdEvent.Call(uintptr(vk), uintptr(scan), uintptr(flags), extraInfo)
}

func normalizeKeyToVK(key string) (uint16, bool) {
	k := strings.TrimSpace(strings.ToLower(key))
	switch k {
	case "ctrl", "control":
		return 0x11, true
	case "alt":
		return 0x12, true
	case "shift":
		return 0x10, true
	case "win", "meta", "windows":
		return 0x5B, true
	case "enter", "return":
		return 0x0D, true
	case "esc", "escape":
		return 0x1B, true
	case "tab":
		return 0x09, true
	case "space":
		return 0x20, true
	}
	if len(k) == 1 {
		r := rune(k[0])
		if unicode.IsLetter(r) {
			return uint16(unicode.ToUpper(r)), true
		}
		if unicode.IsDigit(r) {
			return uint16(r), true
		}
	}
	return 0, false
}

func sendKeyTap(key string, modifiers ...string) error {
	for _, m := range modifiers {
		if vk, ok := normalizeKeyToVK(m); ok {
			keybdEvent(uint8(vk), 0, 0, 0)
		}
	}
	vk, ok := normalizeKeyToVK(key)
	if !ok {
		return fmt.Errorf("unsupported key: %s", key)
	}
	keybdEvent(uint8(vk), 0, 0, 0)
	keybdEvent(uint8(vk), 0, keyeventfKeyUp, 0)
	for i := len(modifiers) - 1; i >= 0; i-- {
		if mk, ok := normalizeKeyToVK(modifiers[i]); ok {
			keybdEvent(uint8(mk), 0, keyeventfKeyUp, 0)
		}
	}
	return nil
}

func sendKeyUp(key string) error {
	vk, ok := normalizeKeyToVK(key)
	if !ok {
		return fmt.Errorf("unsupported key: %s", key)
	}
	keybdEvent(uint8(vk), 0, keyeventfKeyUp, 0)
	return nil
}

func sendTextInput(text string) error {
	hwnd := getForegroundWindow()
	if hwnd == 0 {
		return fmt.Errorf("no foreground window to receive text")
	}
	for _, r := range text {
		rr := r
		if rr == '\n' {
			rr = '\r'
		}
		_, _, _ = procSendMessageW.Call(hwnd, wmChar, uintptr(rr), 0)
	}
	return nil
}

var (
	kernel32         = windows.NewLazySystemDLL("kernel32.dll")
	procGlobalAlloc  = kernel32.NewProc("GlobalAlloc")
	procGlobalLock   = kernel32.NewProc("GlobalLock")
	procGlobalUnlock = kernel32.NewProc("GlobalUnlock")
	procGlobalFree   = kernel32.NewProc("GlobalFree")
)

func setClipboardUnicodeText(text string) error {
	// OpenClipboard requires a HWND or 0 (current task).
	if r, _, err := procOpenClipboard.Call(0); r == 0 {
		if err != nil && err != syscall.Errno(0) {
			return err
		}
		return fmt.Errorf("OpenClipboard failed")
	}
	defer procCloseClipboard.Call()

	_, _, _ = procEmptyClipboard.Call()

	utf16, err := windows.UTF16FromString(text)
	if err != nil {
		return err
	}
	sizeBytes := uintptr(len(utf16) * 2)

	hMem, _, allocErr := procGlobalAlloc.Call(gmemMoveable, sizeBytes)
	if hMem == 0 {
		if allocErr != nil && allocErr != syscall.Errno(0) {
			return allocErr
		}
		return fmt.Errorf("GlobalAlloc failed")
	}

	ptr, _, lockErr := procGlobalLock.Call(hMem)
	if ptr == 0 {
		_, _, _ = procGlobalFree.Call(hMem)
		if lockErr != nil && lockErr != syscall.Errno(0) {
			return lockErr
		}
		return fmt.Errorf("GlobalLock failed")
	}
	// Copy bytes. Use unsafe.SliceData to avoid the vet unsafeptr warning when
	// taking a pointer to a slice element.
	dst := unsafe.Slice((*byte)(unsafe.Pointer(ptr)), sizeBytes)
	src := unsafe.Slice((*byte)(unsafe.Pointer(unsafe.SliceData(utf16))), sizeBytes)
	copy(dst, src)
	_, _, _ = procGlobalUnlock.Call(hMem)

	// After SetClipboardData succeeds, system owns the memory handle.
	if r, _, err := procSetClipboardData.Call(cfUnicodeText, hMem); r == 0 {
		_, _, _ = procGlobalFree.Call(hMem)
		if err != nil && err != syscall.Errno(0) {
			return err
		}
		return fmt.Errorf("SetClipboardData failed")
	}
	return nil
}
