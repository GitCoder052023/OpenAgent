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
	"encoding/json"
	"strings"
)

// JSON5 support for migration adapters.
//
// OpenClaw's config file is JSON5 -- comments, unquoted keys, single-quoted
// strings and trailing commas are all normal in a hand-edited openclaw.json.
// The module has no JSON5 dependency, so instead of adding one for a single
// importer, normalizeJson5 rewrites the handful of JSON5 constructs that
// actually appear in config files into plain JSON.
//
// This is deliberately not a complete JSON5 implementation: hex numbers,
// leading-dot floats and line continuations are left alone. If a config uses
// them, encoding/json reports the error and the adapter surfaces it, which is
// far better than silently mis-parsing.

// parseJson5 unmarshals JSON5 text into v.
func parseJson5(data []byte, v interface{}) error {
	return json.Unmarshal([]byte(normalizeJson5(string(data))), v)
}

// normalizeJson5 converts JSON5 text into plain JSON.
func normalizeJson5(input string) string {
	var out strings.Builder
	out.Grow(len(input))

	runes := []rune(input)
	for i := 0; i < len(runes); i++ {
		char := runes[i]

		switch {
		// Line comment.
		case char == '/' && i+1 < len(runes) && runes[i+1] == '/':
			for i < len(runes) && runes[i] != '\n' {
				i++
			}
			if i < len(runes) {
				out.WriteRune('\n')
			}

		// Block comment.
		case char == '/' && i+1 < len(runes) && runes[i+1] == '*':
			i += 2
			for i+1 < len(runes) && !(runes[i] == '*' && runes[i+1] == '/') {
				i++
			}
			i++

		// Double-quoted string: copied through verbatim, escapes included.
		case char == '"':
			out.WriteRune(char)
			i++
			for i < len(runes) {
				out.WriteRune(runes[i])
				if runes[i] == '\\' && i+1 < len(runes) {
					i++
					out.WriteRune(runes[i])
				} else if runes[i] == '"' {
					break
				}
				i++
			}

		// Single-quoted string: re-quoted as a JSON string.
		case char == '\'':
			i++
			var value strings.Builder
			for i < len(runes) && runes[i] != '\'' {
				if runes[i] == '\\' && i+1 < len(runes) {
					i++
					// A backslash-escaped single quote becomes a plain quote;
					// every other escape is preserved for encoding/json.
					if runes[i] != '\'' {
						value.WriteRune('\\')
					}
				}
				value.WriteRune(runes[i])
				i++
			}
			encoded, err := json.Marshal(value.String())
			if err != nil {
				out.WriteString(`""`)
			} else {
				out.Write(encoded)
			}

		// Bare identifier: quoted when it is used as an object key.
		case isJson5IdentifierStart(char):
			start := i
			for i < len(runes) && isJson5IdentifierPart(runes[i]) {
				i++
			}
			identifier := string(runes[start:i])
			i--

			if isFollowedByColon(runes, i+1) {
				encoded, err := json.Marshal(identifier)
				if err != nil {
					out.WriteString(identifier)
				} else {
					out.Write(encoded)
				}
			} else {
				out.WriteString(identifier)
			}

		default:
			out.WriteRune(char)
		}
	}

	return removeTrailingCommas(out.String())
}

func isJson5IdentifierStart(char rune) bool {
	return char == '_' || char == '$' ||
		(char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
}

func isJson5IdentifierPart(char rune) bool {
	return isJson5IdentifierStart(char) || (char >= '0' && char <= '9') || char == '-'
}

// isFollowedByColon reports whether the next non-whitespace rune is a colon,
// which is what distinguishes an object key from the literals true/false/null.
func isFollowedByColon(runes []rune, from int) bool {
	for i := from; i < len(runes); i++ {
		switch runes[i] {
		case ' ', '\t', '\r', '\n':
			continue
		case ':':
			return true
		default:
			return false
		}
	}
	return false
}

// removeTrailingCommas drops commas that sit right before a closing brace or
// bracket. Strings are skipped so a comma inside a value is never touched.
func removeTrailingCommas(input string) string {
	var out strings.Builder
	out.Grow(len(input))

	runes := []rune(input)
	for i := 0; i < len(runes); i++ {
		char := runes[i]

		if char == '"' {
			out.WriteRune(char)
			i++
			for i < len(runes) {
				out.WriteRune(runes[i])
				if runes[i] == '\\' && i+1 < len(runes) {
					i++
					out.WriteRune(runes[i])
				} else if runes[i] == '"' {
					break
				}
				i++
			}
			continue
		}

		if char == ',' {
			isTrailing := false
			for j := i + 1; j < len(runes); j++ {
				switch runes[j] {
				case ' ', '\t', '\r', '\n':
					continue
				case '}', ']':
					isTrailing = true
				}
				break
			}
			if isTrailing {
				continue
			}
		}

		out.WriteRune(char)
	}

	return out.String()
}
