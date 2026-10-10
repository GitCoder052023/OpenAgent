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
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
	office "github.com/the-open-agent/office-tool-use"
	officemodel "github.com/the-open-agent/office-tool-use/model"
	"github.com/the-open-agent/office-tool-use/ooxml"
)

const (
	pptxTemplateDownloadLimit = 100 << 20
)

type (
	pptxTemplateAnalyzeBuiltin struct{}
	pptxTemplateFillBuiltin    struct{}
)

type pptxTemplateAnalyzeArgs struct {
	Template string `json:"template"`
}

type pptxTemplateFillArgs struct {
	Template           string          `json:"template"`
	Path               string          `json:"path"`
	Plan               json.RawMessage `json:"plan"`
	Transition         string          `json:"transition,omitempty"`
	TransitionDuration float64         `json:"transition_duration,omitempty"`
}

func (t *pptxTemplateAnalyzeBuiltin) GetName() string { return "pptx_template_analyze" }

func (t *pptxTemplateAnalyzeBuiltin) GetDescription() string {
	return `Analyze a user-provided PowerPoint template before filling it.
- template (required): local .pptx path or an HTTP(S) URL from a chat attachment.
Returns template_fill_pptx_library.v1 JSON with slide types, text slot IDs, image IDs, table IDs, chart IDs, SmartArt IDs and node IDs, SmartArt resize structure/groups, geometry, capacity metrics, and a plan contract. Use the returned IDs to build a template_fill_pptx_plan.v1 plan, then call pptx_template_fill.`
}

func (t *pptxTemplateAnalyzeBuiltin) GetInputSchema() interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"template": map[string]interface{}{
				"type":        "string",
				"description": "Local .pptx path or HTTP(S) chat attachment URL.",
			},
		},
		"required": []string{"template"},
	}
}

func (t *pptxTemplateAnalyzeBuiltin) Execute(ctx context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	var args pptxTemplateAnalyzeArgs
	if result := decodePptxTemplateArguments(arguments, &args); result != nil {
		return result, nil
	}
	args.Template = strings.TrimSpace(args.Template)
	if args.Template == "" {
		return officeToolError("Missing required parameter: template"), nil
	}

	templatePath, cleanup, err := resolvePptxTemplate(ctx, args.Template)
	if err != nil {
		return officeToolError(fmt.Sprintf("Failed to open PowerPoint template: %s", err.Error())), nil
	}
	defer cleanup()

	library, err := office.AnalyzeFile(templatePath, ooxml.DefaultLimits())
	if err != nil {
		return officeToolError(fmt.Sprintf("Failed to analyze PowerPoint template: %s", err.Error())), nil
	}

	data, err := json.MarshalIndent(library, "", "  ")
	if err != nil {
		return officeToolError(fmt.Sprintf("Failed to encode template analysis: %s", err.Error())), nil
	}
	return officeToolText(string(data)), nil
}

func (t *pptxTemplateFillBuiltin) GetName() string { return "pptx_template_fill" }

func (t *pptxTemplateFillBuiltin) GetDescription() string {
	return `Create a new PowerPoint file by deterministically filling and reusing slides from an existing template.
- Call pptx_template_analyze first and use its exact slide, slot, table, chart, image, SmartArt, and SmartArt node IDs.
- template: local .pptx path or HTTP(S) chat attachment URL.
- path: exact output .pptx path; relative paths resolve to the user's Documents folder.
- plan: template_fill_pptx_plan.v1 object. Slides may be selected, repeated, and reordered. Each slide supports replacements, table_edits, chart_edits, image_edits, smartart_edits, and notes.
- The output contains exactly plan.slides in order. To edit a few pages while preserving the rest, include every source slide from the analysis and leave unchanged slides with only source_slide/purpose.
- image_edits: each edit needs an image_id and image_path (local PNG/JPEG path or HTTP(S) URL). Only PNG and JPEG are supported. Replacing an image preserves the template picture frame's position, size, rotation, cropping, and styles without recomputing the aspect ratio.
- smartart_edits: each edit targets an existing SmartArt from analysis by smartart_id, shape_id, or shape_name. Use nodes to replace node text by node_id or array order. If analysis returns resizable=true, set resize=true and provide the complete desired node list by array order to append/delete tail nodes. For parent/child SmartArt layouts, prefer structure_ops: add_child adds one child under parent_node_id, and add_root adds one empty root-level parent. Resizing or structure_ops remove the cached SmartArt drawing so PowerPoint recalculates it when opened. Empty text intentionally clears a node.
- Do not insert manual line breaks into titles unless they are intentional; single-line template titles are auto-fitted by default.
- Keep replacement text concise and respect capacity warnings. New text/image or text/text collisions are validation errors: shorten the content or choose another template slide.
- transition defaults to "keep", preserving source transitions and object animations.
The plan is checked before writing. Missing targets, invalid chart data, and new object collisions stop generation; capacity warnings are returned with the successful result.`
}

