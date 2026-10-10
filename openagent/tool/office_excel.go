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

package tool

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
	"github.com/xuri/excelize/v2"
)

// ── Excel read ────────────────────────────────────────────────────────────────

type excelReadBuiltin struct{}

func (t *excelReadBuiltin) GetName() string { return "excel_read" }

func (t *excelReadBuiltin) GetDescription() string {
	return `Read data from an Excel (.xlsx) file and return it as CSV-formatted text.
- path (required): absolute or relative path to the .xlsx file.
- sheet: sheet name to read; if omitted the first sheet is used.
The response header reports the sheet name, row count, and other available sheet names.`
}

func (t *excelReadBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"path": map[string]interface{}{
				"type":        "string",
				"description": "Path to the .xlsx file to read.",
			},
			"sheet": map[string]interface{}{
				"type":        "string",
				"description": "Sheet name to read (default: first sheet).",
			},
		},
		"required": []string{"path"},
	}
}

func (t *excelReadBuiltin) Execute(_ context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	path, ok := arguments["path"].(string)
	if !ok || strings.TrimSpace(path) == "" {
		return officeToolError("Missing required parameter: path"), nil
	}
	sheetName, _ := arguments["sheet"].(string)
	sheetName = strings.TrimSpace(sheetName)

	result, err := readExcelFile(path, sheetName)
	if err != nil {
		return officeToolError(fmt.Sprintf("Failed to read Excel file: %s", err.Error())), nil
	}
	return officeToolText(result), nil
}

// ── Excel write ───────────────────────────────────────────────────────────────

type excelWriteBuiltin struct{}

func (t *excelWriteBuiltin) GetName() string { return "excel_write" }

func (t *excelWriteBuiltin) GetDescription() string {
	return `Write data to an Excel (.xlsx) file. Creates the file if it does not exist; overwrites otherwise.
- path (required): output path for the .xlsx file. Absolute paths are used as-is. Relative paths or bare filenames are resolved inside the current user's Documents folder.
- data (required): CSV-formatted text. Each line is a row; cells are comma-separated. Quoted fields with embedded commas or newlines are supported.
- sheet: sheet name (default: Sheet1).`
}

func (t *excelWriteBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"path": map[string]interface{}{
				"type":        "string",
				"description": "Output path for the .xlsx file.",
			},
			"data": map[string]interface{}{
				"type":        "string",
				"description": "CSV-formatted text: rows separated by newlines, cells by commas.",
			},
			"sheet": map[string]interface{}{
				"type":        "string",
				"description": "Sheet name (default: Sheet1).",
			},
		},
		"required": []string{"path", "data"},
	}
}

func (t *excelWriteBuiltin) Execute(_ context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	path, ok := arguments["path"].(string)
	if !ok || strings.TrimSpace(path) == "" {
		return officeToolError("Missing required parameter: path"), nil
	}
	data, ok := arguments["data"].(string)
	if !ok {
		return officeToolError("Missing required parameter: data"), nil
	}
	sheetName, _ := arguments["sheet"].(string)
	sheetName = strings.TrimSpace(sheetName)
	if sheetName == "" {
		sheetName = "Sheet1"
	}

	resolvedPath := ResolveOutputPath(path)
	rowCount, colCount, err := writeExcelFile(path, sheetName, data)
	if err != nil {
		return officeToolError(fmt.Sprintf("Failed to write Excel file: %s", err.Error())), nil
	}
	return officeToolText(fmt.Sprintf(
		"Successfully wrote Excel file: %s\nSheet: %s, %d rows × %d columns",
		resolvedPath, sheetName, rowCount, colCount,
	)), nil
}

// ── excelize helpers ──────────────────────────────────────────────────────────

// readExcelFile opens an xlsx file and returns the content of the target sheet
// as a CSV string prefixed with a metadata header line.
// If sheetName is empty the first sheet is used.
func readExcelFile(path, sheetName string) (string, error) {
	f, err := excelize.OpenFile(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return "", fmt.Errorf("the Excel file contains no sheets")
	}

	target := sheetName
	if target == "" {
		target = sheets[0]
	} else {
		found := false
		for _, s := range sheets {
			if s == target {
				found = true
				break
			}
		}
		if !found {
			return "", fmt.Errorf("sheet %q not found; available sheets: %s",
				target, strings.Join(sheets, ", "))
		}
	}

	rows, err := f.GetRows(target)
	if err != nil {
		return "", fmt.Errorf("failed to read sheet %q: %w", target, err)
	}

	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	for _, row := range rows {
		if err := w.Write(row); err != nil {
			return "", fmt.Errorf("failed to encode row as CSV: %w", err)
		}
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return "", err
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "Sheet: %s (%d rows)\n", target, len(rows))
	if len(sheets) > 1 {
		others := make([]string, 0, len(sheets)-1)
		for _, s := range sheets {
			if s != target {
				others = append(others, s)
			}
		}
		fmt.Fprintf(&sb, "Other sheets: %s\n", strings.Join(others, ", "))
	}
	sb.WriteString(buf.String())
	return sb.String(), nil
}

// writeExcelFile creates (or overwrites) an xlsx file from CSV-formatted text.
// It returns the number of rows and the maximum column count written.
func writeExcelFile(path, sheetName, csvData string) (rowCount, colCount int, err error) {
	path = ResolveOutputPath(path)
	dir := filepath.Dir(path)
	if mkErr := os.MkdirAll(dir, 0o755); mkErr != nil {
		return 0, 0, fmt.Errorf("failed to create directory %q: %w", dir, mkErr)
	}

	r := csv.NewReader(strings.NewReader(csvData))
	r.FieldsPerRecord = -1
	records, err := r.ReadAll()
	if err != nil {
		return 0, 0, fmt.Errorf("invalid CSV data: %w", err)
	}

	f := excelize.NewFile()
	defer f.Close()

	defaultSheet := f.GetSheetName(f.GetActiveSheetIndex())
	if defaultSheet != sheetName {
		if renameErr := f.SetSheetName(defaultSheet, sheetName); renameErr != nil {
			return 0, 0, fmt.Errorf("failed to set sheet name: %w", renameErr)
		}
	}

	maxCols := 0
	for rowIdx, record := range records {
		if len(record) > maxCols {
			maxCols = len(record)
		}
		for colIdx, cellValue := range record {
			cellAddr, addrErr := excelize.CoordinatesToCellName(colIdx+1, rowIdx+1)
			if addrErr != nil {
				return 0, 0, fmt.Errorf("invalid cell coordinates (%d,%d): %w", colIdx+1, rowIdx+1, addrErr)
			}
			if setErr := f.SetCellValue(sheetName, cellAddr, cellValue); setErr != nil {
				return 0, 0, fmt.Errorf("failed to write cell %s: %w", cellAddr, setErr)
			}
		}
	}

	if saveErr := f.SaveAs(path); saveErr != nil {
		return 0, 0, fmt.Errorf("failed to save file: %w", saveErr)
	}
	return len(records), maxCols, nil
}
