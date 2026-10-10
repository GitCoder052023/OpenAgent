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
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
	"github.com/the-open-agent/openagent/conf"
	"github.com/the-open-agent/openagent/embedsupport"
)

type pptxWriteBuiltin struct{}

type pptxWriteArgs struct {
	Path      string          `json:"path"`
	Script    string          `json:"script"`
	AssetsDir string          `json:"assets_dir,omitempty"`
	Data      json.RawMessage `json:"data,omitempty"`
}

type pptxWriteWorkerSpec struct {
	Path       string          `json:"path"`
	ScriptPath string          `json:"script_path"`
	AssetsDir  string          `json:"assets_dir,omitempty"`
	Data       json.RawMessage `json:"data,omitempty"`
}

type pptxWriteWorkerResult struct {
	OK         bool   `json:"ok"`
	Path       string `json:"path"`
	SlideCount int    `json:"slideCount"`
	Mode       string `json:"mode"`
	Error      string `json:"error"`
}

type pptxWorkerCandidate struct {
	path               string
	requireNodeModules bool
}

func (t *pptxWriteBuiltin) GetName() string { return "pptx_write" }

func (t *pptxWriteBuiltin) GetDescription() string {
	return `Create a designed PowerPoint (.pptx) file by running a PptxGenJS build script.
- path (required): output path for the .pptx file. Absolute paths are used as-is. Relative paths or bare filenames are resolved inside the current user's Documents folder.
- script (required): JavaScript module content that exports default async function build(pptx, ctx) or a named build function. The script adds slides to the provided PptxGenJS instance.
- data (optional): JSON value passed to ctx.data inside the script for content or configuration.
- assets_dir (optional): base directory for ctx.resolveAsset() and ctx.imageData() calls.
Creates the file if it does not exist; overwrites otherwise.`
}

func (t *pptxWriteBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"path": map[string]interface{}{
				"type":        "string",
				"description": "Output path for the .pptx file.",
			},
			"script": map[string]interface{}{
				"type":        "string",
				"description": "JavaScript module content exporting default build(pptx, ctx) or named build(pptx, ctx).",
			},
			"data": map[string]interface{}{
				"type":        "object",
				"description": "Optional JSON value passed through to the PptxGenJS script as ctx.data.",
			},
			"assets_dir": map[string]interface{}{
				"type":        "string",
				"description": "Optional asset base directory for ctx.resolveAsset() and ctx.imageData().",
			},
		},
		"required": []string{"path", "script"},
	}
}

