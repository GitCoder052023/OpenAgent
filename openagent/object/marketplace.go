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
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"strings"

	"github.com/the-open-agent/openagent/proxy"
	"github.com/the-open-agent/openagent/util"
)

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

// MarketplaceSource describes a single skill marketplace that can be queried.
type MarketplaceSource struct {
	// ID is the internal key used in API calls (e.g. "clawhub", "openagent").
	ID string `json:"id"`
	// Name is the human-readable label shown in the UI.
	Name string `json:"name"`
	// Type is the adapter type: "manifest" (generic JSON) or "github".
	Type string `json:"type"`
	// URL is the endpoint for the adapter:
	//   manifest → URL of the JSON manifest file
	//   github   → "owner/repo" or a raw-content prefix URL
	URL string `json:"url"`
}

// MarketplaceSkillItem is a skill entry returned from any marketplace source.
type MarketplaceSkillItem struct {
	Name        string   `json:"name"`
	DisplayName string   `json:"displayName"`
	Description string   `json:"description"`
	Emoji       string   `json:"emoji"`
	Type        string   `json:"type"`
	Homepage    string   `json:"homepage"`
	Author      string   `json:"author"`
	Tags        []string `json:"tags"`
	// SkillMdUrl is the direct URL to the raw SKILL.md for installation.
	SkillMdUrl string `json:"skillMdUrl"`
	// RefsBaseUrl is the optional base URL for the references/ directory.
	// Files listed in RefNames will be fetched from RefsBaseUrl/<name>.
	RefsBaseUrl string   `json:"refsBaseUrl"`
	RefNames    []string `json:"refNames"`
	// Source is the ID of the marketplace source (populated by the backend).
	Source string `json:"source"`
}

// marketplaceManifest is the JSON schema for a "manifest" type source.
type marketplaceManifest struct {
	Name    string                 `json:"name"`
	Version string                 `json:"version"`
	Skills  []MarketplaceSkillItem `json:"skills"`
}

// ---------------------------------------------------------------------------
// Built-in marketplace sources
// ---------------------------------------------------------------------------

// DefaultMarketplaceSources lists the marketplaces shown by default.
// Additional sources can be added by the user via the UI in the future.
var DefaultMarketplaceSources = []MarketplaceSource{
	{
		ID:   "openagent",
		Name: "OpenAgent Official",
		Type: "github",
		URL:  "the-open-agent/openagent",
	},
	{
		ID:   "clawhub",
		Name: "ClawHub",
		Type: "manifest",
		URL:  "https://clawhub.ai/api/marketplace/manifest.json",
	},
}

// ---------------------------------------------------------------------------
// Fetching helpers
// ---------------------------------------------------------------------------

func fetchURL(url string) ([]byte, error) {
	resp, err := proxy.GetHttpClient(url).Get(url)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("fetch %s: HTTP %d", url, resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

// fetchUntrustedURL downloads a URL supplied by the client. GitHub content keeps using the
// (possibly proxied) GitHub client; every other host may only be reached on a public address,
// so the request cannot be aimed at internal services or cloud metadata endpoints.
func fetchUntrustedURL(rawUrl string) ([]byte, error) {
	u, err := url.Parse(rawUrl)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", rawUrl, err)
	}
	host := strings.ToLower(u.Hostname())
	if u.Scheme == "https" && (host == "github.com" || host == "raw.githubusercontent.com" || strings.HasSuffix(host, ".githubusercontent.com")) {
		return fetchURL(rawUrl)
	}

	buffer, err := util.DownloadUntrustedFile(rawUrl)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", rawUrl, err)
	}
	return buffer.Bytes(), nil
}

// ---------------------------------------------------------------------------
// Adapter: manifest
// ---------------------------------------------------------------------------

func fetchManifestSource(src MarketplaceSource, keyword string) ([]MarketplaceSkillItem, error) {
	data, err := fetchURL(src.URL)
	if err != nil {
		return nil, err
	}

	var manifest marketplaceManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("parse manifest from %s: %w", src.URL, err)
	}

	var results []MarketplaceSkillItem
	kw := strings.ToLower(keyword)
	for _, item := range manifest.Skills {
		if kw != "" && !skillMatchesKeyword(item, kw) {
			continue
		}
		item.Source = src.ID
		results = append(results, item)
	}
	return results, nil
}

// ---------------------------------------------------------------------------
// Adapter: github
// ---------------------------------------------------------------------------

// githubTreeEntry is the part of the GitHub tree API response we need.
type githubTreeEntry struct {
	Path string `json:"path"`
	Type string `json:"type"` // "blob" or "tree"
	URL  string `json:"url"`
}

type githubTreeResponse struct {
	Tree []githubTreeEntry `json:"tree"`
}

type githubContentResponse struct {
	Content  string `json:"content"`  // base64
	Encoding string `json:"encoding"` // "base64"
}

