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

// Package cli handles command-line dispatch before heavy application init.
package cli

import (
	"fmt"
	"os"
	"path/filepath"
)

const progName = "openagent"

// EarlyDispatch handles CLI-only commands (help, version) and normalizes argv for
// optional serve-style subcommands. If it returns handled=true, the process should
// exit with code exitCode. When handled is false, InitFlag may parse remaining flags
// (e.g. -createDatabase). openBrowser is always false here; main() calls
// util.IsDoubleClicked() to decide whether to open a browser after the server starts.
func EarlyDispatch() (handled bool, exitCode int, openBrowser bool) {
	for {
		if len(os.Args) <= 1 {
			return false, 0, false
		}

		first := os.Args[1]

		switch first {
		case "-v", "--version", "version":
			printVersion()
			return true, 0, false
		case "-h", "--help", "help":
			printHelp()
			return true, 0, false
		case "serve", "gateway", "run", "start":
			// Match OpenClaw-style explicit "gateway" while keeping zero-arg default as serve.
			os.Args = append([]string{os.Args[0]}, os.Args[2:]...)
			return false, 0, false
		default:
			if len(first) > 0 && first[0] == '-' {
				// Legacy/global flags such as -createDatabase — leave argv for flag.Parse.
				return false, 0, false
			}
			fmt.Fprintf(os.Stderr, "%s: unknown command %q\nRun '%s help' for usage.\n", progName, first, progName)
			return true, 2, false
		}
	}
}

func printVersion() {
	exe := progName
	if len(os.Args) > 0 && os.Args[0] != "" {
		exe = filepath.Base(os.Args[0])
	}
	fmt.Printf("%s %s\n", exe, Version)
	if Commit != "unknown" || BuildDate != "unknown" {
		fmt.Printf("commit %s\nbuild %s\n", Commit, BuildDate)
	}
}

func printHelp() {
	exe := progName
	if len(os.Args) > 0 && os.Args[0] != "" {
		exe = filepath.Base(os.Args[0])
	}
	fmt.Printf(`%[1]s — personal AI assistant with MCP / A2A support

Without arguments, %[1]s starts the HTTP API server (same as %[1]s serve).

Usage:
  %[1]s                     Start the HTTP server (default)
  %[1]s serve               Start the HTTP server (explicit)
  %[1]s gateway             Same as serve (OpenClaw-style alias)
  %[1]s run | start         Same as serve
  %[1]s version             Print version (%[1]s -v, %[1]s --version)
  %[1]s help                Show this help (%[1]s -h, %[1]s --help)

Server flags (parsed after optional subcommand):
  -createDatabase           Create the database on startup when needed

Examples:
  %[1]s
  %[1]s gateway
  %[1]s serve -createDatabase

Release builds can embed version via go build -ldflags (see internal/cli.Version).
`, exe)
}