func (t *pptxTemplateFillBuiltin) GetInputSchema() interface{} {
	stringProperty := func(description string) map[string]interface{} {
		return map[string]interface{}{"type": "string", "description": description}
	}
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"template": stringProperty("Local .pptx path or HTTP(S) chat attachment URL."),
			"path":     stringProperty("Exact output path for the generated .pptx file."),
			"plan": map[string]interface{}{
				"type":        "object",
				"description": "A template_fill_pptx_plan.v1 plan built from pptx_template_analyze output.",
				"properties": map[string]interface{}{
					"schema":      map[string]interface{}{"type": "string", "const": "template_fill_pptx_plan.v1"},
					"source_pptx": stringProperty("Ignored for security; the template argument is always used."),
					"slides": map[string]interface{}{
						"type":     "array",
						"minItems": 1,
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"source_slide": map[string]interface{}{"type": "integer", "minimum": 1},
								"purpose":      stringProperty("Optional semantic purpose."),
								"replacements": map[string]interface{}{
									"type": "array",
									"items": map[string]interface{}{
										"type": "object",
										"properties": map[string]interface{}{
											"slot_id": stringProperty("Text slot ID from analysis."),
											"text":    stringProperty("Replacement text."),
											"preserve_line_breaks": map[string]interface{}{
												"type":        "boolean",
												"description": "Preserve explicit line breaks in a title. Defaults to false for single-line title slots.",
												"default":     false,
											},
										},
										"required": []string{"slot_id", "text"},
									},
								},
								"table_edits": map[string]interface{}{
									"type": "array",
									"items": map[string]interface{}{
										"type": "object",
										"properties": map[string]interface{}{
											"table_id": stringProperty("Table ID from analysis."),
											"cells": map[string]interface{}{
												"type": "array",
												"items": map[string]interface{}{
													"type": "object",
													"properties": map[string]interface{}{
														"row":  map[string]interface{}{"type": "integer", "minimum": 0},
														"col":  map[string]interface{}{"type": "integer", "minimum": 0},
														"text": stringProperty("Replacement cell text."),
													},
													"required": []string{"row", "col", "text"},
												},
											},
										},
										"required": []string{"table_id", "cells"},
									},
								},
								"chart_edits": map[string]interface{}{
									"type": "array",
									"items": map[string]interface{}{
										"type": "object",
										"properties": map[string]interface{}{
											"chart_id":   stringProperty("Chart ID from analysis."),
											"categories": map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
											"series": map[string]interface{}{
												"type": "array",
												"items": map[string]interface{}{
													"type": "object",
													"properties": map[string]interface{}{
														"name":   stringProperty("Series name."),
														"values": map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "number"}},
													},
													"required": []string{"name", "values"},
												},
											},
										},
										"required": []string{"chart_id", "categories", "series"},
									},
								},
								"image_edits": map[string]interface{}{
									"type": "array",
									"items": map[string]interface{}{
										"type": "object",
										"properties": map[string]interface{}{
											"image_id": stringProperty("Image ID from template analysis."),
											"image_path": stringProperty(
												"Local PNG/JPEG path or HTTP(S) image URL.",
											),
										},
										"required": []string{"image_id", "image_path"},
									},
								},
								"smartart_edits": map[string]interface{}{
									"type": "array",
									"items": map[string]interface{}{
										"type": "object",
										"properties": map[string]interface{}{
											"smartart_id": stringProperty("SmartArt ID from template analysis. Prefer this selector when available."),
											"shape_id":    stringProperty("Optional SmartArt shape ID from template analysis."),
											"shape_name":  stringProperty("Optional SmartArt shape name from template analysis."),
											"optional": map[string]interface{}{
												"type":        "boolean",
												"description": "Skip this SmartArt edit if the target is absent. Defaults to false.",
												"default":     false,
											},
											"resize": map[string]interface{}{
												"type":        "boolean",
												"description": "When the analyzed SmartArt has resizable=true, use the nodes array as the complete desired node list and append/delete only tail nodes. Defaults to false.",
												"default":     false,
											},
											"nodes": map[string]interface{}{
												"type": "array",
												"items": map[string]interface{}{
													"type": "object",
													"properties": map[string]interface{}{
														"node_id": stringProperty("Optional SmartArt node ID from analysis. If omitted, nodes are matched by array order."),
														"text":    stringProperty("Replacement node text. An empty string clears the node."),
														"paragraphs": map[string]interface{}{
															"type":        "array",
															"description": "Optional replacement paragraphs. Overrides text when present; an empty array clears the node.",
															"items":       map[string]interface{}{"type": "string"},
														},
														"optional": map[string]interface{}{
															"type":        "boolean",
															"description": "Skip this node edit if the node is absent. Defaults to false.",
															"default":     false,
														},
													},
												},
											},
											"structure_ops": map[string]interface{}{
												"type":        "array",
												"description": "Optional structure operations for resizable parent/child SmartArt. Use add_child to add exactly one child under parent_node_id; use add_root to add exactly one root-level parent with no children.",
												"items": map[string]interface{}{
													"type": "object",
													"properties": map[string]interface{}{
														"op":             stringProperty("Structure operation: add_child or add_root."),
														"parent_node_id": stringProperty("Required for add_child. Must be a root_node_id from analysis structure.groups."),
														"text":           stringProperty("Text for the newly created node. An empty string creates an empty node."),
														"paragraphs": map[string]interface{}{
															"type":        "array",
															"description": "Optional paragraphs for the newly created node. Overrides text when present.",
															"items":       map[string]interface{}{"type": "string"},
														},
														"optional": map[string]interface{}{
															"type":        "boolean",
															"description": "Skip this structure operation if it cannot be applied. Defaults to false.",
															"default":     false,
														},
													},
													"required": []string{"op"},
												},
											},
										},
									},
								},
								"notes":      stringProperty("Speaker notes for the generated slide."),
								"transition": stringProperty("Optional per-slide transition; keep preserves the source."),
								"transition_duration": map[string]interface{}{
									"type":        "number",
									"description": "Optional per-slide transition duration in seconds.",
									"minimum":     0,
								},
								"advance_after": map[string]interface{}{
									"type":        "number",
									"description": "Optional automatic slide advance delay in seconds.",
									"minimum":     0,
								},
							},
							"required": []string{"source_slide"},
						},
					},
				},
				"required": []string{"schema", "slides"},
			},
			"transition": map[string]interface{}{
				"type":        "string",
				"description": "Default slide transition. Use keep to preserve the source transition.",
				"default":     "keep",
			},
			"transition_duration": map[string]interface{}{
				"type":        "number",
				"description": "Default transition duration in seconds when setting a transition.",
				"minimum":     0,
				"default":     0.5,
			},
		},
		"required": []string{"template", "path", "plan"},
	}
}

