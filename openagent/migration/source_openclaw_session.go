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

// OpenClaw transcript reader.
//
// OpenClaw keeps conversation history in two places under an agent directory:
//
//	<agent>/sessions/*.jsonl              archived transcripts
//	<agent>/agent/openclaw-agent.sqlite   live session + transcript-event rows
//
// Neither format is covered by a published, stable schema, and the SQLite one
// is explicitly versioned per release. So this reader is written to discover
// structure rather than assume it: field names are matched against candidate
// lists, and anything it cannot interpret becomes a migration warning instead
// of a hard failure. Losing a transcript is survivable; silently importing
// garbage into a user's chat history is not.

package migration

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/the-open-agent/openagent/util"

	// The pure-Go SQLite driver, imported here rather than relied on through
	// another package's init: this package must be able to read a transcript
	// database on its own, in tests as well as in the running server.
	_ "modernc.org/sqlite"
)

// readOpenClawTranscripts loads every conversation it can find for one agent.
func readOpenClawTranscripts(agentDir string, agentName string) ([]*BundleChat, []string) {
	chats, warnings := readOpenClawJsonlTranscripts(filepath.Join(agentDir, "sessions"), agentName)

	// The SQLite store is only consulted when no archived transcript was found,
	// so a session that exists in both places is not imported twice.
	if len(chats) == 0 {
		sqliteChats, sqliteWarnings := readOpenClawSqliteTranscripts(filepath.Join(agentDir, "agent"), agentName)
		chats = append(chats, sqliteChats...)
		warnings = append(warnings, sqliteWarnings...)
	}

	return chats, warnings
}

// ---------------------------------------------------------------------------
// JSONL transcripts
// ---------------------------------------------------------------------------

// maxTranscriptLineSize caps a single JSONL record. Transcript lines can carry
// large tool payloads, so the default bufio.Scanner limit is far too small.
const maxTranscriptLineSize = 8 << 20

func readOpenClawJsonlTranscripts(sessionsDir string, agentName string) ([]*BundleChat, []string) {
	entries, err := os.ReadDir(sessionsDir)
	if err != nil {
		return nil, nil
	}

	chats := []*BundleChat{}
	warnings := []string{}

	names := []string{}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(strings.ToLower(entry.Name()), ".jsonl") {
			names = append(names, entry.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		chat, warning := readOpenClawJsonlFile(filepath.Join(sessionsDir, name), agentName)
		if warning != "" {
			warnings = append(warnings, warning)
		}
		if chat != nil {
			chats = append(chats, chat)
		}
	}

	return chats, warnings
}

func readOpenClawJsonlFile(path string, agentName string) (*BundleChat, string) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Sprintf("%s: %s", filepath.Base(path), err.Error())
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 64*1024), maxTranscriptLineSize)

	messages := []*BundleMessage{}
	skipped := 0

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || !strings.HasPrefix(line, "{") {
			continue
		}

		record := map[string]interface{}{}
		if err = json.Unmarshal([]byte(line), &record); err != nil {
			skipped++
			continue
		}

		message := buildBundleMessageFromRecord(record)
		if message == nil {
			skipped++
			continue
		}
		messages = append(messages, message)
	}

	if err = scanner.Err(); err != nil {
		return nil, fmt.Sprintf("%s: %s", filepath.Base(path), err.Error())
	}
	if len(messages) == 0 {
		return nil, ""
	}

	warning := ""
	if skipped > 0 {
		warning = fmt.Sprintf("%s: %d non-conversation events (tool calls, summaries) were not migrated",
			filepath.Base(path), skipped)
	}

	name := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	return &BundleChat{
		Name:        name,
		DisplayName: name,
		Agent:       agentName,
		CreatedTime: messages[0].CreatedTime,
		UpdatedTime: messages[len(messages)-1].CreatedTime,
		Messages:    messages,
	}, warning
}

// roleFieldNames / contentFieldNames / timeFieldNames list the field spellings
// seen across OpenClaw transcript versions, most specific first.
var (
	roleFieldNames    = []string{"role", "author", "speaker", "from", "type"}
	contentFieldNames = []string{"content", "text", "message", "body"}
	timeFieldNames    = []string{"timestamp", "createdAt", "created_at", "time", "ts", "at"}
)

// buildBundleMessageFromRecord interprets one transcript event as a chat turn,
// or returns nil when the event is not a conversation message.
func buildBundleMessageFromRecord(record map[string]interface{}) *BundleMessage {
	role := ""
	for _, field := range roleFieldNames {
		if value, ok := record[field].(string); ok && value != "" {
			role = strings.ToLower(value)
			break
		}
	}

	author := ""
	switch {
	case strings.Contains(role, "assistant") || strings.Contains(role, "agent") || role == "ai" || role == "bot":
		author = "AI"
	case strings.Contains(role, "user") || strings.Contains(role, "human"):
		author = "Human"
	default:
		// system prompts, tool calls, compaction summaries: not chat turns.
		return nil
	}

	text := ""
	for _, field := range contentFieldNames {
		if value, ok := record[field]; ok {
			text = flattenTranscriptContent(value)
			if text != "" {
				break
			}
		}
	}
	if strings.TrimSpace(text) == "" {
		return nil
	}

	createdTime := ""
	for _, field := range timeFieldNames {
		if value, ok := record[field]; ok {
			createdTime = parseTranscriptTime(value)
			if createdTime != "" {
				break
			}
		}
	}

	return &BundleMessage{
		Author:      author,
		Text:        text,
		CreatedTime: createdTime,
	}
}

