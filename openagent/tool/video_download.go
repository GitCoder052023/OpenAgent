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
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
	"github.com/the-open-agent/openagent/proxy"
)

// VideoDownloadTool is the Tool Type "video_download".
type VideoDownloadTool struct {
	ytDlpPath string
}

func NewVideoDownloadTool(_ Config) (*VideoDownloadTool, error) {
	ytDlpPath, err := resolveYtDlpPath()
	if err != nil {
		return nil, err
	}
	return &VideoDownloadTool{ytDlpPath: ytDlpPath}, nil
}

func (p *VideoDownloadTool) BuiltinTools() []BuiltinTool {
	return []BuiltinTool{
		&videoDownloadBuiltin{ytDlpPath: p.ytDlpPath},
		&videoInfoBuiltin{ytDlpPath: p.ytDlpPath},
		&videoAudioExtractBuiltin{ytDlpPath: p.ytDlpPath},
	}
}

// ytDlpProxyArgs returns --proxy args if a socks5 proxy is configured and reachable.
func ytDlpProxyArgs() []string {
	addr := proxy.GetSocks5ProxyAddress()
	if addr == "" {
		return nil
	}
	conn, err := net.DialTimeout("tcp", addr, 200*time.Millisecond)
	if err != nil {
		return nil
	}
	conn.Close()
	return []string{"--proxy", "socks5://" + addr}
}

// runYtDlp executes yt-dlp with the given arguments and returns stdout/stderr.
func runYtDlp(ctx context.Context, ytDlpPath string, args []string) (string, string, error) {
	allArgs := append(ytDlpProxyArgs(), args...)
	cmd := exec.CommandContext(ctx, ytDlpPath, allArgs...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	return stdout.String(), stderr.String(), err
}

var ytDlpDownloadMu sync.Mutex

func resolveYtDlpPath() (string, error) {
	if path, err := exec.LookPath("yt-dlp"); err == nil {
		return path, nil
	}
	return ensureManagedYtDlp()
}

func ensureManagedYtDlp() (string, error) {
	ytDlpDownloadMu.Lock()
	defer ytDlpDownloadMu.Unlock()

	if path, err := exec.LookPath("yt-dlp"); err == nil {
		return path, nil
	}

	assetName, err := ytDlpReleaseAssetName()
	if err != nil {
		return "", err
	}
	cacheDir, err := os.UserCacheDir()
	if err != nil {
		return "", fmt.Errorf("failed to locate user cache directory for yt-dlp install: %w", err)
	}
	if cacheDir == "" {
		return "", fmt.Errorf("failed to locate user cache directory for yt-dlp install")
	}

	installDir := filepath.Join(cacheDir, "openagent", "yt-dlp")
	executableName := "yt-dlp"
	if runtime.GOOS == "windows" {
		executableName = "yt-dlp.exe"
	}
	executablePath := filepath.Join(installDir, executableName)
	if fileExists(executablePath) {
		if runtime.GOOS != "windows" {
			_ = os.Chmod(executablePath, 0o755)
		}
		return executablePath, nil
	}

	downloadURL := fmt.Sprintf("https://github.com/yt-dlp/yt-dlp/releases/latest/download/%s", assetName)
	if err = downloadYtDlpBinary(downloadURL, executablePath); err != nil {
		return "", err
	}
	if runtime.GOOS != "windows" {
		if err = os.Chmod(executablePath, 0o755); err != nil {
			return "", fmt.Errorf("failed to mark yt-dlp executable as runnable: %w", err)
		}
	}
	return executablePath, nil
}

func ytDlpReleaseAssetName() (string, error) {
	switch runtime.GOOS {
	case "linux":
		return "yt-dlp_linux", nil
	case "darwin":
		return "yt-dlp_macos", nil
	case "windows":
		return "yt-dlp.exe", nil
	default:
		return "", fmt.Errorf("yt-dlp managed install is not supported on %s", runtime.GOOS)
	}
}

func downloadYtDlpBinary(downloadURL, executablePath string) error {
	if err := os.MkdirAll(filepath.Dir(executablePath), 0o755); err != nil {
		return fmt.Errorf("failed to create yt-dlp install directory: %w", err)
	}

	client := &http.Client{
		Transport: proxy.GetHttpClient(downloadURL).Transport,
		Timeout:   5 * time.Minute,
	}
	resp, err := client.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("failed to download yt-dlp from %s: %w", downloadURL, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("failed to download yt-dlp from %s: HTTP %d", downloadURL, resp.StatusCode)
	}

	tmpPath := executablePath + ".tmp"
	_ = os.Remove(tmpPath)
	out, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("failed to create yt-dlp binary %s: %w", tmpPath, err)
	}
	written, copyErr := io.Copy(out, resp.Body)
	closeErr := out.Close()
	if copyErr != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("failed to write yt-dlp binary %s: %w", tmpPath, copyErr)
	}
	if closeErr != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("failed to close yt-dlp binary %s: %w", tmpPath, closeErr)
	}
	if resp.ContentLength > 0 && written != resp.ContentLength {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("yt-dlp download was incomplete: got %d bytes, expected %d", written, resp.ContentLength)
	}
	if err = os.Rename(tmpPath, executablePath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("failed to move yt-dlp binary to %s: %w", executablePath, err)
	}
	return nil
}

