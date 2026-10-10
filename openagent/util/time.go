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

package util

import "time"

// TimeFormat is the layout used for CreatedTime/UpdatedTime string columns.
const TimeFormat = "2006-01-02T15:04:05.999Z07:00"

// FormatTimeForCompare formats t so it can be compared (via plain string comparison,
// e.g. "created_time >= ?") against CreatedTime/UpdatedTime columns.
func FormatTimeForCompare(t time.Time) string {
	return t.Format(TimeFormat)
}

func GetCurrentTime() string {
	timestamp := time.Now().Unix()
	tm := time.Unix(timestamp, 0)
	return tm.Format(time.RFC3339)
}

func GetCurrentTimeWithMilli() string {
	tm := time.Now()
	return tm.Format(TimeFormat)
}

func GetCurrentTimeEx(timestamp string) string {
	tm := time.Now()
	inputTime, err := time.Parse(time.RFC3339, timestamp)
	if err != nil {
		panic(err)
	}

	if !tm.After(inputTime.Add(1 * time.Millisecond)) {
		tm = inputTime.Add(1 * time.Millisecond)
	}

	return tm.Format(TimeFormat)
}

func GetCurrentTimeBasedOnLastMilli(timestamp string) string {
	tm := time.Now()
	inputTime, err := time.Parse(TimeFormat, timestamp)
	if err != nil {
		panic(err)
	}

	if !tm.After(inputTime.Add(1 * time.Millisecond)) {
		tm = inputTime.Add(1 * time.Millisecond)
	}

	return tm.Format(TimeFormat)
}

func AdjustTimeFromSecToMilli(timeStr string, offsetMs int) string {
	t, err := time.Parse(time.RFC3339, timeStr)
	if err != nil {
		return timeStr
	}

	adjustedTime := t.Add(time.Duration(offsetMs) * time.Millisecond)

	return adjustedTime.Format(TimeFormat)
}

func AdjustTimeWithMilli(timeStr string, offsetMs int) string {
	t, err := time.Parse(TimeFormat, timeStr)
	if err != nil {
		return timeStr
	}

	adjustedTime := t.Add(time.Duration(offsetMs) * time.Millisecond)

	return adjustedTime.Format(TimeFormat)
}

// GetCurrentUnixTime returns the current Unix timestamp in seconds
func GetCurrentUnixTime() int64 {
	return time.Now().Unix()
}
