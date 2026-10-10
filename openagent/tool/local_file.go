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
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"mime/multipart"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
	"github.com/the-open-agent/openagent/internal/localocr"
	"github.com/the-open-agent/openagent/txt"
)

const (
	localFileDefaultPreviewChars = 1200
	localFileMaxPreviewChars     = 20000
	localFileDefaultReadLimit    = 12000
	localFileMaxReadLimit        = 100000
	localFileOcrTimeout          = 2 * time.Minute
)

// LocalFileTool is the Tool Type "local_file".
type LocalFileTool struct {
	lang        string
	ocrEndpoint string
}

func (p *LocalFileTool) BuiltinTools() []BuiltinTool {
	return []BuiltinTool{
		&localSpecialDirsBuiltin{},
		&localFileScanBuiltin{lang: p.lang},
		&localFileReadBuiltin{lang: p.lang},
		&localPdfOcrReadBuiltin{endpoint: p.ocrEndpoint},
		&localFileWriteBuiltin{},
		&localFileMoveBuiltin{},
	}
}

type localFileScanItem struct {
	Type         string `json:"type"`
	Name         string `json:"name"`
	Path         string `json:"path"`
	Size         int64  `json:"size,omitempty"`
	ModifiedTime string `json:"modifiedTime,omitempty"`
	TextLength   int    `json:"textLength,omitempty"`
	Preview      string `json:"preview,omitempty"`
	Truncated    bool   `json:"truncated,omitempty"`
	Error        string `json:"error,omitempty"`
}

type localSpecialDirInfo struct {
	Path   string `json:"path"`
	Exists bool   `json:"exists"`
}

type localSpecialDirs struct {
	Desktop   localSpecialDirInfo `json:"desktop"`
	Documents localSpecialDirInfo `json:"documents"`
	Downloads localSpecialDirInfo `json:"downloads"`
}

type localSpecialDirsResult struct {
	OS          string           `json:"os"`
	Username    string           `json:"username"`
	Home        string           `json:"home"`
	Directories localSpecialDirs `json:"directories"`
}

type localFileScanResult struct {
	Root  string              `json:"root"`
	Count int                 `json:"count"`
	Items []localFileScanItem `json:"items"`
}

type localFileReadResult struct {
	Path       string `json:"path"`
	Extension  string `json:"extension"`
	Offset     int    `json:"offset"`
	Limit      int    `json:"limit"`
	TextLength int    `json:"textLength"`
	Text       string `json:"text"`
	Truncated  bool   `json:"truncated"`
}

type localPdfOcrReadResult struct {
	Path       string `json:"path"`
	TextLength int    `json:"textLength"`
	Text       string `json:"text"`
}

type localPdfOcrResponse struct {
	Text *string `json:"text"`
}

type localFileWriteResult struct {
	Path      string `json:"path"`
	ByteSize  int    `json:"byteSize"`
	Overwrote bool   `json:"overwrote"`
}

type localFileMoveResult struct {
	Source    string `json:"source"`
	Target    string `json:"target"`
	Overwrote bool   `json:"overwrote"`
}

func localFileText(text string) *protocol.CallToolResult {
	return &protocol.CallToolResult{
		IsError: false,
		Content: []protocol.Content{
			&protocol.TextContent{Type: "text", Text: text},
		},
	}
}

func localFileError(text string) *protocol.CallToolResult {
	return &protocol.CallToolResult{
		IsError: true,
		Content: []protocol.Content{
			&protocol.TextContent{Type: "text", Text: text},
		},
	}
}

func localFileJSON(v interface{}) *protocol.CallToolResult {
	bs, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return localFileError(err.Error())
	}
	return localFileText(string(bs))
}

var (
	localFileRename = os.Rename
	localFileRemove = os.Remove
)

func localFileStringArg(arguments map[string]interface{}, key string) string {
	value, _ := arguments[key].(string)
	return strings.TrimSpace(value)
}

func localFileBoolArg(arguments map[string]interface{}, key string) bool {
	value, _ := arguments[key].(bool)
	return value
}

func localFileIntArg(arguments map[string]interface{}, key string, defaultValue int) int {
	value, ok := arguments[key]
	if !ok {
		return defaultValue
	}
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case json.Number:
		n, err := v.Int64()
		if err == nil {
			return int(n)
		}
	}
	return defaultValue
}