func (t *pptxTemplateFillBuiltin) Execute(ctx context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	var args pptxTemplateFillArgs
	if result := decodePptxTemplateArguments(arguments, &args); result != nil {
		return result, nil
	}
	args.Template = strings.TrimSpace(args.Template)
	args.Path = strings.TrimSpace(args.Path)
	if args.Template == "" {
		return officeToolError("Missing required parameter: template"), nil
	}
	if args.Path == "" {
		return officeToolError("Missing required parameter: path"), nil
	}
	if strings.ToLower(filepath.Ext(args.Path)) != ".pptx" {
		return officeToolError("Invalid path: output must use the .pptx extension"), nil
	}
	if len(bytes.TrimSpace(args.Plan)) == 0 || bytes.Equal(bytes.TrimSpace(args.Plan), []byte("null")) {
		return officeToolError("Missing required parameter: plan"), nil
	}
	var plan officemodel.Plan
	if err := json.Unmarshal(args.Plan, &plan); err != nil {
		return officeToolError(fmt.Sprintf("Invalid plan: %s", err.Error())), nil
	}
	if plan.Schema != officemodel.PlanSchema {
		return officeToolError("Invalid plan: schema must be template_fill_pptx_plan.v1"), nil
	}

	templatePath, cleanup, err := resolvePptxTemplate(ctx, args.Template)
	if err != nil {
		return officeToolError(fmt.Sprintf("Failed to open PowerPoint template: %s", err.Error())), nil
	}
	defer cleanup()

	transition := strings.TrimSpace(args.Transition)
	if transition == "" {
		transition = "keep"
	}
	duration := args.TransitionDuration
	if duration == 0 {
		duration = 0.5
	}
	outputPath := ResolveOutputPath(args.Path)
	cleanupImages, err := resolvePptxPlanImages(ctx, &plan, ooxml.DefaultLimits().MaxPartSize)
	if err != nil {
		return officeToolError(fmt.Sprintf("Failed to resolve plan images: %s", err.Error())), nil
	}
	defer cleanupImages()
	library, err := office.AnalyzeFile(templatePath, ooxml.DefaultLimits())
	if err != nil {
		return officeToolError(fmt.Sprintf("Failed to fill PowerPoint template: %s", err.Error())), nil
	}
	validationReport, err := office.FillFile(
		templatePath,
		outputPath,
		&plan,
		officemodel.ApplyOptions{
			Transition:         transition,
			TransitionDuration: duration,
			Library:            library,
		},
		ooxml.DefaultLimits(),
	)
	if err != nil {
		if validationReport != nil {
			if reportData, marshalErr := json.MarshalIndent(compactPptxCheckReport(validationReport), "", "  "); marshalErr == nil {
				return officeToolError(fmt.Sprintf(
					"Failed to fill PowerPoint template: %s\nValidation report:\n%s",
					err.Error(), reportData,
				)), nil
			}
		}
		return officeToolError(fmt.Sprintf("Failed to fill PowerPoint template: %s", err.Error())), nil
	}

	reportText := "none"
	if reportData, marshalErr := json.MarshalIndent(compactPptxCheckReport(validationReport), "", "  "); marshalErr == nil {
		reportText = string(reportData)
	}
	return officeToolText(fmt.Sprintf(
		"Successfully filled PowerPoint template: %s\n%d slide(s) written\nValidation report:\n%s",
		outputPath, len(plan.Slides), reportText,
	)), nil
}

