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

package migration

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

// writeTranscriptDb builds a SQLite file with the given schema and rows, in the
// spirit of what OpenClaw keeps under <agent>/agent/. The reader is written to
// discover structure rather than assume it, so the tests feed it several
// shapes on purpose.
func writeTranscriptDb(t *testing.T, path string, schema []string, rows [][]interface{}, insert string) {
	t.Helper()

	db, err := sql.Open(sqliteDriverName, filepath.ToSlash(path))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, statement := range schema {
		if _, err = db.Exec(statement); err != nil {
			t.Fatalf("exec %q: %s", statement, err.Error())
		}
	}
	for _, row := range rows {
		if _, err = db.Exec(insert, row...); err != nil {
			t.Fatalf("insert: %s", err.Error())
		}
	}
}

// sqliteAgentDir returns an <agent>/agent directory to drop databases into.
func sqliteAgentDir(t *testing.T) string {
	t.Helper()

	dir := filepath.Join(t.TempDir(), "agent")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestOpenClawSqliteTranscripts(t *testing.T) {
	dir := sqliteAgentDir(t)

	writeTranscriptDb(t, filepath.Join(dir, "openclaw-agent.sqlite"),
		[]string{
			// A settings table exists alongside the transcript one, so the
			// reader has to pick the right table rather than the first.
			`CREATE TABLE settings (key TEXT, value TEXT)`,
			`CREATE TABLE transcript_events (id INTEGER PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, created_at INTEGER)`,
		},
		[][]interface{}{
			{"sess-a", "user", "how do I export?", 1772359200000},
			{"sess-a", "assistant", `[{"type":"text","text":"Use the export command."}]`, 1772359202000},
			{"sess-b", "user", "second conversation", 1772362800000},
			// A tool event carries no readable content and must be dropped
			// rather than imported as an empty turn.
			{"sess-b", "tool", "", 1772362801000},
			{"sess-b", "assistant", "answering the second one", 1772362805000},
		},
		`INSERT INTO transcript_events (session_id, role, content, created_at) VALUES (?, ?, ?, ?)`)

	chats, warnings := readOpenClawSqliteTranscripts(dir, "store-main")
	if len(warnings) != 0 {
		t.Fatalf("got warnings %v, want none", warnings)
	}
	if len(chats) != 2 {
		t.Fatalf("got %d chats, want 2", len(chats))
	}

	first := chats[0]
	if first.Name != "sess-a" || first.Agent != "store-main" {
		t.Errorf("first chat = %q/%q, want sess-a/store-main", first.Name, first.Agent)
	}
	if len(first.Messages) != 2 {
		t.Fatalf("got %d messages in sess-a, want 2", len(first.Messages))
	}
	if first.Messages[0].Author != "Human" || first.Messages[0].Text != "how do I export?" {
		t.Errorf("first message = %+v", first.Messages[0])
	}
	// The typed-parts blob must be flattened, and the assistant turn must use
	// the "AI" author OpenAgent expects.
	if first.Messages[1].Author != "AI" || first.Messages[1].Text != "Use the export command." {
		t.Errorf("second message = %+v", first.Messages[1])
	}
	if first.CreatedTime == "" || first.UpdatedTime == "" {
		t.Errorf("chat times = %q/%q, want both set", first.CreatedTime, first.UpdatedTime)
	}
	if first.CreatedTime == first.UpdatedTime {
		t.Errorf("chat times are both %q, want the last message's time on UpdatedTime", first.CreatedTime)
	}

	second := chats[1]
	if second.Name != "sess-b" {
		t.Errorf("second chat = %q, want sess-b", second.Name)
	}
	if len(second.Messages) != 2 {
		t.Errorf("got %d messages in sess-b, want 2 (the empty tool event dropped)", len(second.Messages))
	}
}

// The schema is versioned per OpenClaw release, so the reader matches column
// names against candidate lists instead of one fixed spelling.
func TestOpenClawSqliteAlternativeSchema(t *testing.T) {
	dir := sqliteAgentDir(t)

	writeTranscriptDb(t, filepath.Join(dir, "history.db"),
		[]string{`CREATE TABLE messages (conversation_id TEXT, author TEXT, body TEXT, ts TEXT)`},
		[][]interface{}{
			{"c1", "human", "alternative column names", "2026-03-01T10:00:00Z"},
			{"c1", "assistant", "still readable", "2026-03-01T10:00:05Z"},
		},
		`INSERT INTO messages (conversation_id, author, body, ts) VALUES (?, ?, ?, ?)`)

	chats, warnings := readOpenClawSqliteTranscripts(dir, "store-main")
	if len(warnings) != 0 {
		t.Fatalf("got warnings %v, want none", warnings)
	}
	if len(chats) != 1 || len(chats[0].Messages) != 2 {
		t.Fatalf("got %d chats, want 1 with 2 messages", len(chats))
	}
	if chats[0].Messages[0].Text != "alternative column names" {
		t.Errorf("message text = %q", chats[0].Messages[0].Text)
	}
	if chats[0].Messages[1].Author != "AI" {
		t.Errorf("assistant author = %q, want AI", chats[0].Messages[1].Author)
	}
}

// An unreadable database is reported as a warning, never as a failed
// migration: the rest of the installation is still worth importing.
func TestOpenClawSqliteUnknownSchemaWarns(t *testing.T) {
	dir := sqliteAgentDir(t)

	writeTranscriptDb(t, filepath.Join(dir, "openclaw-agent.sqlite"),
		[]string{`CREATE TABLE settings (key TEXT, value TEXT)`},
		[][]interface{}{{"theme", "dark"}},
		`INSERT INTO settings (key, value) VALUES (?, ?)`)

	chats, warnings := readOpenClawSqliteTranscripts(dir, "store-main")
	if len(chats) != 0 {
		t.Errorf("got %d chats, want none", len(chats))
	}
	if len(warnings) != 1 {
		t.Fatalf("got warnings %v, want exactly one", warnings)
	}
}

// Archived JSONL wins over the live database, so a session present in both is
// not imported twice.
func TestOpenClawTranscriptsPreferJsonl(t *testing.T) {
	agentDir := t.TempDir()

	sessionsDir := filepath.Join(agentDir, "sessions")
	sqliteDir := filepath.Join(agentDir, "agent")
	for _, dir := range []string{sessionsDir, sqliteDir} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
	}

	transcript := `{"role":"user","content":"from jsonl","timestamp":"2026-03-01T10:00:00Z"}
{"role":"assistant","content":"answered","timestamp":"2026-03-01T10:00:01Z"}
`
	if err := os.WriteFile(filepath.Join(sessionsDir, "sess-a.jsonl"), []byte(transcript), 0o600); err != nil {
		t.Fatal(err)
	}

	writeTranscriptDb(t, filepath.Join(sqliteDir, "openclaw-agent.sqlite"),
		[]string{`CREATE TABLE transcript_events (session_id TEXT, role TEXT, content TEXT, created_at INTEGER)`},
		[][]interface{}{{"sess-a", "user", "from sqlite", 1772359200000}},
		`INSERT INTO transcript_events (session_id, role, content, created_at) VALUES (?, ?, ?, ?)`)

	chats, _ := readOpenClawTranscripts(agentDir, "store-main")
	if len(chats) != 1 {
		t.Fatalf("got %d chats, want 1", len(chats))
	}
	if chats[0].Messages[0].Text != "from jsonl" {
		t.Errorf("message text = %q, want the archived JSONL copy", chats[0].Messages[0].Text)
	}
}