// flattenTranscriptContent renders a content value as plain text. Content is a
// bare string in older transcripts and an array of typed parts in newer ones.
func flattenTranscriptContent(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed

	case []interface{}:
		parts := []string{}
		for _, item := range typed {
			if part := flattenTranscriptContent(item); part != "" {
				parts = append(parts, part)
			}
		}
		return strings.Join(parts, "\n")

	case map[string]interface{}:
		// A typed content part: only text parts carry conversation content.
		if partType, ok := typed["type"].(string); ok && partType != "" && partType != "text" {
			return ""
		}
		for _, field := range contentFieldNames {
			if inner, ok := typed[field]; ok {
				if part := flattenTranscriptContent(inner); part != "" {
					return part
				}
			}
		}
		return ""
	}

	return ""
}

// parseTranscriptTime normalizes the several timestamp encodings OpenClaw uses
// into OpenAgent's string format.
func parseTranscriptTime(value interface{}) string {
	switch typed := value.(type) {
	case string:
		for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02T15:04:05", "2006-01-02 15:04:05"} {
			if parsed, err := time.Parse(layout, typed); err == nil {
				return util.FormatTimeForCompare(parsed)
			}
		}
		if millis, err := strconv.ParseInt(typed, 10, 64); err == nil {
			return timeFromEpoch(millis)
		}
	case float64:
		return timeFromEpoch(int64(typed))
	case int64:
		return timeFromEpoch(typed)
	}
	return ""
}

// timeFromEpoch accepts both second and millisecond epochs: values past the
// year 5138 in seconds are certainly milliseconds.
func timeFromEpoch(value int64) string {
	if value <= 0 {
		return ""
	}
	if value > 1e11 {
		return util.FormatTimeForCompare(time.UnixMilli(value))
	}
	return util.FormatTimeForCompare(time.Unix(value, 0))
}

// ---------------------------------------------------------------------------
// SQLite transcripts
// ---------------------------------------------------------------------------

// sqliteDriverName is the name modernc.org/sqlite registers itself under. The
// storage layer re-registers the same driver as "sqlite3" for xorm's benefit,
// but that name only exists once the object package has been linked in, which
// is not something this package should depend on.
const sqliteDriverName = "sqlite"

// readOpenClawSqliteTranscripts opens every SQLite file in dir read-only and
// tries to recover conversations from it.
func readOpenClawSqliteTranscripts(dir string, agentName string) ([]*BundleChat, []string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, nil
	}

	chats := []*BundleChat{}
	warnings := []string{}

	for _, entry := range entries {
		name := strings.ToLower(entry.Name())
		if entry.IsDir() || !(strings.HasSuffix(name, ".sqlite") || strings.HasSuffix(name, ".db")) {
			continue
		}

		fileChats, warning := readOpenClawSqliteFile(filepath.Join(dir, entry.Name()), agentName)
		if warning != "" {
			warnings = append(warnings, warning)
		}
		chats = append(chats, fileChats...)
	}

	return chats, warnings
}

func readOpenClawSqliteFile(path string, agentName string) ([]*BundleChat, string) {
	// Read-only and immutable: the user's live OpenClaw database must never be
	// modified or locked by a migration preview.
	dsn := fmt.Sprintf("file:%s?mode=ro&immutable=1", filepath.ToSlash(path))
	db, err := sql.Open(sqliteDriverName, dsn)
	if err != nil {
		return nil, fmt.Sprintf("%s: %s", filepath.Base(path), err.Error())
	}
	defer db.Close()

	table, columns, err := findTranscriptTable(db)
	if err != nil {
		return nil, fmt.Sprintf("%s: %s", filepath.Base(path), err.Error())
	}
	if table == "" {
		return nil, fmt.Sprintf("%s: no recognizable transcript table; this OpenClaw schema version is not supported, archived JSONL sessions still migrate", filepath.Base(path))
	}

	chats, err := readTranscriptTable(db, table, columns, agentName)
	if err != nil {
		return nil, fmt.Sprintf("%s: %s", filepath.Base(path), err.Error())
	}
	return chats, ""
}

// transcriptColumns names the columns the reader managed to identify.
type transcriptColumns struct {
	session string
	role    string
	content string
	time    string
}