func localFileRequireAbsolutePath(path, field string) error {
	if strings.TrimSpace(path) == "" {
		return fmt.Errorf("missing required parameter: %s", field)
	}
	if !filepath.IsAbs(path) {
		return fmt.Errorf("%s must be an absolute path for the current operating system: %s", field, path)
	}
	return nil
}

func localFileSupportedExt(path string) (string, bool) {
	ext := strings.ToLower(filepath.Ext(path))
	for _, supportedExt := range txt.GetSupportedFileTypes() {
		if ext == supportedExt {
			return ext, true
		}
	}
	return ext, false
}

func localFileClamp(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func localFileSliceText(text string, offset, limit int) (string, bool) {
	runes := []rune(text)
	if offset > len(runes) {
		return "", false
	}
	end := offset + limit
	truncated := false
	if end < len(runes) {
		truncated = true
	} else {
		end = len(runes)
	}
	return string(runes[offset:end]), truncated
}

func localFileReadText(path, ext, lang string) (string, error) {
	if _, ok := localFileSupportedExt(path); ok {
		return txt.GetParsedTextFromUrl(path, ext, lang)
	}
	bs, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	if !utf8.Valid(bs) {
		return "", fmt.Errorf("file content is not valid UTF-8 text")
	}
	return string(bs), nil
}

func localFileOcrEndpoint(ctx context.Context, endpoint string) (string, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint != "" {
		return endpoint, nil
	}
	return localocr.EnsureRunning(ctx)
}

func localFilePostPdfOcr(ctx context.Context, endpoint string, path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", filepath.Base(path))
	if err != nil {
		return "", err
	}
	if _, err = io.Copy(part, file); err != nil {
		return "", err
	}
	if err = writer.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: localFileOcrTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("ocr endpoint returned status %d", resp.StatusCode)
	}

	var result localPdfOcrResponse
	if err = json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if result.Text == nil {
		return "", fmt.Errorf("ocr endpoint response missing text")
	}
	return *result.Text, nil
}

func localFileDirectory(path string) localSpecialDirInfo {
	info, err := os.Stat(path)
	return localSpecialDirInfo{
		Path:   path,
		Exists: err == nil && info.IsDir(),
	}
}

func localFileDesktopPath(home string) string {
	desktop := filepath.Join(home, "Desktop")
	if runtime.GOOS == "windows" {
		oneDriveDesktop := filepath.Join(home, "OneDrive", "Desktop")
		if localFileDirectory(oneDriveDesktop).Exists {
			return oneDriveDesktop
		}
	}
	return desktop
}

type localSpecialDirsBuiltin struct{}

func (b *localSpecialDirsBuiltin) GetName() string {
	return "local_special_dirs"
}

func (b *localSpecialDirsBuiltin) GetDescription() string {
	return `Return common local directories for the operating system user running the OpenAgent backend process.
- No required parameters.
- Returns os, username, home, and Desktop/Documents/Downloads paths with existence flags.
- Use this before scanning when the user says "my Desktop", "my Documents", or "Downloads" without an absolute path.`
}

func (b *localSpecialDirsBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type":       "object",
		"properties": map[string]interface{}{},
	}
}

func (b *localSpecialDirsBuiltin) Execute(_ context.Context, _ map[string]interface{}) (*protocol.CallToolResult, error) {
	currentUser, err := user.Current()
	if err != nil {
		return localFileError(fmt.Sprintf("failed to read current process user: %s", err.Error())), nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return localFileError(fmt.Sprintf("failed to read current process user home: %s", err.Error())), nil
	}
	if !filepath.IsAbs(home) {
		return localFileError(fmt.Sprintf("current process user home is not absolute: %s", home)), nil
	}

	return localFileJSON(localSpecialDirsResult{
		OS:       runtime.GOOS,
		Username: currentUser.Username,
		Home:     home,
		Directories: localSpecialDirs{
			Desktop:   localFileDirectory(localFileDesktopPath(home)),
			Documents: localFileDirectory(filepath.Join(home, "Documents")),
			Downloads: localFileDirectory(filepath.Join(home, "Downloads")),
		},
	}), nil
}

type localPdfOcrReadBuiltin struct {
	endpoint string
}

func (b *localPdfOcrReadBuiltin) GetName() string {
	return "local_pdf_ocr_read"
}

