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
	stdhtml "html"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/ThinkInAIXYZ/go-mcp/protocol"
	_ "golang.org/x/image/webp"
	"golang.org/x/net/html"
)

const (
	imageSearchMaxImageSize = 5 * 1024 * 1024
)

var (
	duckDuckGoHomeEndpoint  = "https://duckduckgo.com/"
	duckDuckGoImageEndpoint = "https://duckduckgo.com/i.js"
	bingImageSearchEndpoint = "https://www.bing.com/images/search"
)

type imageSearchBuiltin struct {
	engine         webSearchEngine
	apiKey         string
	searchEngineID string
	endpoint       string
	httpClient     *http.Client
}

type modelVisionContextKey struct{}

func WithModelVision(ctx context.Context, enabled bool) context.Context {
	return context.WithValue(ctx, modelVisionContextKey{}, enabled)
}

type imageSearchResult struct {
	ID           string `json:"id"`
	Title        string `json:"title,omitempty"`
	ImageURL     string `json:"imageUrl"`
	ThumbnailURL string `json:"thumbnailUrl,omitempty"`
	SourceURL    string `json:"sourceUrl,omitempty"`
	Width        int    `json:"width,omitempty"`
	Height       int    `json:"height,omitempty"`
}

type imageSearchPayload struct {
	Query           string                   `json:"query"`
	Provider        string                   `json:"provider"`
	Count           int                      `json:"count"`
	ExternalContent webSearchExternalContent `json:"externalContent"`
	Results         []imageSearchResult      `json:"results"`
}

type duckDuckGoImageResponse struct {
	Results []struct {
		Title     string `json:"title"`
		Image     string `json:"image"`
		Thumbnail string `json:"thumbnail"`
		URL       string `json:"url"`
		Width     int    `json:"width"`
		Height    int    `json:"height"`
	} `json:"results"`
}

func (t *imageSearchBuiltin) GetName() string {
	return "image_search"
}

func (t *imageSearchBuiltin) GetDescription() string {
	return `Search the web for images and inspect the returned thumbnails. Use this when visual comparison is needed before choosing an image. Returns image URLs, source pages, dimensions, and the actual thumbnails for visual analysis.`
}

func (t *imageSearchBuiltin) GetInputSchema() interface{} {
	return (&webSearchBuiltin{}).GetInputSchema()
}