// findTranscriptTable inspects the schema and returns the first table that has
// both a role-like and a content-like column.
func findTranscriptTable(db *sql.DB) (string, transcriptColumns, error) {
	rows, err := db.Query("SELECT name FROM sqlite_master WHERE type = 'table'")
	if err != nil {
		return "", transcriptColumns{}, err
	}
	defer rows.Close()

	tables := []string{}
	for rows.Next() {
		name := ""
		if err = rows.Scan(&name); err != nil {
			return "", transcriptColumns{}, err
		}
		tables = append(tables, name)
	}
	if err = rows.Err(); err != nil {
		return "", transcriptColumns{}, err
	}

	// Prefer tables whose name hints at transcripts, then fall back to any
	// table that structurally looks like one.
	sort.SliceStable(tables, func(i, j int) bool {
		return transcriptTableRank(tables[i]) < transcriptTableRank(tables[j])
	})

	for _, table := range tables {
		columns, err := readTableColumns(db, table)
		if err != nil {
			continue
		}

		resolved := transcriptColumns{
			session: pickColumn(columns, []string{"session_id", "sessionid", "session", "conversation_id", "chat_id", "thread_id"}),
			role:    pickColumn(columns, roleFieldNames),
			content: pickColumn(columns, contentFieldNames),
			time:    pickColumn(columns, timeFieldNames),
		}
		if resolved.role != "" && resolved.content != "" {
			return table, resolved, nil
		}
	}

	return "", transcriptColumns{}, nil
}

func transcriptTableRank(name string) int {
	lowered := strings.ToLower(name)
	for rank, hint := range []string{"transcript", "message", "event", "turn"} {
		if strings.Contains(lowered, hint) {
			return rank
		}
	}
	return 100
}

func readTableColumns(db *sql.DB, table string) ([]string, error) {
	// Table names come from sqlite_master, not from user input, but they are
	// still quoted so an exotic name cannot break the statement.
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", quoteSqliteIdentifier(table)))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := []string{}
	for rows.Next() {
		var (
			cid        int
			name       string
			columnType sql.NullString
			notNull    sql.NullInt64
			dflt       sql.NullString
			pk         sql.NullInt64
		)
		if err = rows.Scan(&cid, &name, &columnType, &notNull, &dflt, &pk); err != nil {
			return nil, err
		}
		columns = append(columns, name)
	}
	return columns, rows.Err()
}

// pickColumn returns the first column whose lowercased name matches a candidate.
func pickColumn(columns []string, candidates []string) string {
	for _, candidate := range candidates {
		for _, column := range columns {
			if strings.EqualFold(column, candidate) {
				return column
			}
		}
	}
	return ""
}

func quoteSqliteIdentifier(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

// maxSqliteTranscriptRows bounds a single import; a runaway event table should
// not turn a migration into an out-of-memory failure.
const maxSqliteTranscriptRows = 200000

func readTranscriptTable(db *sql.DB, table string, columns transcriptColumns, agentName string) ([]*BundleChat, error) {
	selected := []string{quoteSqliteIdentifier(columns.role), quoteSqliteIdentifier(columns.content)}
	if columns.session != "" {
		selected = append(selected, quoteSqliteIdentifier(columns.session))
	}
	if columns.time != "" {
		selected = append(selected, quoteSqliteIdentifier(columns.time))
	}

	query := fmt.Sprintf("SELECT %s FROM %s LIMIT %d",
		strings.Join(selected, ", "), quoteSqliteIdentifier(table), maxSqliteTranscriptRows)

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// sessionId -> ordered messages
	bySession := map[string][]*BundleMessage{}
	order := []string{}

	for rows.Next() {
		values := make([]interface{}, len(selected))
		holders := make([]sql.NullString, len(selected))
		for i := range holders {
			values[i] = &holders[i]
		}
		if err = rows.Scan(values...); err != nil {
			return nil, err
		}

		record := map[string]interface{}{
			"role": holders[0].String,
		}
		// Content may itself be a JSON blob of typed parts.
		content := holders[1].String
		var parsed interface{}
		if json.Unmarshal([]byte(content), &parsed) == nil {
			record["content"] = parsed
		} else {
			record["content"] = content
		}

		index := 2
		sessionId := "session"
		if columns.session != "" {
			if holders[index].Valid && holders[index].String != "" {
				sessionId = holders[index].String
			}
			index++
		}
		if columns.time != "" {
			record["timestamp"] = holders[index].String
		}

		message := buildBundleMessageFromRecord(record)
		if message == nil {
			continue
		}

		if _, ok := bySession[sessionId]; !ok {
			order = append(order, sessionId)
		}
		bySession[sessionId] = append(bySession[sessionId], message)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	chats := []*BundleChat{}
	for _, sessionId := range order {
		messages := bySession[sessionId]
		if len(messages) == 0 {
			continue
		}
		chats = append(chats, &BundleChat{
			Name:        sessionId,
			DisplayName: sessionId,
			Agent:       agentName,
			CreatedTime: messages[0].CreatedTime,
			UpdatedTime: messages[len(messages)-1].CreatedTime,
			Messages:    messages,
		})
	}
	return chats, nil
}
