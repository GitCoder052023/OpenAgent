#!/usr/bin/env python3
"""Regenerate lib/demo.ts, the replay data behind the transport demonstration.

Tool names and argument keys come from README.md § Tool Suite; the envelope
strings are produced here by actually base64-encoding the JSON printed beside
them, exactly as docs/JARVIS_INSTRUCTIONS.md specifies, so nothing on the page
is a hand-typed approximation of the protocol. Results are illustrative.

    python3 src/apps/website/scripts/generate-demo.py
"""

from pathlib import Path
import json, base64

OUT = Path(__file__).resolve().parents[1] / "lib/demo.ts"


def env(tool, args):
    payload = {"tool": tool, "args": args}
    raw = json.dumps(payload, ensure_ascii=False)
    return raw, base64.b64encode(raw.encode("utf-8")).decode("ascii")

# sanity-check against the documented example in docs/JARVIS_INSTRUCTIONS.md
_raw, _b64 = env("bash", {"command": "git status"})
assert _b64 == "eyJ0b29sIjogImJhc2giLCAiYXJncyI6IHsiY29tbWFuZCI6ICJnaXQgc3RhdHVzIn19", _b64

def step(tool, args, arg_label, result):
    raw, b64 = env(tool, args)
    return {"tool": tool, "json": raw, "envelope": b64, "argLabel": arg_label, "result": result}

scenarios = [
  {
    "id": "ship",
    "label": "Ship, then post",
    "engines": "Developer harness → Social automation",
    "turns": [
      {
        "spoken": "Run the test suite on OpenAgent. If it's green, post a Threads update about what I shipped today.",
        "aside": "making coffee",
        "steps": [
          step("bash", {"command": "./test.py"}, "./test.py", "260 passed"),
          step("bash", {"command": "git log --since=midnight --oneline"}, "git log --since=midnight", "6 commits"),
          step("social_dedup_check", {"platform": "threads", "action": "post"}, "threads / post", "not yet posted"),
          step("social_post", {"platform": "threads", "text": "Shipped offline wake-word detection today — one Whisper Large V3 Turbo model now handles both the wake phrase and transcription, fully on-device."}, "threads.net (authenticated profile)", "published"),
        ],
        "reply": "All 260 tests passed. The update is live on Threads.",
      },
      {
        "spoken": "Show me what it looks like.",
        "aside": "from the couch",
        "steps": [
          step("social_screenshot", {"platform": "threads"}, "live Chrome session", "delivered to WhatsApp"),
        ],
        "reply": "Screenshot's in your chat.",
      },
    ],
  },
  {
    "id": "late",
    "label": "Running late",
    "engines": "WhatsApp protocol engine",
    "turns": [
      {
        "spoken": "Message Sarah that I'm running five minutes late.",
        "aside": "walking to the car",
        "steps": [
          step("whatsapp_contacts", {"query": "Sarah"}, "query: Sarah", "1 match"),
          step("whatsapp_send", {"recipient": "sarah", "message": "Running 5 minutes late — leaving now."}, "sarah", "sent"),
        ],
        "reply": "Told Sarah you're five minutes behind.",
      },
    ],
  },
  {
    "id": "brief",
    "label": "Read it, write it up",
    "engines": "Web ingestion → Office documents → Delivery",
    "turns": [
      {
        "spoken": "Pull what's being said about Apple Silicon inference benchmarks and put it in a Word doc for me.",
        "aside": "mid-game, fullscreen",
        "steps": [
          step("firecrawl_search", {"query": "Apple Silicon inference benchmarks", "limit": 5}, "limit: 5", "5 results, full markdown"),
          step("firecrawl_scrape", {"url": "https://example.org/benchmarks", "formats": ["markdown"], "only_main_content": True}, "formats: markdown", "main content only"),
          step("word_write", {"path": "~/Desktop/inference-brief.docx", "title": "Apple Silicon inference — field notes"}, "~/Desktop/inference-brief.docx", "written, 1 table"),
          step("whatsapp_file", {"recipient": "self", "file_path": "~/Desktop/inference-brief.docx"}, "self", "delivered"),
        ],
        "reply": "Brief's on your Desktop and in your chat. Your game never lost focus.",
      },
    ],
  },
]

lines = []
lines.append('// Illustrative replay data for the transport demonstration.')
lines.append('// Tool names and argument keys come from README.md § Tool Suite; the envelope')
lines.append('// strings are genuine base64 of the JSON shown beside them, encoded exactly as')
lines.append('// docs/JARVIS_INSTRUCTIONS.md specifies. Results are illustrative, not measured.')
lines.append('')
lines.append('export type DemoStep = {')
lines.append('  tool: string;')
lines.append('  json: string;')
lines.append('  envelope: string;')
lines.append('  argLabel: string;')
lines.append('  result: string;')
lines.append('};')
lines.append('')
lines.append('export type DemoTurn = {')
lines.append('  spoken: string;')
lines.append('  aside: string;')
lines.append('  steps: DemoStep[];')
lines.append('  reply: string;')
lines.append('};')
lines.append('')
lines.append('export type DemoScenario = {')
lines.append('  id: string;')
lines.append('  label: string;')
lines.append('  engines: string;')
lines.append('  turns: DemoTurn[];')
lines.append('};')
lines.append('')
lines.append('export const scenarios: DemoScenario[] = ' + json.dumps(scenarios, indent=2, ensure_ascii=False) + ';')
lines.append('')

OUT.open('w', encoding='utf-8').write('\n'.join(lines))
print(f"wrote {OUT.name}: {sum(len(t['steps']) for s in scenarios for t in s['turns'])} verified envelopes")