func (b *localPdfOcrReadBuiltin) GetDescription() string {
	return `Read a scanned local PDF through the configured OCR HTTP endpoint.
- path (required): absolute PDF file path for the current operating system.
- Sends multipart/form-data field "file" to the local_file Provider URL, or the managed local OCR service when Provider URL is empty.
- The OCR endpoint must return JSON: {"text":"recognized text"}.`
}

func (b *localPdfOcrReadBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"path": map[string]interface{}{
				"type":        "string",
				"description": "Absolute path to a local PDF file.",
			},
		},
		"required": []string{"path"},
	}
}

func (b *localPdfOcrReadBuiltin) Execute(ctx context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	path := localFileStringArg(arguments, "path")
	if err := localFileRequireAbsolutePath(path, "path"); err != nil {
		return localFileError(err.Error()), nil
	}
	info, err := os.Stat(path)
	if err != nil {
		return localFileError(fmt.Sprintf("failed to access path: %s", err.Error())), nil
	}
	if info.IsDir() {
		return localFileError("path must be a file"), nil
	}
	if strings.ToLower(filepath.Ext(path)) != ".pdf" {
		return localFileError("path must be a PDF file"), nil
	}

	endpoint, err := localFileOcrEndpoint(ctx, b.endpoint)
	if err != nil {
		return localFileError(fmt.Sprintf("failed to start managed OCR service: %s", err.Error())), nil
	}

	text, err := localFilePostPdfOcr(ctx, endpoint, path)
	if err != nil {
		return localFileError(fmt.Sprintf("failed to read PDF through OCR endpoint: %s", err.Error())), nil
	}
	return localFileJSON(localPdfOcrReadResult{
		Path:       path,
		TextLength: len([]rune(text)),
		Text:       text,
	}), nil
}

type localFileScanBuiltin struct {
	lang string
}

func (b *localFileScanBuiltin) GetName() string {
	return "local_file_scan"
}

func (b *localFileScanBuiltin) GetDescription() string {
	return `Scan a local directory recursively and return a JSON manifest of all descendant files and directories.
- root (required): absolute directory path for the current operating system.
- preview_chars: maximum text preview characters per file (default 1200, max 20000). Set to 0 to skip previews.
- Returns items with type, name, path, size, modifiedTime, and a text preview for readable files.`
}

func (b *localFileScanBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"root": map[string]interface{}{
				"type":        "string",
				"description": "Absolute directory path to scan.",
			},
			"preview_chars": map[string]interface{}{
				"type":        "number",
				"description": "Maximum text preview characters per file (default 1200, max 20000). Set to 0 to skip previews.",
			},
		},
		"required": []string{"root"},
	}
}

func (b *localFileScanBuiltin) Execute(_ context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	root := localFileStringArg(arguments, "root")
	if err := localFileRequireAbsolutePath(root, "root"); err != nil {
		return localFileError(err.Error()), nil
	}

	info, err := os.Stat(root)
	if err != nil {
		return localFileError(fmt.Sprintf("failed to access root: %s", err.Error())), nil
	}
	if !info.IsDir() {
		return localFileError("root must be a directory"), nil
	}

	previewChars := localFileIntArg(arguments, "preview_chars", localFileDefaultPreviewChars)
	previewChars = localFileClamp(previewChars, 0, localFileMaxPreviewChars)

	var items []localFileScanItem
	walkErr := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if path == root {
			return nil
		}

		if d.IsDir() {
			items = append(items, localFileScanItem{
				Type: "directory",
				Name: d.Name(),
				Path: path,
			})
			return nil
		}

		item := localFileScanItem{
			Type: "file",
			Name: d.Name(),
			Path: path,
		}
		if fileInfo, statErr := d.Info(); statErr == nil {
			item.Size = fileInfo.Size()
			item.ModifiedTime = fileInfo.ModTime().Format("2006-01-02 15:04:05")
		}
		if previewChars > 0 {
			ext := strings.ToLower(filepath.Ext(path))
			if text, readErr := localFileReadText(path, ext, b.lang); readErr != nil {
				item.Error = readErr.Error()
			} else {
				item.TextLength = len([]rune(text))
				item.Preview, item.Truncated = localFileSliceText(text, 0, previewChars)
			}
		}
		items = append(items, item)
		return nil
	})
	if walkErr != nil {
		return localFileError(fmt.Sprintf("failed to scan root: %s", walkErr.Error())), nil
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].Path < items[j].Path
	})

	return localFileJSON(localFileScanResult{
		Root:  root,
		Count: len(items),
		Items: items,
	}), nil
}

