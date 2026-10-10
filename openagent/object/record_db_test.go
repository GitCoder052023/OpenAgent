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

//go:build !skipCi
// +build !skipCi

package object

import (
	"fmt"
	"testing"
	"time"

	"github.com/the-open-agent/openagent/conf"
	"github.com/xuri/excelize/v2"
	"xorm.io/xorm"
)

const (
	customerDbCount    = 128
	inactiveDaysThresh = 30
)

type customerDbStatus struct {
	DbName      string
	Exists      bool
	RecordCount int64
	LastActive  string
	IsInactive  bool
}

func TestCheckCustomerDbActivity(t *testing.T) {
	InitConfig()

	driverName := conf.GetConfigString("driverName")
	dataSourceName := conf.GetConfigDataSourceName()
	cutoff := time.Now().AddDate(0, 0, -inactiveDaysThresh)

	var results []customerDbStatus

	for i := 1; i <= customerDbCount; i++ {
		dbName := fmt.Sprintf("casibase_customer_%04d", i)
		status := probeCustomerDb(driverName, dataSourceName, dbName, cutoff)
		results = append(results, status)

		if !status.Exists {
			fmt.Printf("[%04d] %-35s  NOT EXISTS\n", i, dbName)
		} else if status.IsInactive {
			fmt.Printf("[%04d] %-35s  INACTIVE   records=%-6d last=%s\n", i, dbName, status.RecordCount, status.LastActive)
		} else {
			fmt.Printf("[%04d] %-35s  active     records=%-6d last=%s\n", i, dbName, status.RecordCount, status.LastActive)
		}
	}

	if err := writeCustomerStatusXlsx(results, "customer_db_activity.xlsx"); err != nil {
		t.Fatalf("failed to write xlsx: %v", err)
	}
	fmt.Println("\nReport saved to customer_db_activity.xlsx")
}

func probeCustomerDb(driverName, dataSourceName, dbName string, cutoff time.Time) customerDbStatus {
	status := customerDbStatus{DbName: dbName}

	dsn := dataSourceName + dbName
	engine, err := xorm.NewEngine(driverName, dsn)
	if err != nil {
		return status
	}
	defer engine.Close()

	// ping to check if DB exists and is reachable
	if err := engine.Ping(); err != nil {
		return status
	}
	status.Exists = true

	// check if record table exists
	exists, err := engine.IsTableExist("record")
	if err != nil || !exists {
		status.LastActive = "no table"
		return status
	}

	count, err := engine.Table("record").Count()
	if err != nil {
		status.LastActive = "query error"
		return status
	}
	status.RecordCount = count

	// get most recent created_time
	type maxTime struct {
		MaxTime string `xorm:"max_time"`
	}
	var mt maxTime
	_, err = engine.SQL("SELECT MAX(created_time) AS max_time FROM record").Get(&mt)
	if err != nil {
		status.LastActive = "query error"
		return status
	}

	if mt.MaxTime == "" {
		status.LastActive = "never"
		status.IsInactive = true
		return status
	}
	status.LastActive = mt.MaxTime

	// parse the stored time string (format: "2006-01-02T15:04:05.000Z07:00" or similar)
	lastTime, err := parseRecordTime(mt.MaxTime)
	if err != nil || lastTime.Before(cutoff) {
		status.IsInactive = true
	}

	return status
}

func parseRecordTime(s string) (time.Time, error) {
	formats := []string{
		"2006-01-02T15:04:05.000Z07:00",
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("cannot parse time: %s", s)
}

func writeCustomerStatusXlsx(results []customerDbStatus, path string) error {
	f := excelize.NewFile()
	sheet := "Sheet1"

	headers := []string{"DB Name", "Exists", "Record Count", "Last Active", "Status"}
	for col, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(col+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	for row, r := range results {
		xlRow := row + 2
		status := "active"
		if !r.Exists {
			status = "NOT EXISTS"
		} else if r.IsInactive {
			status = "INACTIVE"
		}

		existsStr := "no"
		if r.Exists {
			existsStr = "yes"
		}

		vals := []interface{}{r.DbName, existsStr, r.RecordCount, r.LastActive, status}
		for col, v := range vals {
			cell, _ := excelize.CoordinatesToCellName(col+1, xlRow)
			f.SetCellValue(sheet, cell, v)
		}
	}

	return f.SaveAs(path)
}