func (t *imageSearchBuiltin) Execute(ctx context.Context, arguments map[string]interface{}) (*protocol.CallToolResult, error) {
	if isVision, ok := ctx.Value(modelVisionContextKey{}).(bool); ok && !isVision {
		return webSearchToolError("The current model does not support image input. Do not call image_search; continue using text-based tools instead."), nil
	}

	params, err := parseWebSearchArguments(arguments)
	if err != nil {
		return webSearchToolError(err.Error()), nil
	}

	results, provider, err := t.runImageSearch(ctx, params)
	if err != nil {
		return webSearchToolError(fmt.Sprintf("Image search failed: %s", err.Error())), nil
	}

	content := make([]protocol.Content, 0, len(results)+1)
	visibleResults := make([]imageSearchResult, 0, len(results))
	for _, result := range results {
		imageURL := result.ThumbnailURL
		if imageURL == "" {
			imageURL = result.ImageURL
		}
		data, mimeType, width, height, err := downloadImage(ctx, imageURL, imageSearchMaxImageSize, t.httpClient)
		if err != nil {
			continue
		}
		if result.Width == 0 {
			result.Width = width
		}
		if result.Height == 0 {
			result.Height = height
		}
		result.ID = fmt.Sprintf("image_%d", len(visibleResults)+1)
		visibleResults = append(visibleResults, result)
		content = append(content, &protocol.ImageContent{
			Type:     "image",
			Data:     data,
			MimeType: mimeType,
		})
	}
	if len(visibleResults) == 0 {
		return webSearchToolError("Image search failed: no image thumbnails could be downloaded"), nil
	}

	payload := imageSearchPayload{
		Query:    params.Query,
		Provider: provider,
		Count:    len(visibleResults),
		ExternalContent: webSearchExternalContent{
			Untrusted: true,
			Source:    "image_search",
		},
		Results: visibleResults,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	content = append([]protocol.Content{
		&protocol.TextContent{Type: "text", Text: string(payloadBytes)},
	}, content...)
	return &protocol.CallToolResult{Content: content}, nil
}

func (t *imageSearchBuiltin) runImageSearch(ctx context.Context, params webSearchParams) ([]imageSearchResult, string, error) {
	switch t.engine {
	case webSearchEngineGoogle:
		results, err := runGoogleImageSearch(ctx, params, t.apiKey, t.searchEngineID, t.endpoint, t.httpClient)
		return results, "google", err
	case webSearchEngineBing:
		results, err := runBingImageSearch(ctx, params, t.httpClient)
		return results, "bing", err
	case webSearchEngineDuckDuckGo:
		results, err := runDuckDuckGoImageSearch(ctx, params, t.httpClient)
		return results, "duckduckgo", err
	case webSearchEngineBaidu:
		results, err := runBaiduImageSearch(ctx, params, t.apiKey, t.endpoint, t.httpClient)
		return results, "baidu", err
	default:
		return nil, "", fmt.Errorf("image search is not supported by %s", t.engine)
	}
}

func runGoogleImageSearch(ctx context.Context, params webSearchParams, apiKey string, searchEngineID string, endpoint string, httpClient *http.Client) ([]imageSearchResult, error) {
	if strings.TrimSpace(apiKey) == "" {
		return nil, fmt.Errorf("Google search requires an API key in clientSecret")
	}
	if strings.TrimSpace(searchEngineID) == "" {
		return nil, fmt.Errorf("Google search requires a search engine ID (cx) in clientId")
	}

	query := url.Values{}
	query.Set("key", apiKey)
	query.Set("cx", searchEngineID)
	query.Set("q", params.Query)
	query.Set("num", strconv.Itoa(params.Count))
	query.Set("searchType", "image")
	query.Set("safe", "active")
	if params.Language != "" {
		query.Set("hl", params.Language)
	}
	if params.Country != "" {
		query.Set("gl", params.Country)
	}

	body, err := fetchWebSearchAPI(ctx, http.MethodGet, resolveWebSearchEndpoint(endpoint, googleJSONSearchEndpoint), query, nil, nil, httpClient)
	if err != nil {
		return nil, err
	}
	var response googleSearchResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Error != nil && response.Error.Message != "" {
		return nil, fmt.Errorf("Google returned an error: %s", response.Error.Message)
	}

	results := make([]imageSearchResult, 0, len(response.Items))
	for _, item := range response.Items {
		if strings.TrimSpace(item.Link) == "" {
			continue
		}
		results = append(results, imageSearchResult{
			Title:        cleanWebSearchText(item.Title),
			ImageURL:     strings.TrimSpace(item.Link),
			ThumbnailURL: strings.TrimSpace(item.Image.ThumbnailLink),
			SourceURL:    strings.TrimSpace(item.Image.ContextLink),
			Width:        item.Image.Width,
			Height:       item.Image.Height,
		})
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("Google returned no image results")
	}
	return limitImageSearchResults(results, params.Count), nil
}

func runBingImageSearch(ctx context.Context, params webSearchParams, httpClient *http.Client) ([]imageSearchResult, error) {
	query := url.Values{}
	query.Set("q", params.Query)
	query.Set("count", strconv.Itoa(params.Count))
	query.Set("safeSearch", "Strict")
	if params.Language != "" {
		query.Set("setlang", params.Language)
	}
	if params.Country != "" {
		query.Set("cc", params.Country)
	}
	body, err := fetchWebSearchHTML(ctx, bingImageSearchEndpoint, query, httpClient)
	if err != nil {
		return nil, err
	}
	results, err := parseBingImageHTML(body)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("Bing returned no image results")
	}
	return limitImageSearchResults(results, params.Count), nil
}

