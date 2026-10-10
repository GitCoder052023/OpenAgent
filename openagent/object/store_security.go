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
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/the-open-agent/openagent/util"
)

// StoreSecurity is the payload for the Insights → Security sub-tab. It combines
// a static audit of the store's configuration (posture checks) with activity-
// based signals mined from the recent message / visit stream in the window.
type StoreSecurity struct {
	Period    string `json:"period"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
	AsOf      string `json:"asOf"`

	// Overall posture derived from the checks below.
	Score     int    `json:"score"` // 0-100
	Grade     string `json:"grade"` // A | B | C | D | E
	PassCount int    `json:"passCount"`
	WarnCount int    `json:"warnCount"`
	FailCount int    `json:"failCount"`

	Checks []*SecurityCheck `json:"checks"`

	// Activity signals over the window.
	MessagesScanned   int               `json:"messagesScanned"`
	ForbiddenWordHits int               `json:"forbiddenWordHits"`
	TopForbiddenWords []*TrafficItem    `json:"topForbiddenWords"`
	FlaggedMessages   []*FlaggedMessage `json:"flaggedMessages"`
	ErrorMessages     int               `json:"errorMessages"`
	GuestVisits       int               `json:"guestVisits"`
	AuthedVisits      int               `json:"authedVisits"`
}

// SecurityCheck is one audit item. The frontend owns all display text and maps
// (Key, Status) to a localized title / description / recommendation, filling in
// the dynamic numbers carried in Meta.
type SecurityCheck struct {
	Key      string                 `json:"key"`
	Status   string                 `json:"status"`   // pass | warn | fail
	Severity string                 `json:"severity"` // low | medium | high
	Meta     map[string]interface{} `json:"meta,omitempty"`
}

// FlaggedMessage is a single user message that tripped the store's forbidden-word
// filter, with a short redacted-context snippet for review.
type FlaggedMessage struct {
	Chat        string `json:"chat"`
	User        string `json:"user"`
	CreatedTime string `json:"createdTime"`
	Word        string `json:"word"`
	Snippet     string `json:"snippet"`
}

const (
	secStatusPass = "pass"
	secStatusWarn = "warn"
	secStatusFail = "fail"

	secSevLow    = "low"
	secSevMedium = "medium"
	secSevHigh   = "high"
)

// secretPatterns scans free-text config fields (prompt, description, welcome,
// brief) for credential-looking material that should never be baked into an
// agent definition.
var secretPatterns = []struct {
	name string
	re   *regexp.Regexp
}{
	{"privateKey", regexp.MustCompile(`-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----`)},
	{"apiKey", regexp.MustCompile(`\bsk-[A-Za-z0-9]{20,}\b`)},
	{"awsAccessKey", regexp.MustCompile(`\bAKIA[0-9A-Z]{16}\b`)},
	{"slackToken", regexp.MustCompile(`\bxox[baprs]-[A-Za-z0-9-]{10,}\b`)},
	{"githubToken", regexp.MustCompile(`\bgh[pousr]_[A-Za-z0-9]{20,}\b`)},
	{"jwt", regexp.MustCompile(`\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\b`)},
	{"credentialAssignment", regexp.MustCompile(`(?i)(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["']?[^\s"']{6,}`)},
}

// severityPenalty maps a (status, severity) pair to the points deducted from the
// starting score of 100.
func severityPenalty(status, severity string) int {
	if status == secStatusPass {
		return 0
	}
	base := map[string]int{secSevLow: 4, secSevMedium: 10, secSevHigh: 22}[severity]
	if status == secStatusFail {
		base *= 2
	}
	return base
}

func gradeForScore(score int) string {
	switch {
	case score >= 90:
		return "A"
	case score >= 75:
		return "B"
	case score >= 60:
		return "C"
	case score >= 40:
		return "D"
	default:
		return "E"
	}
}

// GetStoreSecurity audits the store's configuration and recent activity and
// returns a posture report for the Security sub-tab.
func GetStoreSecurity(owner string, storeName string, period string) (*StoreSecurity, error) {
	spec, err := resolvePeriod(period)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	end := now.Truncate(spec.bucketUnit).Add(spec.bucketUnit)
	start := end.Add(-spec.duration)
	startStr := util.FormatTimeForCompare(start)
	endStr := util.FormatTimeForCompare(end)

	store, err := ResolveStoreByOwnerAndName(owner, storeName)
	if err != nil {
		return nil, err
	}

	res := &StoreSecurity{
		Period:    period,
		StartTime: startStr,
		EndTime:   endStr,
		AsOf:      now.Format(time.RFC3339),
		Checks:    []*SecurityCheck{},
	}
	if store == nil {
		res.Score = 0
		res.Grade = gradeForScore(0)
		return res, nil
	}

	res.Checks = append(res.Checks, buildConfigChecks(store)...)

	// Activity-based analysis over the window: scan user messages against the
	// store's forbidden-word list and tally error replies. Only pull the columns
	// we read so the mediumtext body of every AI turn doesn't ride along, mirror-
	// ing the sibling aggregations in store_insights.go. Filter by store only —
	// Message.Owner is hardcoded to "admin".
	messages := []*Message{}
	if err = adapter.engine.
		Cols("user", "chat", "created_time", "author", "text", "error_text").
		Where("store = ? and created_time >= ? and created_time < ?", storeName, startStr, endStr).
		Find(&messages); err != nil {
		return nil, err
	}

	wordHits := map[string]int{}
	for _, m := range messages {
		if m.ErrorText != "" {
			res.ErrorMessages++
		}
		if m.Author == "AI" {
			continue
		}
		res.MessagesScanned++
		if m.Text == "" || len(store.ForbiddenWords) == 0 {
			continue
		}
		lower := strings.ToLower(m.Text)
		for _, w := range store.ForbiddenWords {
			if w == "" {
				continue
			}
			if strings.Contains(lower, strings.ToLower(w)) {
				res.ForbiddenWordHits++
				wordHits[w]++
				if len(res.FlaggedMessages) < 20 {
					res.FlaggedMessages = append(res.FlaggedMessages, &FlaggedMessage{
						Chat:        m.Chat,
						User:        m.User,
						CreatedTime: m.CreatedTime,
						Word:        w,
						Snippet:     redactSnippet(m.Text, w),
					})
				}
			}
		}
	}
	res.TopForbiddenWords = topItems(wordHits, 10)

	// Guest vs authenticated traffic over the window — a high guest share on a
	// published agent is worth surfacing next to the exposure check.
	visits := []*StoreVisit{}
	if err = adapter.engine.
		Cols("created_time", "is_guest").
		Where("store_owner = ? and store_name = ? and created_time >= ? and created_time < ?", owner, storeName, startStr, endStr).
		Find(&visits); err != nil {
		return nil, err
	}
	for _, v := range visits {
		if v.IsGuest {
			res.GuestVisits++
		} else {
			res.AuthedVisits++
		}
	}

	// Activity check: forbidden-word violations detected in the window. Only
	// meaningful when a moderation list is configured; otherwise the static
	// content_moderation check already flags the missing list.
	if len(store.ForbiddenWords) > 0 {
		status := secStatusPass
		if res.ForbiddenWordHits > 0 {
			status = secStatusFail
		}
		res.Checks = append(res.Checks, &SecurityCheck{
			Key:      "forbidden_word_violations",
			Status:   status,
			Severity: secSevMedium,
			Meta: map[string]interface{}{
				"hits":            res.ForbiddenWordHits,
				"messagesScanned": res.MessagesScanned,
			},
		})
	}

	finalizePosture(res)
	return res, nil
}

// buildConfigChecks runs the static configuration audit that does not depend on
// the activity window.
func buildConfigChecks(store *Store) []*SecurityCheck {
	checks := []*SecurityCheck{}
	published := store.PublishState == "Published"

	// System-prompt secret scan across all free-text config fields.
	haystack := strings.Join([]string{store.Prompt, store.Description, store.WelcomeText, store.Brief}, "\n")
	matchedCats := []string{}
	seen := map[string]bool{}
	for _, p := range secretPatterns {
		if p.re.MatchString(haystack) && !seen[p.name] {
			matchedCats = append(matchedCats, p.name)
			seen[p.name] = true
		}
	}
	secretStatus := secStatusPass
	if len(matchedCats) > 0 {
		secretStatus = secStatusFail
	}
	checks = append(checks, &SecurityCheck{
		Key:      "prompt_secret_scan",
		Status:   secretStatus,
		Severity: secSevHigh,
		Meta:     map[string]interface{}{"categories": matchedCats},
	})

	// External API key hygiene: flag when the key is echoed back into any text
	// field the client can read (prompt/description/welcome/brief).
	apiKeyStatus := secStatusPass
	leaked := false
	if store.ExternalApiKey != "" && store.ExternalApiKey != "***" {
		if strings.Contains(haystack, store.ExternalApiKey) {
			leaked = true
			apiKeyStatus = secStatusFail
		}
	}
	checks = append(checks, &SecurityCheck{
		Key:      "api_key_exposure",
		Status:   apiKeyStatus,
		Severity: secSevHigh,
		Meta:     map[string]interface{}{"hasKey": store.ExternalApiKey != "", "leaked": leaked},
	})

	// Content moderation list.
	moderationStatus := secStatusPass
	if len(store.ForbiddenWords) == 0 {
		moderationStatus = secStatusWarn
	}
	checks = append(checks, &SecurityCheck{
		Key:      "content_moderation",
		Status:   moderationStatus,
		Severity: secSevMedium,
		Meta:     map[string]interface{}{"wordCount": len(store.ForbiddenWords)},
	})

	// File-upload exposure — public agent + open uploads is the risky combo.
	uploadStatus := secStatusPass
	if published && !store.DisableFileUpload {
		uploadStatus = secStatusWarn
	}
	checks = append(checks, &SecurityCheck{
		Key:      "file_upload_policy",
		Status:   uploadStatus,
		Severity: secSevMedium,
		Meta:     map[string]interface{}{"disabled": store.DisableFileUpload, "published": published},
	})

	// Public exposure — informational when published.
	exposureStatus := secStatusPass
	if published {
		exposureStatus = secStatusWarn
	}
	checks = append(checks, &SecurityCheck{
		Key:      "public_exposure",
		Status:   exposureStatus,
		Severity: secSevLow,
		Meta:     map[string]interface{}{"published": published},
	})

	// Capability / tool attack surface.
	toolCount := len(store.Tools)
	skillCount := len(store.Skills)
	hasMcp := store.McpServer != ""
	surfaceStatus := secStatusPass
	if toolCount+skillCount > 0 || hasMcp {
		surfaceStatus = secStatusWarn
	}
	checks = append(checks, &SecurityCheck{
		Key:      "tool_attack_surface",
		Status:   surfaceStatus,
		Severity: secSevLow,
		Meta:     map[string]interface{}{"toolCount": toolCount, "skillCount": skillCount, "hasMcp": hasMcp},
	})

	// Co-owner access control — more write-capable owners = larger blast radius.
	coOwnerStatus := secStatusPass
	if len(store.Owners) > 1 {
		coOwnerStatus = secStatusWarn
	}
	checks = append(checks, &SecurityCheck{
		Key:      "access_control",
		Status:   coOwnerStatus,
		Severity: secSevLow,
		Meta:     map[string]interface{}{"ownerCount": len(store.Owners)},
	})

	return checks
}

// finalizePosture tallies pass/warn/fail counts and derives the score + grade.
func finalizePosture(res *StoreSecurity) {
	score := 100
	for _, c := range res.Checks {
		switch c.Status {
		case secStatusPass:
			res.PassCount++
		case secStatusWarn:
			res.WarnCount++
		case secStatusFail:
			res.FailCount++
		}
		score -= severityPenalty(c.Status, c.Severity)
	}
	if score < 0 {
		score = 0
	}
	res.Score = score
	res.Grade = gradeForScore(score)

	// Stable ordering: fail first, then warn, then pass; break ties by severity
	// (high → low) so the most urgent items float to the top of the list.
	sevRank := map[string]int{secSevHigh: 0, secSevMedium: 1, secSevLow: 2}
	statusRank := map[string]int{secStatusFail: 0, secStatusWarn: 1, secStatusPass: 2}
	sort.SliceStable(res.Checks, func(i, j int) bool {
		if statusRank[res.Checks[i].Status] != statusRank[res.Checks[j].Status] {
			return statusRank[res.Checks[i].Status] < statusRank[res.Checks[j].Status]
		}
		return sevRank[res.Checks[i].Severity] < sevRank[res.Checks[j].Severity]
	})
}

// redactSnippet returns a short window of text around the matched word with the
// match itself masked, so reviewers see context without the raw offending term.
func redactSnippet(text string, word string) string {
	const pad = 30
	lower := strings.ToLower(text)
	idx := strings.Index(lower, strings.ToLower(word))
	if idx < 0 {
		if len(text) > 2*pad {
			return text[:2*pad] + "…"
		}
		return text
	}
	startPos := idx - pad
	if startPos < 0 {
		startPos = 0
	}
	endPos := idx + len(word) + pad
	if endPos > len(text) {
		endPos = len(text)
	}
	prefix := ""
	if startPos > 0 {
		prefix = "…"
	}
	suffix := ""
	if endPos < len(text) {
		suffix = "…"
	}
	masked := maskWord(word)
	return prefix + text[startPos:idx] + masked + text[idx+len(word):endPos] + suffix
}

func maskWord(word string) string {
	r := []rune(word)
	if len(r) <= 2 {
		return strings.Repeat("*", len(r))
	}
	return string(r[0]) + strings.Repeat("*", len(r)-2) + string(r[len(r)-1])
}