type localFileReadBuiltin struct {
	lang string
}

func (b *localFileReadBuiltin) GetName() string {
	return "local_file_read"
}

func (b *localFileReadBuiltin) GetDescription() string {
	return `Read text from a local file.
- path (required): absolute file path for the current operating system.
- For supported document types, extracts text with the document parser.
- For other files, reads UTF-8 text directly.
- offset: character offset in returned text (default 0).
- limit: maximum characters to return (default 12000, max 100000).`
}

func (b *localFileReadBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"path": map[string]interface{}{
				"type":        "string",
				"description": "Absolute path to a file.",
			},
			"offset": map[string]interface{}{
				"type":        "number",
				"description": "Character offset in returned text (default 0).",
			},
			"limit": map[string]interface{}{
				"type":        "number",
				"description": "Maximum characters to return (default 12000, max 100000).",
			},
		},
		"required": []string{"path"},
	}
}

func (b *localFileReadBuiltin) Execute(_ context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	path := localFileStringArg(arguments, "path")
	if err := localFileRequireAbsolutePath(path, "path"); err != nil {
		return localFileError(err.Error()), nil
	}
	info, err := os.Stat(path)
	if err != nil {
		return localFileError(fmt.Sprintf("failed to access path: %s", err.Error())), nil
	}
	if info.IsDir() {
		return localFileError("path must be a file"), nil
	}
	ext := strings.ToLower(filepath.Ext(path))

	offset := localFileIntArg(arguments, "offset", 0)
	if offset < 0 {
		offset = 0
	}
	limit := localFileIntArg(arguments, "limit", localFileDefaultReadLimit)
	limit = localFileClamp(limit, 0, localFileMaxReadLimit)

	text, err := localFileReadText(path, ext, b.lang)
	if err != nil {
		return localFileError(fmt.Sprintf("failed to read file: %s", err.Error())), nil
	}
	section, truncated := localFileSliceText(text, offset, limit)

	return localFileJSON(localFileReadResult{
		Path:       path,
		Extension:  ext,
		Offset:     offset,
		Limit:      limit,
		TextLength: len([]rune(text)),
		Text:       section,
		Truncated:  truncated,
	}), nil
}

type localFileWriteBuiltin struct{}

func (b *localFileWriteBuiltin) GetName() string {
	return "local_file_write"
}

func (b *localFileWriteBuiltin) GetDescription() string {
	return `Write text content to a local file.
- path (required): absolute output file path for the current operating system.
- content (required): text content to write.
- overwrite: set true to replace an existing file (default false).`
}

func (b *localFileWriteBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"path": map[string]interface{}{
				"type":        "string",
				"description": "Absolute output file path.",
			},
			"content": map[string]interface{}{
				"type":        "string",
				"description": "Text content to write.",
			},
			"overwrite": map[string]interface{}{
				"type":        "boolean",
				"description": "Replace an existing file when true (default false).",
			},
		},
		"required": []string{"path", "content"},
	}
}

func (b *localFileWriteBuiltin) Execute(_ context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	path := localFileStringArg(arguments, "path")
	if err := localFileRequireAbsolutePath(path, "path"); err != nil {
		return localFileError(err.Error()), nil
	}
	content, ok := arguments["content"].(string)
	if !ok {
		return localFileError("missing required parameter: content"), nil
	}
	overwrite := localFileBoolArg(arguments, "overwrite")

	if info, err := os.Stat(path); err == nil && info.IsDir() {
		return localFileError("path must be a file"), nil
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return localFileError(fmt.Sprintf("failed to create parent directory: %s", err.Error())), nil
	}

	overwrote := false
	if overwrite {
		if _, err := os.Stat(path); err == nil {
			overwrote = true
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			return localFileError(fmt.Sprintf("failed to write file: %s", err.Error())), nil
		}
	} else {
		file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
		if err != nil {
			if os.IsExist(err) {
				return localFileError("target file already exists; set overwrite to true to replace it"), nil
			}
			return localFileError(fmt.Sprintf("failed to create file: %s", err.Error())), nil
		}
		if _, err := file.WriteString(content); err != nil {
			_ = file.Close()
			return localFileError(fmt.Sprintf("failed to write file: %s", err.Error())), nil
		}
		if err := file.Close(); err != nil {
			return localFileError(fmt.Sprintf("failed to close file: %s", err.Error())), nil
		}
	}

	return localFileJSON(localFileWriteResult{
		Path:      path,
		ByteSize:  len([]byte(content)),
		Overwrote: overwrote,
	}), nil
}