// Execute writes the inline build script to a temporary module, then runs the
// local Node/PptxGenJS worker.
func (t *pptxWriteBuiltin) Execute(ctx context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	argBytes, err := json.Marshal(arguments)
	if err != nil {
		return officeToolError(fmt.Sprintf("Failed to parse parameters: %s", err.Error())), nil
	}

	var args pptxWriteArgs
	if err := json.Unmarshal(argBytes, &args); err != nil {
		return officeToolError(fmt.Sprintf("Failed to parse parameters: %s", err.Error())), nil
	}

	args.Path = strings.TrimSpace(args.Path)
	if args.Path == "" {
		return officeToolError("Missing required parameter: path"), nil
	}

	if strings.TrimSpace(args.Script) == "" {
		return officeToolError("Missing required parameter: script"), nil
	}

	args.AssetsDir = strings.TrimSpace(args.AssetsDir)
	if args.AssetsDir != "" {
		if !filepath.IsAbs(args.AssetsDir) {
			args.AssetsDir, err = filepath.Abs(args.AssetsDir)
			if err != nil {
				return officeToolError(fmt.Sprintf("Invalid assets_dir: %s", err.Error())), nil
			}
		}
		assetsInfo, err := os.Stat(args.AssetsDir)
		if err != nil {
			return officeToolError(fmt.Sprintf("Invalid assets_dir: %s", err.Error())), nil
		}
		if !assetsInfo.IsDir() {
			return officeToolError("Invalid assets_dir: must be a directory"), nil
		}
	}

	nodePath, err := exec.LookPath("node")
	if err != nil {
		return officeToolError("Node.js was not found; install Node.js to enable PowerPoint generation"), nil
	}
	workerPath, err := findPptxWorkerPath(ctx)
	if err != nil {
		return officeToolError(err.Error()), nil
	}

	args.Path = ResolveOutputPath(args.Path)

	scriptFile, err := os.CreateTemp("", "openagent-pptx-build-*.mjs")
	if err != nil {
		return officeToolError(fmt.Sprintf("Failed to create build script: %s", err.Error())), nil
	}
	scriptPath := scriptFile.Name()
	defer os.Remove(scriptPath)

	if _, err := scriptFile.WriteString(args.Script); err != nil {
		scriptFile.Close()
		return officeToolError(fmt.Sprintf("Failed to write build script: %s", err.Error())), nil
	}
	if err := scriptFile.Close(); err != nil {
		return officeToolError(fmt.Sprintf("Failed to close build script: %s", err.Error())), nil
	}

	spec := pptxWriteWorkerSpec{
		Path:       args.Path,
		ScriptPath: scriptPath,
		AssetsDir:  args.AssetsDir,
		Data:       args.Data,
	}

	// Pass the job to Node through a temp JSON file so nested data does not
	// need fragile command-line escaping. The final PPTX is not temporary.
	specFile, err := os.CreateTemp("", "openagent-pptx-*.json")
	if err != nil {
		return officeToolError(fmt.Sprintf("Failed to create worker spec: %s", err.Error())), nil
	}
	defer os.Remove(specFile.Name())

	if err := json.NewEncoder(specFile).Encode(spec); err != nil {
		specFile.Close()
		return officeToolError(fmt.Sprintf("Failed to write worker spec: %s", err.Error())), nil
	}
	if err := specFile.Close(); err != nil {
		return officeToolError(fmt.Sprintf("Failed to close worker spec: %s", err.Error())), nil
	}

	var stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, nodePath, workerPath, specFile.Name())
	// Run from the worker directory so source workers can resolve local node_modules.
	// Bundled and embedded workers do not need node_modules at runtime.
	cmd.Dir = filepath.Dir(workerPath)
	cmd.Stderr = &stderr
	output, err := cmd.Output()
	if err != nil {
		var workerResult pptxWriteWorkerResult
		if len(bytes.TrimSpace(output)) > 0 && json.Unmarshal(bytes.TrimSpace(output), &workerResult) == nil && workerResult.Error != "" {
			return officeToolError(fmt.Sprintf("Failed to write PowerPoint file: %s", workerResult.Error)), nil
		}

		detail := strings.TrimSpace(stderr.String())
		if detail == "" {
			detail = err.Error()
		}
		return officeToolError(fmt.Sprintf("Failed to run PowerPoint worker: %s", detail)), nil
	}

	var workerResult pptxWriteWorkerResult
	if err := json.Unmarshal(bytes.TrimSpace(output), &workerResult); err != nil {
		return officeToolError(fmt.Sprintf("Failed to parse PowerPoint worker output: %s", err.Error())), nil
	}
	if !workerResult.OK {
		return officeToolError(fmt.Sprintf("Failed to write PowerPoint file: %s", workerResult.Error)), nil
	}

	return officeToolText(fmt.Sprintf(
		"Successfully wrote PowerPoint file: %s\n%d slide(s) written",
		workerResult.Path, workerResult.SlideCount,
	)), nil
}