func fetchGithubSource(src MarketplaceSource, keyword string) ([]MarketplaceSkillItem, error) {
	// src.URL is "owner/repo"
	repo := strings.TrimPrefix(src.URL, "https://github.com/")
	repo = strings.Trim(repo, "/")

	// Fetch the recursive tree of the skills/ directory.
	apiBase := fmt.Sprintf("https://api.github.com/repos/%s", repo)
	treeURL := fmt.Sprintf("%s/git/trees/HEAD?recursive=1", apiBase)

	data, err := fetchURL(treeURL)
	if err != nil {
		return nil, err
	}

	var tree githubTreeResponse
	if err := json.Unmarshal(data, &tree); err != nil {
		return nil, fmt.Errorf("parse github tree: %w", err)
	}

	// Identify skill directories: any path matching "skills/<name>/SKILL.md"
	rawBase := fmt.Sprintf("https://raw.githubusercontent.com/%s/refs/heads/master", repo)
	skillDirs := map[string]bool{}
	for _, entry := range tree.Tree {
		if entry.Type == "blob" && strings.HasPrefix(entry.Path, "skills/") && strings.HasSuffix(entry.Path, "/SKILL.md") {
			parts := strings.Split(entry.Path, "/")
			if len(parts) == 3 {
				skillDirs[parts[1]] = true
			}
		}
	}

	// Collect reference file names per skill directory.
	skillRefs := map[string][]string{}
	for _, entry := range tree.Tree {
		if entry.Type == "blob" && strings.HasPrefix(entry.Path, "skills/") && strings.Contains(entry.Path, "/references/") {
			parts := strings.Split(entry.Path, "/")
			if len(parts) == 4 {
				skillName := parts[1]
				skillRefs[skillName] = append(skillRefs[skillName], parts[3])
			}
		}
	}

	kw := strings.ToLower(keyword)
	var results []MarketplaceSkillItem

	for skillName := range skillDirs {
		skillMdURL := fmt.Sprintf("%s/skills/%s/SKILL.md", rawBase, skillName)

		// Fetch and parse SKILL.md to get metadata.
		mdBytes, err := fetchURL(skillMdURL)
		if err != nil {
			continue
		}
		name, description, homepage, _, emoji, _ := parseSkillMd(string(mdBytes))
		if name == "" {
			name = skillName
		}

		item := MarketplaceSkillItem{
			Name:        name,
			DisplayName: name,
			Description: description,
			Emoji:       emoji,
			Type:        "custom",
			Homepage:    homepage,
			SkillMdUrl:  skillMdURL,
			Source:      src.ID,
		}
		if refs, ok := skillRefs[skillName]; ok {
			item.RefNames = refs
			item.RefsBaseUrl = fmt.Sprintf("%s/skills/%s/references", rawBase, skillName)
		}

		if kw != "" && !skillMatchesKeyword(item, kw) {
			continue
		}
		results = append(results, item)
	}

	return results, nil
}

// ---------------------------------------------------------------------------
// Main entry points
// ---------------------------------------------------------------------------

// GetMarketplaceSources returns the list of available marketplace sources.
func GetMarketplaceSources() []MarketplaceSource {
	return DefaultMarketplaceSources
}

// GetMarketplaceSkills fetches skills from the given source, filtered by keyword.
// sourceID "" means all sources.
func GetMarketplaceSkills(sourceID, keyword string) ([]MarketplaceSkillItem, error) {
	var sources []MarketplaceSource
	for _, s := range DefaultMarketplaceSources {
		if sourceID == "" || s.ID == sourceID {
			sources = append(sources, s)
		}
	}
	if len(sources) == 0 {
		return nil, fmt.Errorf("unknown marketplace source: %s", sourceID)
	}

	var all []MarketplaceSkillItem
	for _, src := range sources {
		var items []MarketplaceSkillItem
		var err error
		switch src.Type {
		case "manifest":
			items, err = fetchManifestSource(src, keyword)
		case "github":
			items, err = fetchGithubSource(src, keyword)
		default:
			continue
		}
		if err != nil {
			// Soft failure: return partial results with an error annotation.
			continue
		}
		all = append(all, items...)
	}

	return all, nil
}

// InstallMarketplaceSkill downloads a skill from a marketplace URL and saves it.
func InstallMarketplaceSkill(item MarketplaceSkillItem) (*Skill, error) {
	if item.SkillMdUrl == "" {
		return nil, fmt.Errorf("skillMdUrl is required")
	}

	mdBytes, err := fetchUntrustedURL(item.SkillMdUrl)
	if err != nil {
		return nil, fmt.Errorf("download SKILL.md: %w", err)
	}

	name, description, homepage, metadata, emoji, content := parseSkillMd(string(mdBytes))
	if name == "" {
		name = item.Name
	}

	// Download reference files.
	var refs []SkillReference
	if item.RefsBaseUrl != "" {
		for _, refName := range item.RefNames {
			refURL := fmt.Sprintf("%s/%s", strings.TrimRight(item.RefsBaseUrl, "/"), refName)
			refBytes, err := fetchUntrustedURL(refURL)
			if err != nil {
				continue
			}
			refs = append(refs, SkillReference{
				Name:    refName,
				Content: string(refBytes),
			})
		}
	}

	skill := &Skill{
		Owner:       "admin",
		Name:        name,
		DisplayName: name,
		Type:        "custom",
		Description: description,
		Homepage:    homepage,
		Emoji:       emoji,
		Metadata:    metadata,
		Content:     content,
		SkillMd:     string(mdBytes),
		References:  refs,
		State:       "Active",
	}

	return skill, nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func skillMatchesKeyword(item MarketplaceSkillItem, kw string) bool {
	if strings.Contains(strings.ToLower(item.Name), kw) {
		return true
	}
	if strings.Contains(strings.ToLower(item.DisplayName), kw) {
		return true
	}
	if strings.Contains(strings.ToLower(item.Description), kw) {
		return true
	}
	for _, tag := range item.Tags {
		if strings.Contains(strings.ToLower(tag), kw) {
			return true
		}
	}
	return false
}