func compactPptxCheckReport(report *officemodel.CheckReport) *officemodel.CheckReport {
	if report == nil {
		return nil
	}
	compact := &officemodel.CheckReport{
		Schema:  report.Schema,
		Summary: report.Summary,
		Results: []officemodel.CheckResult{},
	}
	for _, item := range report.Results {
		status, _ := item["status"].(string)
		scale, hasScale := checkResultNumber(item["estimated_font_scale_percent"])
		chartLabelsFit, hasChartFit := item["category_labels_fit"].(bool)
		if status != "ERROR" && !(status == "WARN" && ((hasScale && scale < 60) || (hasChartFit && !chartLabelsFit))) {
			continue
		}
		result := officemodel.CheckResult{}
		for _, key := range []string{
			"status", "plan_slide", "source_slide", "slot_id", "table_id", "chart_id", "image_id", "smartart_id", "node_id", "selector",
			"new_text", "message", "estimated_font_scale_percent", "capacity_visual_width", "collisions",
			"category_axis_font_size_pt", "category_label_area_percent", "category_labels_fit",
			"longest_category", "longest_category_visual_width", "suggested_max_visual_width",
		} {
			if value, ok := item[key]; ok {
				result[key] = value
			}
		}
		if capacity, ok := item["capacity_visual_width"]; ok {
			result["suggested_max_visual_width"] = capacity
		}
		result["suggestion"] = pptxCheckSuggestion(item)
		compact.Results = append(compact.Results, result)
	}
	return compact
}