func findPptxWorkerPath(ctx context.Context) (string, error) {
	var candidates []pptxWorkerCandidate
	if exeDir, err := pptxExecutableDir(); err == nil {
		candidates = append(candidates,
			pptxWorkerCandidate{path: filepath.Join(exeDir, "pptx-worker", "worker.bundle.mjs")},
			pptxWorkerCandidate{path: filepath.Join(exeDir, "pptx-worker", "worker.mjs")},
		)
	}
	candidates = append(candidates,
		pptxWorkerCandidate{path: conf.GetSharedPath(filepath.Join("tool", "pptx-worker", "worker.mjs")), requireNodeModules: true},
		pptxWorkerCandidate{path: filepath.Join("pptx-worker", "worker.mjs"), requireNodeModules: true},
		pptxWorkerCandidate{path: conf.GetSharedPath(filepath.Join("tool", "pptx-worker", "worker.bundle.mjs"))},
		pptxWorkerCandidate{path: filepath.Join("pptx-worker", "worker.bundle.mjs")},
	)

	for _, candidate := range candidates {
		workerInfo, err := os.Stat(candidate.path)
		if err != nil {
			continue
		}
		if workerInfo.IsDir() {
			continue
		}
		absPath, err := filepath.Abs(candidate.path)
		if err != nil {
			absPath = candidate.path
		}
		if candidate.requireNodeModules {
			if err := ensureSourcePptxWorkerReady(ctx, absPath); err != nil {
				return "", err
			}
		}
		return absPath, nil
	}

	embeddedWorker := embedsupport.PptxWorkerFS()
	if embeddedWorker != nil {
		exeDir, err := pptxExecutableDir()
		if err != nil {
			return "", err
		}
		return writeEmbeddedPptxWorker(embeddedWorker, exeDir)
	}

	return "", fmt.Errorf("PowerPoint worker not found next to the executable or in tool/pptx-worker; build with -tags embed or place worker.bundle.mjs or worker.mjs in pptx-worker")
}

func ensureSourcePptxWorkerReady(ctx context.Context, workerPath string) error {
	if sourcePptxWorkerReady(workerPath) {
		return nil
	}

	npmPath, err := exec.LookPath("npm")
	if err != nil {
		return fmt.Errorf("npm was not found; run npm ci --prefix tool/pptx-worker or install npm")
	}

	workerDir := filepath.Dir(workerPath)
	cmd := exec.CommandContext(ctx, npmPath, "ci")
	cmd.Dir = workerDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		detail := strings.TrimSpace(string(output))
		if detail == "" {
			detail = err.Error()
		}
		return fmt.Errorf("Failed to install PowerPoint worker dependencies with npm ci in %s: %s", workerDir, detail)
	}

	if !sourcePptxWorkerReady(workerPath) {
		return fmt.Errorf("PowerPoint worker dependencies are still missing after npm ci in %s", workerDir)
	}
	return nil
}

func sourcePptxWorkerReady(workerPath string) bool {
	workerDir := filepath.Dir(workerPath)
	for _, dep := range []string{
		filepath.Join("node_modules", "pptxgenjs"),
		filepath.Join("node_modules", "@fortawesome", "free-solid-svg-icons"),
	} {
		info, err := os.Stat(filepath.Join(workerDir, dep))
		if err != nil || !info.IsDir() {
			return false
		}
	}
	return true
}

// writeEmbeddedPptxWorker extracts the bundled worker script to
// <rootDir>/pptx-worker/worker.mjs the first time it is needed.
// On the next call to findPptxWorkerPath the extracted file is found in the
// exe-dir candidates list before this function is ever reached, so the write
// effectively happens only once (until the file is removed or the binary is
// replaced).
func writeEmbeddedPptxWorker(source fs.FS, rootDir string) (string, error) {
	data, err := fs.ReadFile(source, "worker.bundle.mjs")
	if err != nil {
		return "", fmt.Errorf("Failed to read embedded PowerPoint worker: %s", err.Error())
	}

	workerPath := filepath.Join(rootDir, "pptx-worker", "worker.mjs")
	if err = os.MkdirAll(filepath.Dir(workerPath), 0o755); err != nil {
		return "", fmt.Errorf("Failed to prepare embedded PowerPoint worker: %s", err.Error())
	}
	if err = os.WriteFile(workerPath, data, 0o644); err != nil {
		return "", fmt.Errorf("Failed to write embedded PowerPoint worker: %s", err.Error())
	}
	return workerPath, nil
}

func pptxExecutableDir() (string, error) {
	exePath, err := os.Executable()
	if err == nil {
		return filepath.Dir(exePath), nil
	}
	wd, wdErr := os.Getwd()
	if wdErr != nil {
		return "", err
	}
	return wd, nil
}