// buildResult constructs a CallToolResult from yt-dlp output.
func buildYtDlpResult(stdout, stderr string, runErr error) *protocol.CallToolResult {
	if runErr != nil {
		var parts []string
		parts = append(parts, fmt.Sprintf("Error: %s", runErr.Error()))
		if stderr != "" {
			parts = append(parts, fmt.Sprintf("Stderr:\n%s", stderr))
		}
		if stdout != "" {
			parts = append(parts, fmt.Sprintf("Stdout:\n%s", stdout))
		}
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: strings.Join(parts, "\n")},
			},
		}
	}

	result := stdout
	if stderr != "" {
		if result != "" {
			result = fmt.Sprintf("%s\nStderr:\n%s", result, stderr)
		} else {
			result = fmt.Sprintf("Stderr:\n%s", stderr)
		}
	}
	if result == "" {
		result = "(no output)"
	}
	return &protocol.CallToolResult{
		IsError: false,
		Content: []protocol.Content{
			&protocol.TextContent{Type: "text", Text: result},
		},
	}
}

// ─── video_download ───────────────────────────────────────────────────────────

type videoDownloadBuiltin struct {
	ytDlpPath string
}

func (v *videoDownloadBuiltin) GetName() string { return "video_download" }

func (v *videoDownloadBuiltin) GetDescription() string {
	return `Download a video using yt-dlp.
- url (required): URL of the video to download (YouTube, Bilibili, Twitter, etc.).
- output_dir: directory to save the downloaded file (default: current directory).
- format: yt-dlp format selector, e.g. "bestvideo+bestaudio", "best", "mp4" (default: "bestvideo+bestaudio/best").
- filename: output filename template (default: "%(title)s.%(ext)s").
- timeout: operation timeout in seconds (default: 300).`
}

func (v *videoDownloadBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"url": map[string]interface{}{
				"type":        "string",
				"description": "URL of the video to download.",
			},
			"output_dir": map[string]interface{}{
				"type":        "string",
				"description": "Directory to save the downloaded file.",
			},
			"format": map[string]interface{}{
				"type":        "string",
				"description": "yt-dlp format selector (default: bestvideo+bestaudio/best).",
			},
			"filename": map[string]interface{}{
				"type":        "string",
				"description": "Output filename template (default: %(title)s.%(ext)s).",
			},
			"timeout": map[string]interface{}{
				"type":        "number",
				"description": "Operation timeout in seconds (default: 300).",
			},
		},
		"required": []string{"url"},
	}
}

func (v *videoDownloadBuiltin) Execute(ctx context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	url, ok := arguments["url"].(string)
	if !ok || strings.TrimSpace(url) == "" {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: "Missing required parameter: url"},
			},
		}, nil
	}

	timeoutSecs := 300.0
	if t, ok := arguments["timeout"].(float64); ok && t > 0 {
		timeoutSecs = t
	}

	format := "bestvideo+bestaudio/best"
	if f, ok := arguments["format"].(string); ok && f != "" {
		format = f
	}

	filename := "%(title)s.%(ext)s"
	if fn, ok := arguments["filename"].(string); ok && fn != "" {
		filename = fn
	}

	args := []string{
		"--no-playlist",
		"-f", format,
		"-o", filename,
	}

	if dir, ok := arguments["output_dir"].(string); ok && dir != "" {
		args = append(args, "-P", dir)
	}

	args = append(args, "--merge-output-format", "mp4")
	args = append(args, url)

	execCtx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSecs)*time.Second)
	defer cancel()

	stdout, stderr, err := runYtDlp(execCtx, v.ytDlpPath, args)
	return buildYtDlpResult(stdout, stderr, err), nil
}