func pptxCheckSuggestion(item officemodel.CheckResult) string {
	status, _ := item["status"].(string)
	message, _ := item["message"].(string)
	switch {
	case strings.Contains(message, "overlap"):
		return "Shorten this replacement or choose a source slide with more space; the generated text would overlap another object."
	case strings.Contains(message, "target not found"):
		if _, ok := item["image_id"]; ok {
			return "Re-run pptx_template_analyze and use an exact image ID from the returned library."
		}
		return "Re-run pptx_template_analyze and use an exact slot, table, or chart ID from the returned library."
	case strings.Contains(message, "out of bounds"):
		return "Use a row and column that exist in the analyzed table."
	case strings.Contains(message, "image"):
		if strings.Contains(message, "unsupported") || strings.Contains(message, "format") {
			return "Convert the source to PNG or JPEG; only these two formats are supported."
		}
		if strings.Contains(message, "not found") {
			return "Re-run pptx_template_analyze and use an exact image ID from the returned library."
		}
		if strings.Contains(message, "empty") || strings.Contains(message, "path") {
			return "Provide a local PNG/JPEG path or an HTTP(S) URL pointing to a PNG/JPEG image."
		}
		return "Check that the image file or URL is valid and points to a PNG or JPEG image."
	case strings.Contains(message, "chart"):
		if labelsFit, ok := item["category_labels_fit"].(bool); ok && !labelsFit {
			return "Shorten the longest category label; the chart already uses the maximum label area and minimum 8pt axis font."
		}
		return "Make every chart series contain exactly one value for each category."
	case strings.Contains(message, "SmartArt"):
		return "Re-run pptx_template_analyze and use an exact SmartArt ID and node ID from the returned library."
	case status == "WARN":
		return "Shorten this text or choose a larger slot to avoid very small rendered text."
	default:
		return "Revise this plan item using the analyzed template metadata, then retry."
	}
}

func checkResultNumber(value interface{}) (float64, bool) {
	switch number := value.(type) {
	case float64:
		return number, true
	case float32:
		return float64(number), true
	case int:
		return float64(number), true
	case int64:
		return float64(number), true
	default:
		return 0, false
	}
}

func decodePptxTemplateArguments(arguments map[string]interface{}, target interface{}) *protocol.CallToolResult {
	data, err := json.Marshal(arguments)
	if err != nil {
		return officeToolError(fmt.Sprintf("Failed to parse parameters: %s", err.Error()))
	}
	if err := json.Unmarshal(data, target); err != nil {
		return officeToolError(fmt.Sprintf("Failed to parse parameters: %s", err.Error()))
	}
	return nil
}

func resolvePptxTemplate(ctx context.Context, value string) (string, func(), error) {
	parsed, err := url.Parse(value)
	if err != nil {
		return "", func() {}, fmt.Errorf("invalid template location: %w", err)
	}
	if parsed.Scheme == "http" || parsed.Scheme == "https" {
		return downloadPptxTemplate(ctx, parsed)
	}
	if parsed.Scheme != "" && strings.Contains(value, "://") {
		return "", func() {}, fmt.Errorf("unsupported URL scheme %q; only HTTP(S) is allowed", parsed.Scheme)
	}

	path, err := filepath.Abs(value)
	if err != nil {
		return "", func() {}, err
	}
	if err := validatePptxPackage(path); err != nil {
		return "", func() {}, err
	}
	return path, func() {}, nil
}

func downloadPptxTemplate(ctx context.Context, location *url.URL) (string, func(), error) {
	client := &http.Client{
		Timeout: 90 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("too many redirects")
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return errors.New("redirected to a non-HTTP(S) URL")
			}
			return nil
		},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, location.String(), nil)
	if err != nil {
		return "", func() {}, err
	}
	response, err := client.Do(request)
	if err != nil {
		return "", func() {}, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", func() {}, fmt.Errorf("download returned HTTP %d", response.StatusCode)
	}
	if response.ContentLength > pptxTemplateDownloadLimit {
		return "", func() {}, fmt.Errorf("template exceeds the 100 MB download limit")
	}

	file, err := os.CreateTemp("", "openagent-pptx-template-*.pptx")
	if err != nil {
		return "", func() {}, err
	}
	path := file.Name()
	cleanup := func() { _ = os.Remove(path) }
	limited := io.LimitReader(response.Body, pptxTemplateDownloadLimit+1)
	written, copyErr := io.Copy(file, limited)
	closeErr := file.Close()
	if copyErr != nil {
		cleanup()
		return "", func() {}, copyErr
	}
	if closeErr != nil {
		cleanup()
		return "", func() {}, closeErr
	}
	if written > pptxTemplateDownloadLimit {
		cleanup()
		return "", func() {}, fmt.Errorf("template exceeds the 100 MB download limit")
	}
	if err := validatePptxPackage(path); err != nil {
		cleanup()
		return "", func() {}, err
	}
	return path, cleanup, nil
}

