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
	"context"
	"fmt"
	"mime"
	"os"
	"path/filepath"
	"strings"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
	"github.com/the-open-agent/openagent/tool"
	"github.com/the-open-agent/openagent/util"
)

type generatedResourceArchiveBuiltinTool struct {
	inner  tool.BuiltinTool
	owner  string
	user   string
	origin string
}

var archiveGeneratedResourceFile = func(owner, user, path, origin string) (*Resource, error) {
	return archiveGeneratedResourceFileToStorage(owner, user, path, origin)
}

func wrapGeneratedResourceBuiltin(builtin tool.BuiltinTool, owner, user, origin string) tool.BuiltinTool {
	if builtin == nil {
		return nil
	}
	if !isGeneratedResourceTool(builtin.GetName()) {
		return builtin
	}
	return &generatedResourceArchiveBuiltinTool{inner: builtin, owner: owner, user: user, origin: origin}
}

func isGeneratedResourceTool(toolName string) bool {
	switch toolName {
	case "pptx_write", "pptx_template_fill", "word_write", "excel_write", "local_file_write":
		return true
	default:
		return false
	}
}

func (t *generatedResourceArchiveBuiltinTool) GetName() string {
	return t.inner.GetName()
}

func (t *generatedResourceArchiveBuiltinTool) GetDescription() string {
	return t.inner.GetDescription()
}

func (t *generatedResourceArchiveBuiltinTool) GetInputSchema() interface{} {
	return t.inner.GetInputSchema()
}

func (t *generatedResourceArchiveBuiltinTool) Execute(ctx context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	result, innerErr := t.inner.Execute(ctx, arguments)
	if innerErr != nil || result == nil || result.IsError {
		return result, innerErr
	}

	path, ok := generatedResourceTargetPath(t.GetName(), arguments)
	if !ok {
		return result, innerErr
	}

	resource, err := archiveGeneratedResourceFile(t.owner, t.user, path, t.origin)
	if err != nil {
		appendGeneratedResourceArchiveText(result, fmt.Sprintf("Resource archive warning: file was created but could not be saved to Resources: %s", err.Error()))
		return result, innerErr
	}
	if resource == nil {
		appendGeneratedResourceArchiveText(result, "Resource archive warning: file was created but no Resource record was returned")
		return result, innerErr
	}

	appendGeneratedResourceArchiveText(result, fmt.Sprintf("Saved to Resources: %s", resource.Url))
	result.Content = append(result.Content, &protocol.ResourceLink{
		Type:     "resource_link",
		URI:      resource.Url,
		Name:     resource.FileName,
		MIMEType: mime.TypeByExtension(resource.FileFormat),
	})
	return result, innerErr
}

func generatedResourceTargetPath(toolName string, arguments map[string]interface{}) (string, bool) {
	if !isGeneratedResourceTool(toolName) {
		return "", false
	}
	path := resourceArchiveStringArg(arguments, "path")
	if path == "" {
		return "", false
	}
	return filepath.Clean(tool.ResolveOutputPath(path)), true
}

func resourceArchiveStringArg(arguments map[string]interface{}, key string) string {
	value, _ := arguments[key].(string)
	return strings.TrimSpace(value)
}

func archiveGeneratedResourceFileToStorage(owner, user, path, origin string) (*Resource, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return nil, fmt.Errorf("path is a directory: %s", path)
	}

	fileBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	fileName := filepath.Base(path)
	if fileName == "." || fileName == string(os.PathSeparator) || fileName == "" {
		fileName = "generated_file"
	}
	ext := strings.ToLower(filepath.Ext(fileName))
	fileType := getGeneratedResourceFileType(ext)
	storageName := fmt.Sprintf(
		"openagent/resources/generated/%s_%s",
		util.GetRandomName(),
		resourceArchiveSafePathSegment(fileName),
	)

	fileUrl, err := UploadFileToStorageSafe(storageName, fileBytes, origin, "")
	if err != nil {
		return nil, err
	}

	resource := NewResourceFromUpload(owner, user, "generated", fileName, fileType, ext, fileUrl, storageName, len(fileBytes), "", "")
	if _, err = AddResource(resource); err != nil {
		return nil, err
	}
	return resource, nil
}

func getGeneratedResourceFileType(ext string) string {
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		return "unknown"
	}
	parts := strings.SplitN(mimeType, "/", 2)
	if len(parts) == 0 || parts[0] == "" {
		return "unknown"
	}
	return parts[0]
}

func resourceArchiveSafePathSegment(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "unknown"
	}
	return strings.Map(func(r rune) rune {
		switch r {
		case '/', '\\', 0:
			return '_'
		default:
			return r
		}
	}, value)
}

func appendGeneratedResourceArchiveText(result *protocol.CallToolResult, text string) {
	if result == nil || text == "" {
		return
	}
	result.Content = append(result.Content, &protocol.TextContent{Type: "text", Text: text})
}
