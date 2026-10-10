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
	"sort"
	"time"

	"github.com/the-open-agent/openagent/util"
)

// ProviderCategoryCount holds a provider category label and its count.
type ProviderCategoryCount struct {
	Category string `json:"category"`
	Count    int64  `json:"count"`
}

// MessageHeatmapData holds daily message activity aggregated over the past year.
type MessageHeatmapData struct {
	Data      []DayCount `json:"data"`
	MaxCount  int        `json:"maxCount"`
	DateRange [2]string  `json:"dateRange"`
}

// DayCount holds a date and the number of messages on that day.
type DayCount struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// GetUsageProviderDistribution returns provider counts grouped by category for the given owner.
func GetUsageProviderDistribution(owner string) ([]*ProviderCategoryCount, error) {
	var providers []*Provider
	query := adapter.engine.Table("provider")
	if owner != "" {
		query = query.Where("owner = ?", owner)
	}
	if err := query.Find(&providers); err != nil {
		return nil, err
	}

	categoryCounts := make(map[string]int64)
	for _, p := range providers {
		cat := p.Category
		if cat == "" {
			cat = "Unknown"
		}
		categoryCounts[cat]++
	}

	result := make([]*ProviderCategoryCount, 0, len(categoryCounts))
	for cat, count := range categoryCounts {
		result = append(result, &ProviderCategoryCount{Category: cat, Count: count})
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Count > result[j].Count
	})
	return result, nil
}

// GetUsageMessageHeatmap returns daily message counts over the past year,
// suitable for rendering a GitHub-style calendar heatmap.
func GetUsageMessageHeatmap(owner string) (*MessageHeatmapData, error) {
	now := time.Now()
	oneYearAgo := now.AddDate(-1, 0, 0)
	dateRange := [2]string{oneYearAgo.Format("2006-01-02"), now.Format("2006-01-02")}

	type msgItem struct {
		CreatedTime string `xorm:"created_time"`
	}

	var items []msgItem
	query := adapter.engine.Table("message").Cols("created_time").
		Where("created_time >= ?", util.FormatTimeForCompare(oneYearAgo))
	if owner != "" {
		query = query.And("organization = ?", owner)
	}
	if err := query.Find(&items); err != nil {
		return &MessageHeatmapData{Data: []DayCount{}, MaxCount: 0, DateRange: dateRange}, nil
	}

	dateCounts := make(map[string]int)
	for _, item := range items {
		t, err := time.Parse(time.RFC3339Nano, item.CreatedTime)
		if err != nil {
			continue
		}
		dateCounts[t.Format("2006-01-02")]++
	}

	data := make([]DayCount, 0, len(dateCounts))
	maxCount := 0
	for date, count := range dateCounts {
		data = append(data, DayCount{Date: date, Count: count})
		if count > maxCount {
			maxCount = count
		}
	}
	sort.Slice(data, func(i, j int) bool {
		return data[i].Date < data[j].Date
	})

	return &MessageHeatmapData{Data: data, MaxCount: maxCount, DateRange: dateRange}, nil
}
