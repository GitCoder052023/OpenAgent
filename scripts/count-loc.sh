#!/usr/bin/env bash
set -eo pipefail

# Script to calculate core lines of code (LOC), excluding docs, configs, and shell scripts.

EXCLUDED_LANGS=(
  "Markdown"
  "Text"
  "Bourne Shell"
  "YAML"
  "TOML"
  "JSON"
  "Bourne Again Shell"
  "SVG"
  "TableGen"
)

EXCLUDED_DIRS=(
  "node_modules"
  ".venv"
  "venv"
  ".pytest_cache"
  "dist"
  "build"
  ".git"
  "__pycache__"
  "*.egg-info"
)

# Join array elements with commas
IFS=','
EXCLUDE_LANG_STR="${EXCLUDED_LANGS[*]}"
EXCLUDE_DIR_STR="${EXCLUDED_DIRS[*]}"
unset IFS

# Locate cloc executable or fall back to npx
CLOC_BIN=""
if command -v cloc >/dev/null 2>&1; then
  CLOC_BIN="cloc"
elif command -v npx >/dev/null 2>&1; then
  CLOC_BIN="npx --yes cloc"
else
  echo "Error: Neither 'cloc' nor 'npx' is available in PATH." >&2
  exit 1
fi

if [ $# -eq 0 ]; then
  exec $CLOC_BIN \
    --vcs=git \
    --exclude-lang="$EXCLUDE_LANG_STR" \
    --exclude-dir="$EXCLUDE_DIR_STR" \
    .
else
  exec $CLOC_BIN \
    --exclude-lang="$EXCLUDE_LANG_STR" \
    --exclude-dir="$EXCLUDE_DIR_STR" \
    "$@"
fi