func resolvePptxPlanImages(ctx context.Context, plan *officemodel.Plan, limit int64) (func(), error) {
	var tempFiles []string
	cleanup := func() {
		for _, path := range tempFiles {
			_ = os.Remove(path)
		}
	}

	for slideIdx := range plan.Slides {
		slide := &plan.Slides[slideIdx]
		for editIdx := range slide.ImageEdits {
			edit := &slide.ImageEdits[editIdx]
			edit.ImagePath = strings.TrimSpace(edit.ImagePath)
			if edit.ImagePath == "" {
				cleanup()
				return nil, fmt.Errorf("image edit %s: empty image_path", edit.ImageID)
			}

			parsed, err := url.Parse(edit.ImagePath)
			if err != nil {
				cleanup()
				return nil, fmt.Errorf("image edit %s: invalid image_path: %w", edit.ImageID, err)
			}

			if parsed.Scheme == "http" || parsed.Scheme == "https" {
				path, dlErr := downloadPptxImage(ctx, parsed, limit)
				if dlErr != nil {
					cleanup()
					return nil, fmt.Errorf("image edit %s: %s", edit.ImageID, dlErr.Error())
				}
				tempFiles = append(tempFiles, path)
				edit.ImagePath = path
				continue
			}

			if parsed.Scheme != "" && strings.Contains(edit.ImagePath, "://") {
				cleanup()
				return nil, fmt.Errorf("image edit %s: unsupported URL scheme %q; only HTTP(S) is allowed", edit.ImageID, parsed.Scheme)
			}

			absPath, err := filepath.Abs(edit.ImagePath)
			if err != nil {
				cleanup()
				return nil, fmt.Errorf("image edit %s: cannot resolve path: %w", edit.ImageID, err)
			}
			edit.ImagePath = absPath
		}
	}

	return cleanup, nil
}

func downloadPptxImage(ctx context.Context, location *url.URL, limit int64) (string, error) {
	client := &http.Client{
		Timeout: 90 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("too many redirects")
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return errors.New("redirected to a non-HTTP(S) URL")
			}
			return nil
		},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, location.String(), nil)
	if err != nil {
		return "", err
	}
	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("download returned HTTP %d", response.StatusCode)
	}
	if response.ContentLength > limit {
		return "", fmt.Errorf("image exceeds the %d MB size limit", limit>>20)
	}
	ct := response.Header.Get("Content-Type")
	if ct != "" && !strings.HasPrefix(ct, "image/") && !strings.HasPrefix(ct, "application/octet-stream") {
		return "", fmt.Errorf("URL did not return an image (Content-Type: %s)", ct)
	}

	file, err := os.CreateTemp("", "openagent-pptx-image-*")
	if err != nil {
		return "", err
	}
	path := file.Name()
	removeTempOnErr := func() {
		_ = file.Close()
		_ = os.Remove(path)
	}

	limited := io.LimitReader(response.Body, limit+1)
	written, copyErr := io.Copy(file, limited)
	if copyErr != nil {
		removeTempOnErr()
		return "", copyErr
	}
	if written > limit {
		removeTempOnErr()
		return "", fmt.Errorf("image exceeds the %d MB size limit", limit>>20)
	}
	if written == 0 {
		removeTempOnErr()
		return "", fmt.Errorf("downloaded image is empty")
	}
	if err := file.Close(); err != nil {
		_ = os.Remove(path)
		return "", err
	}
	return path, nil
}

func validatePptxPackage(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fmt.Errorf("template path is a directory")
	}
	if strings.ToLower(filepath.Ext(path)) != ".pptx" {
		return fmt.Errorf("template must use the .pptx extension")
	}
	reader, err := zip.OpenReader(path)
	if err != nil {
		return fmt.Errorf("template is not a valid ZIP/PPTX package: %w", err)
	}
	defer reader.Close()
	required := map[string]bool{
		"[Content_Types].xml":  false,
		"ppt/presentation.xml": false,
	}
	for _, entry := range reader.File {
		if _, ok := required[entry.Name]; ok {
			required[entry.Name] = true
		}
	}
	for name, found := range required {
		if !found {
			return fmt.Errorf("invalid PPTX package: missing %s", name)
		}
	}
	return nil
}
