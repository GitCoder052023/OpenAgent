#!/usr/bin/env python3
"""Regenerate lib/tools.ts from the repository README's tool tables.

The site's tool reference is not transcribed by hand — it is parsed out of
README.md § Tool Suite so the two can never drift. Run this after changing
the tool tables:

    python3 src/apps/website/scripts/generate-tools.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
README = ROOT / "README.md"
OUT = ROOT / "src/apps/website/lib/tools.ts"

# summary → (slug, display label, what the engine is built on)
CATEGORIES = {
    "Developer Harness Tools": ("developer-harness", "Developer harness", "Bun + TypeScript"),
    "Native macOS Computer-Use Tools": ("computer-use", "Native computer use", "macOS Accessibility & Quartz"),
    "Browser Automation Tools": ("browser", "Browser automation", "Browser Harness (CDP)"),
    "Web Ingestion & Extraction Tools": ("web", "Web ingestion & extraction", "Self-hosted Firecrawl"),
    "Social Media Automation Tools": ("social", "Social media automation", "LocoAgent (CDP)"),
    "Native macOS Productivity Tools": ("productivity", "macOS productivity", "skills_adapter.py"),
    "Office Document Tools": ("office", "Office documents", "python-docx / openpyxl / python-pptx"),
    "WhatsApp Protocol Tools": ("whatsapp", "WhatsApp protocol", "whatsmeow + MCP"),
    "Universal Model Context Protocol (MCP) Tools": ("mcp", "Universal MCP client", "Model Context Protocol"),
}

# Four categories have no prose above their table in the README; these summaries
# come from README.md § Core Features for the matching engine.
FALLBACK_INTROS = {
    "developer-harness": "Sandboxed bash, paginated read, atomic write, exact-match edit, ripgrep regex search, glob, and AppleScript — the primitives a coding agent needs, running directly on your machine.",
    "computer-use": "Window capture, Accessibility tree queries, PID-targeted clicks, keystrokes, drags and scrolls that do not steal focus from whatever you are doing.",
    "browser": "Your authenticated, everyday Chrome: background tabs, compositor clicks through iframes and shadow DOM, framework-safe form filling, and 97 domain-specific skills.",
    "web": "Scrape to clean Markdown, search with full-content results, recursive crawl, site mapping and schema-based JSON extraction, against a Firecrawl daemon you host yourself.",
}

# Colour emoji are the one thing that breaks the page's achromatic palette.
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️⬀-⯿]")
DOCS_POINTER = re.compile(r"\s*\U0001F449 \*Full setup.*?\*", re.S)


def strip_emoji(text: str) -> str:
    """Drop colour emoji, and any parenthetical left empty by dropping them."""
    text = EMOJI.sub("", text)
    text = re.sub(r"\s*\(\s*[,\s]*\)", "", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def clean(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)   # markdown links
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)           # bold
    text = text.replace("`", "")
    return re.sub(r"\s+", " ", text).strip()


def parse() -> list[dict]:
    src = README.read_text(encoding="utf-8")
    blocks = re.findall(r"<details>\s*<summary>(.*?)</summary>(.*?)</details>", src, re.S)

    categories = []
    for summary, body in blocks:
        match = re.match(r"<b>(.*?)</b>\s*\((\d+)\s*tools?\)", summary.strip())
        if not match:
            continue
        name, declared = match.group(1).strip(), int(match.group(2))
        if name not in CATEGORIES:
            sys.exit(f"Unknown tool category in README: {name!r}")
        slug, label, built_on = CATEGORIES[name]

        intro = clean(DOCS_POINTER.sub("", body.split("| Tool |")[0]))
        intro = "\n".join(l for l in intro.splitlines() if not l.startswith(">"))
        intro = intro.rstrip(":") + "." if intro and not intro.endswith(".") else intro
        intro = intro or FALLBACK_INTROS[slug]

        tools = []
        for line in body.splitlines():
            line = line.strip()
            if not line.startswith("|"):
                continue
            cells = [c.strip() for c in line.strip("|").split("|")]
            if len(cells) < 3 or cells[0] == "Tool" or set(cells[0]) <= set("- :"):
                continue
            args = [] if cells[2] in ("*(none)*", "_(none)_") else [
                a.strip().strip("`") for a in cells[2].split(",") if a.strip()
            ]
            tools.append({
                "name": cells[0].strip("`"),
                "summary": strip_emoji(clean(cells[1])),
                "args": args,
            })

        if len(tools) != declared:
            print(f"warning: {name} declares {declared} tools, parsed {len(tools)}", file=sys.stderr)

        categories.append({
            "slug": slug, "label": label, "builtOn": built_on,
            "intro": intro, "tools": tools,
        })
    return categories


def emit(categories: list[dict]) -> str:
    def s(value: str) -> str:
        return json.dumps(value, ensure_ascii=False)

    out = [
        "// Generated from the repository README.md tool tables — do not edit by hand.",
        "// Run: python3 src/apps/website/scripts/generate-tools.py",
        "",
        "export type Tool = {", "  name: string;", "  summary: string;", "  args: string[];", "};", "",
        "export type ToolCategory = {", "  slug: string;", "  label: string;", "  builtOn: string;",
        "  intro: string;", "  tools: Tool[];", "};", "",
        "export const toolCategories: ToolCategory[] = [",
    ]
    for c in categories:
        out += [
            "  {",
            f"    slug: {s(c['slug'])},",
            f"    label: {s(c['label'])},",
            f"    builtOn: {s(c['builtOn'])},",
            f"    intro:\n      {s(c['intro'])},",
            "    tools: [",
        ]
        for t in c["tools"]:
            args = ", ".join(s(a) for a in t["args"])
            out += [
                "      {",
                f"        name: {s(t['name'])},",
                f"        summary:\n          {s(t['summary'])},",
                f"        args: [{args}],",
                "      },",
            ]
        out += ["    ],", "  },"]
    out += [
        "];", "",
        "export const toolCount = toolCategories.reduce((n, c) => n + c.tools.length, 0);",
        "",
    ]
    return "\n".join(out)


if __name__ == "__main__":
    categories = parse()
    OUT.write_text(emit(categories), encoding="utf-8")
    total = sum(len(c["tools"]) for c in categories)
    print(f"wrote {OUT.relative_to(ROOT)}: {total} tools across {len(categories)} categories")