func runDuckDuckGoImageSearch(ctx context.Context, params webSearchParams, httpClient *http.Client) ([]imageSearchResult, error) {
	form := url.Values{"q": []string{params.Query}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, duckDuckGoHomeEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", webSearchUserAgent)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, webSearchMaxResponseSize+1))
	if err != nil {
		return nil, err
	}
	if len(body) > webSearchMaxResponseSize {
		return nil, fmt.Errorf("response body exceeds %d bytes", webSearchMaxResponseSize)
	}
	tokenMatch := regexp.MustCompile(`vqd=["']?([0-9-]+)`).FindSubmatch(body)
	if len(tokenMatch) < 2 {
		return nil, fmt.Errorf("DuckDuckGo image token was not found")
	}

	query := url.Values{}
	query.Set("q", params.Query)
	query.Set("vqd", string(tokenMatch[1]))
	query.Set("o", "json")
	query.Set("f", ",,,")
	query.Set("p", "1")
	if params.Country != "" && params.Language != "" {
		query.Set("l", fmt.Sprintf("%s-%s", params.Country, params.Language))
	}
	data, err := fetchWebSearchAPI(ctx, http.MethodGet, duckDuckGoImageEndpoint, query, nil, map[string]string{
		"Referer": duckDuckGoHomeEndpoint,
	}, httpClient)
	if err != nil {
		return nil, err
	}
	var response duckDuckGoImageResponse
	if err := json.Unmarshal(data, &response); err != nil {
		return nil, err
	}
	results := make([]imageSearchResult, 0, len(response.Results))
	for _, item := range response.Results {
		if strings.TrimSpace(item.Image) == "" {
			continue
		}
		results = append(results, imageSearchResult{
			Title:        cleanWebSearchText(item.Title),
			ImageURL:     strings.TrimSpace(item.Image),
			ThumbnailURL: strings.TrimSpace(item.Thumbnail),
			SourceURL:    strings.TrimSpace(item.URL),
			Width:        item.Width,
			Height:       item.Height,
		})
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("DuckDuckGo returned no image results")
	}
	return limitImageSearchResults(results, params.Count), nil
}

func runBaiduImageSearch(ctx context.Context, params webSearchParams, apiKey string, endpoint string, httpClient *http.Client) ([]imageSearchResult, error) {
	response, err := fetchBaiduSearch(ctx, params, apiKey, endpoint, "image", httpClient)
	if err != nil {
		return nil, err
	}
	results := parseBaiduImageSearchResponse(response)
	if len(results) == 0 {
		return nil, fmt.Errorf("Baidu returned no image results")
	}
	return limitImageSearchResults(results, params.Count), nil
}

func parseBingImageHTML(body string) ([]imageSearchResult, error) {
	root, err := html.Parse(strings.NewReader(body))
	if err != nil {
		return nil, err
	}
	nodes := findHTMLNodes(root, func(n *html.Node) bool {
		return n.Type == html.ElementNode && n.Data == "a" && htmlNodeHasClass(n, "iusc")
	})
	results := make([]imageSearchResult, 0, len(nodes))
	for _, node := range nodes {
		var metadata struct {
			Title        string `json:"t"`
			ImageURL     string `json:"murl"`
			ThumbnailURL string `json:"turl"`
			SourceURL    string `json:"purl"`
			Width        int    `json:"mw"`
			Height       int    `json:"mh"`
		}
		raw := stdhtml.UnescapeString(htmlAttribute(node, "m"))
		if raw == "" || json.Unmarshal([]byte(raw), &metadata) != nil || metadata.ImageURL == "" {
			continue
		}
		results = append(results, imageSearchResult{
			Title:        cleanWebSearchText(metadata.Title),
			ImageURL:     metadata.ImageURL,
			ThumbnailURL: metadata.ThumbnailURL,
			SourceURL:    metadata.SourceURL,
			Width:        metadata.Width,
			Height:       metadata.Height,
		})
	}
	return results, nil
}

func parseBaiduImageSearchResponse(response baiduWebSearchResponse) []imageSearchResult {
	results := make([]imageSearchResult, 0, len(response.References))
	for _, reference := range response.References {
		if reference.Image == nil || strings.TrimSpace(reference.Image.URL) == "" {
			continue
		}
		title := cleanWebSearchText(reference.Title)
		if title == "" {
			title = cleanWebSearchText(reference.WebAnchor)
		}
		width, _ := strconv.Atoi(reference.Image.Width)
		height, _ := strconv.Atoi(reference.Image.Height)
		results = append(results, imageSearchResult{
			Title:     title,
			ImageURL:  strings.TrimSpace(reference.Image.URL),
			SourceURL: strings.TrimSpace(reference.URL),
			Width:     width,
			Height:    height,
		})
	}
	return results
}

func limitImageSearchResults(results []imageSearchResult, count int) []imageSearchResult {
	if len(results) <= count {
		return results
	}
	return results[:count]
}

func downloadImage(ctx context.Context, rawURL string, limit int64, httpClient *http.Client) ([]byte, string, int, int, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, "", 0, 0, fmt.Errorf("invalid HTTP(S) image URL")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, "", 0, 0, err
	}
	req.Header.Set("User-Agent", webSearchUserAgent)
	req.Header.Set("Accept", "image/*")
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, "", 0, 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, "", 0, 0, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	if resp.ContentLength > limit {
		return nil, "", 0, 0, fmt.Errorf("image exceeds %d bytes", limit)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, "", 0, 0, err
	}
	if int64(len(data)) > limit {
		return nil, "", 0, 0, fmt.Errorf("image exceeds %d bytes", limit)
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, "", 0, 0, fmt.Errorf("cannot decode image: %w", err)
	}
	mimeType := map[string]string{
		"jpeg": "image/jpeg",
		"png":  "image/png",
		"gif":  "image/gif",
		"webp": "image/webp",
	}[format]
	if mimeType == "" {
		return nil, "", 0, 0, fmt.Errorf("unsupported image format %q", format)
	}
	return data, mimeType, config.Width, config.Height, nil
}