// ─── video_info ───────────────────────────────────────────────────────────────

type videoInfoBuiltin struct {
	ytDlpPath string
}

func (v *videoInfoBuiltin) GetName() string { return "video_info" }

func (v *videoInfoBuiltin) GetDescription() string {
	return `Retrieve metadata/info for a video URL using yt-dlp (no download).
- url (required): URL of the video.
- timeout: operation timeout in seconds (default: 60).`
}

func (v *videoInfoBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"url": map[string]interface{}{
				"type":        "string",
				"description": "URL of the video.",
			},
			"timeout": map[string]interface{}{
				"type":        "number",
				"description": "Operation timeout in seconds (default: 60).",
			},
		},
		"required": []string{"url"},
	}
}

func (v *videoInfoBuiltin) Execute(ctx context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	url, ok := arguments["url"].(string)
	if !ok || strings.TrimSpace(url) == "" {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: "Missing required parameter: url"},
			},
		}, nil
	}

	timeoutSecs := 60.0
	if t, ok := arguments["timeout"].(float64); ok && t > 0 {
		timeoutSecs = t
	}

	args := []string{
		"--dump-json",
		"--no-playlist",
		url,
	}

	execCtx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSecs)*time.Second)
	defer cancel()

	stdout, stderr, err := runYtDlp(execCtx, v.ytDlpPath, args)
	return buildYtDlpResult(stdout, stderr, err), nil
}

// ─── video_audio_extract ──────────────────────────────────────────────────────

type videoAudioExtractBuiltin struct {
	ytDlpPath string
}

func (v *videoAudioExtractBuiltin) GetName() string { return "video_audio_extract" }

func (v *videoAudioExtractBuiltin) GetDescription() string {
	return `Download and extract audio from a video URL using yt-dlp.
- url (required): URL of the video.
- output_dir: directory to save the audio file (default: current directory).
- audio_format: output audio format, e.g. "mp3", "m4a", "wav", "opus" (default: "mp3").
- audio_quality: audio quality for mp3 (0 best – 9 worst, default: "0").
- filename: output filename template (default: "%(title)s.%(ext)s").
- timeout: operation timeout in seconds (default: 300).`
}

func (v *videoAudioExtractBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"url": map[string]interface{}{
				"type":        "string",
				"description": "URL of the video.",
			},
			"output_dir": map[string]interface{}{
				"type":        "string",
				"description": "Directory to save the audio file.",
			},
			"audio_format": map[string]interface{}{
				"type":        "string",
				"description": "Output audio format: mp3, m4a, wav, opus (default: mp3).",
			},
			"audio_quality": map[string]interface{}{
				"type":        "string",
				"description": "Audio quality for mp3, 0 (best) to 9 (worst), default: 0.",
			},
			"filename": map[string]interface{}{
				"type":        "string",
				"description": "Output filename template (default: %(title)s.%(ext)s).",
			},
			"timeout": map[string]interface{}{
				"type":        "number",
				"description": "Operation timeout in seconds (default: 300).",
			},
		},
		"required": []string{"url"},
	}
}

func (v *videoAudioExtractBuiltin) Execute(ctx context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	url, ok := arguments["url"].(string)
	if !ok || strings.TrimSpace(url) == "" {
		return &protocol.CallToolResult{
			IsError: true,
			Content: []protocol.Content{
				&protocol.TextContent{Type: "text", Text: "Missing required parameter: url"},
			},
		}, nil
	}

	timeoutSecs := 300.0
	if t, ok := arguments["timeout"].(float64); ok && t > 0 {
		timeoutSecs = t
	}

	audioFormat := "mp3"
	if af, ok := arguments["audio_format"].(string); ok && af != "" {
		audioFormat = af
	}

	audioQuality := "0"
	if aq, ok := arguments["audio_quality"].(string); ok && aq != "" {
		audioQuality = aq
	}

	filename := "%(title)s.%(ext)s"
	if fn, ok := arguments["filename"].(string); ok && fn != "" {
		filename = fn
	}

	args := []string{
		"--no-playlist",
		"-x",
		"--audio-format", audioFormat,
		"--audio-quality", audioQuality,
		"-o", filename,
	}

	if dir, ok := arguments["output_dir"].(string); ok && dir != "" {
		args = append(args, "-P", dir)
	}

	args = append(args, url)

	execCtx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSecs)*time.Second)
	defer cancel()

	stdout, stderr, err := runYtDlp(execCtx, v.ytDlpPath, args)
	return buildYtDlpResult(stdout, stderr, err), nil
}