type localFileMoveBuiltin struct{}

func (b *localFileMoveBuiltin) GetName() string {
	return "local_file_move"
}

func (b *localFileMoveBuiltin) GetDescription() string {
	return `Move one local file after explicit user confirmation.
- source (required): absolute source file path for the current operating system.
- target (required): absolute target file path for the current operating system.
- confirmed (required): must be true; call only after the user explicitly confirms the move plan.
- overwrite: set true to replace an existing target file (default false).`
}

func (b *localFileMoveBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"source": map[string]interface{}{
				"type":        "string",
				"description": "Absolute source file path.",
			},
			"target": map[string]interface{}{
				"type":        "string",
				"description": "Absolute target file path.",
			},
			"confirmed": map[string]interface{}{
				"type":        "boolean",
				"description": "Must be true after explicit user confirmation.",
			},
			"overwrite": map[string]interface{}{
				"type":        "boolean",
				"description": "Replace an existing target file when true (default false).",
			},
		},
		"required": []string{"source", "target", "confirmed"},
	}
}

func (b *localFileMoveBuiltin) Execute(_ context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	if !localFileBoolArg(arguments, "confirmed") {
		return localFileError("confirmed must be true before moving files"), nil
	}
	source := localFileStringArg(arguments, "source")
	target := localFileStringArg(arguments, "target")
	if err := localFileRequireAbsolutePath(source, "source"); err != nil {
		return localFileError(err.Error()), nil
	}
	if err := localFileRequireAbsolutePath(target, "target"); err != nil {
		return localFileError(err.Error()), nil
	}
	if filepath.Clean(source) == filepath.Clean(target) {
		return localFileError("source and target must be different files"), nil
	}

	sourceInfo, err := os.Stat(source)
	if err != nil {
		return localFileError(fmt.Sprintf("failed to access source: %s", err.Error())), nil
	}
	if sourceInfo.IsDir() {
		return localFileError("source must be a file"), nil
	}
	if info, err := os.Stat(target); err == nil && info.IsDir() {
		return localFileError("target must be a file"), nil
	}

	overwrite := localFileBoolArg(arguments, "overwrite")
	targetExists := false
	if _, err := os.Stat(target); err == nil {
		targetExists = true
		if !overwrite {
			return localFileError("target file already exists; set overwrite to true to replace it"), nil
		}
	} else if !os.IsNotExist(err) {
		return localFileError(fmt.Sprintf("failed to access target: %s", err.Error())), nil
	}

	dir := filepath.Dir(target)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return localFileError(fmt.Sprintf("failed to create target directory: %s", err.Error())), nil
	}
	backupPath := ""
	if targetExists {
		backupPath, err = localFileMoveBackupPath(target)
		if err != nil {
			return localFileError(fmt.Sprintf("failed to reserve target backup path: %s", err.Error())), nil
		}
		if err := localFileRename(target, backupPath); err != nil {
			return localFileError(fmt.Sprintf("failed to backup existing target: %s", err.Error())), nil
		}
	}
	if err := localFileRename(source, target); err != nil {
		if backupPath != "" {
			if restoreErr := localFileRename(backupPath, target); restoreErr != nil {
				return localFileError(fmt.Sprintf("failed to move file: %s; failed to restore existing target: %s", err.Error(), restoreErr.Error())), nil
			}
		}
		return localFileError(fmt.Sprintf("failed to move file: %s", err.Error())), nil
	}
	if backupPath != "" {
		if err := localFileRemove(backupPath); err != nil {
			return localFileError(fmt.Sprintf("failed to remove target backup after move: %s", err.Error())), nil
		}
	}

	return localFileJSON(localFileMoveResult{
		Source:    source,
		Target:    target,
		Overwrote: targetExists,
	}), nil
}

func localFileMoveBackupPath(target string) (string, error) {
	dir := filepath.Dir(target)
	base := filepath.Base(target)
	for i := 0; i < 100; i++ {
		path := filepath.Join(dir, fmt.Sprintf(".%s.openagent-move-backup-%d-%d", base, time.Now().UnixNano(), i))
		if _, err := os.Lstat(path); os.IsNotExist(err) {
			return path, nil
		} else if err != nil {
			return "", err
		}
	}
	return "", fmt.Errorf("failed to generate unique backup path for target: %s", target)
}