func TestTimeFromEpoch(t *testing.T) {
	seconds := timeFromEpoch(1772359200)
	millis := timeFromEpoch(1772359200000)
	if seconds == "" || millis == "" {
		t.Fatalf("timeFromEpoch() = %q / %q, want both parsed", seconds, millis)
	}
	if seconds != millis {
		t.Errorf("second and millisecond epochs of the same instant differ: %q vs %q", seconds, millis)
	}
	if got := timeFromEpoch(0); got != "" {
		t.Errorf("timeFromEpoch(0) = %q, want empty", got)
	}
}

// A transcript larger than bufio.Scanner's default buffer must still be read:
// a single line can carry a whole tool payload.
func TestOpenClawJsonlHandlesLongLines(t *testing.T) {
	sessionsDir := filepath.Join(t.TempDir(), "sessions")
	if err := os.MkdirAll(sessionsDir, 0o755); err != nil {
		t.Fatal(err)
	}

	long := make([]byte, 200*1024)
	for i := range long {
		long[i] = 'x'
	}
	line := fmt.Sprintf(`{"role":"user","content":%q,"timestamp":"2026-03-01T10:00:00Z"}`, string(long))
	if err := os.WriteFile(filepath.Join(sessionsDir, "big.jsonl"), []byte(line+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	chats, _ := readOpenClawJsonlTranscripts(sessionsDir, "store-main")
	if len(chats) != 1 || len(chats[0].Messages) != 1 {
		t.Fatalf("got %d chats, want 1 with 1 message", len(chats))
	}
	if len(chats[0].Messages[0].Text) != len(long) {
		t.Errorf("message length = %d, want %d", len(chats[0].Messages[0].Text), len(long))
	}
}
