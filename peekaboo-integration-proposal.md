# Integrating Peekaboo with OpenAgent

Draft proposal, 2026-09-27. Research and design only; no code changes yet.

## 1. The short version

Peekaboo (https://github.com/openclaw/Peekaboo, originally steipete/Peekaboo) is a native macOS CLI for screen capture, accessibility inspection, and UI automation. Adding it to OpenAgent gives Instinct eyes and hands on the Mac: today the harness can only run shell commands and AppleScript, which means Instinct is blind. With Peekaboo, a voice request like "Jarvis, what's on my screen" or "open Safari and search for X" becomes a real end-to-end flow: Peekaboo captures and inspects the screen, the harness returns a compact text answer, and the bridge speaks it back.

## 2. What OpenAgent has today

From the current repo (private, GitCoder052023/OpenAgent):

- Harness tools (bridge/harness.py, harness/harness-bridge.ts): `bash`, `file_read`, `file_write`, `edit_file`, `list_directory`, `grep`, `glob`, `system_info`, `applescript`.
- Transport: `JARVIS_CALL:<base64 JSON>:END` envelopes over WhatsApp (bridge/dispatcher.py). Responses are capped at 3500 chars (`MAX_WHATSAPP_RESPONSE_LEN`), and envelopes over roughly 1500 chars risk being cut by the AX read limit, so calls already go out small and step-by-step.
- AX automation is used only for WhatsApp Desktop itself, fail-closed behind the exact-number header lock.

What is missing: anything visual. `bash` and `applescript` can drive apps that expose scripting, but Instinct cannot see what is on screen, find a button by its label, confirm a click worked, or operate apps with weak AppleScript support.

## 3. What Peekaboo adds

Grounded in the upstream README and docs (github.com/openclaw/Peekaboo, docs/commands/README.md). 33 root commands; the relevant groups:

- Eyes: `see` (screenshot plus AX map with element IDs, `--json`, `--annotate`), `screen`, `window list`, `capture`.
- Hands: `click`, `type`, `press`, `scroll`, `drag`, `move`, `paste`, `set-value`, `action`.
- macOS control: `app`, `window`, `menu`, `menubar`, `dock`, `dialog`, `space`, `clipboard`.
- Vision and AI: visual question answering on captures through configured model providers, `verify`, `agent` (natural-language multi-step runs), `mcp` server.
- Background delivery: targeted input works without bringing the app frontmost when Peekaboo can resolve the process; foreground input is an explicit opt-in, which matches the bridge's fail-closed posture.
- Install: `brew install steipete/tap/peekaboo`. Requires macOS 15+. Needs Screen Recording and Accessibility grants, plus Event Synthesizing for synthetic input. `peekaboo permissions status` reports what is granted.

Peekaboo is MIT-licensed, actively maintained (v4.2.3, ~5k stars), and its core is Swift, so captures and AX reads are native and fast on Apple Silicon.

## 4. Why this fits the bridge

The bridge's design goal is that Instinct is the brain and the bridge is the senses. The senses are currently audio-only. Peekaboo slots in as the visual sense at exactly the layer the bridge already has: the headless harness. No new transport, no new WhatsApp flows, no changes to the voice pipeline. It also replaces the one-off AX and AppleScript tricks with a maintained tool that already handles element targeting, background input, and permission checks.

## 5. Proposed design

### Phase A: one new harness tool, `peekaboo`

Add a single tool to harness-bridge.ts:

```json
{"tool": "peekaboo", "args": {"cmd": "see --app WhatsApp --json"}}
```

The tool spawns `peekaboo <cmd>`, captures stdout/stderr, applies a timeout, and returns the result. A subcommand allowlist keeps the first version predictable. Suggested phase A allowlist:

- Observe: `see`, `screen`, `window list`, `permissions status`
- Act: `click`, `type`, `press`, `scroll`, `menu`, `menubar`, `dialog`, `app`
- Deny for now: `agent`, `mcp`, `daemon`, `bridge`, and anything `--foreground`.

Response shaping matters because of the 3500 char reply cap. For `see --json`, trim to a compact element list (id, role, title, frame) instead of raw JSON, and truncate with a clear marker so Instinct knows to narrow the query (for example `see --app <name>` instead of full screen).

### Seeing without image transport (phase A default)

Keep replies text-only at first. Use Peekaboo's vision question answering so the image never has to travel: the harness runs the capture and asks the question locally, and only the text answer crosses WhatsApp and gets spoken. This avoids building a new image send path before we know we need it.

### Phase B: screenshot send route (optional, later)

If Instinct needs the actual pixels, the bridge can attach the PNG through the existing Attach > Document picker route. That is new send-path work (attaching an arbitrary file produced by a tool call), so it is its own decision. Screenshots can contain private content, same as AX dumps, so this stays off until explicitly enabled.

### Phase C: multi-step `peekaboo agent` (optional, later)

`peekaboo agent "open Safari and search for X"` chains see/click/type on its own model provider. Powerful, but it runs its own loop and costs model calls. Enable only after Phase A is stable, with a step cap and logged dry runs. Note it duplicates planning Instinct already does, so the likely long-term shape is Instinct planning and issuing single Peekaboo commands, with `agent` reserved for cases where round-trip latency over WhatsApp is the problem.

### Envelope discipline (existing constraint, unchanged)

- One step per envelope, several small envelopes for multi-step work, per the standing rule.
- Keep commands short: prefer flags and app names over long selectors; no heredocs or multiline scripts inside an envelope.
- Illustrative call sequence (JSON shown pre-base64):

```json
{"tool": "peekaboo", "args": {"cmd": "permissions status"}}
{"tool": "peekaboo", "args": {"cmd": "see --app Safari --json"}}
{"tool": "peekaboo", "args": {"cmd": "click \"Address and search bar\" --app Safari"}}
{"tool": "peekaboo", "args": {"cmd": "type \"github.com/openclaw/Peekaboo\" --app Safari"}}
{"tool": "peekaboo", "args": {"cmd": "press Return --app Safari"}}
```

### Safety

- The existing guards do not change: exact-number header lock, fail-closed watcher, picker send route, dedup ledger. The `peekaboo` tool is only reachable through the same verified chat as every other harness tool.
- TCC grants: the grant goes to whatever process runs peekaboo (the harness's host). Expect one-time prompts; document them in docs/setup.md and check `peekaboo permissions status` in start.sh as a warn-not-fail preflight.
- No `--foreground` in phase A. Background delivery only.
- Captures may show private content. Do not log screenshots or `see` output in bridge.jsonl beyond metadata; do not forward images until Phase B is explicitly on.

## 6. Voice loop fit

The flow reuses everything already built: wake phrase, clip send, Instinct reasoning, harness execution, voice reply. Single Peekaboo commands fit the current sub-1.5s harness pattern; `see` adds a second or two for capture plus vision, which is fine for a spoken exchange. Example: "Jarvis, check if that download finished" -> `see --mode screen` + vision question -> "Yes, the download finished" as a voice note.

## 7. Work items

1. On the Mac: `brew install steipete/tap/peekaboo`; grant Screen Recording, Accessibility, and Event Synthesizing; confirm with `peekaboo permissions status`.
2. harness-bridge.ts: add the `peekaboo` tool (allowlist, JSON output, timeout, output trimming).
3. bridge/harness.py: typed wrapper plus tests following the existing test_harness.py pattern; dispatcher allowlist update if tool names are validated there.
4. start.sh: preflight check for peekaboo presence and permissions, warn not fail.
5. Docs: README tool list, docs/limitations.md (screen privacy), docs/JARVIS_INSTRUCTIONS.md (compact-call rules, one step per envelope, how to ask for screen checks).
6. Phase B (image send) and Phase C (`peekaboo agent`) as separate, explicit decisions.

## 8. Alternatives considered

- `peekaboo mcp`: exposes the same tools over MCP for coding agents. The bridge's harness is already the execution client, so wrapping the CLI directly is simpler and adds no server. Revisit if the harness ever speaks MCP natively.
- Pure AppleScript / osascript: the status quo. Blind, and scripting support varies wildly by app.
- Homegrown `screencapture` + pyobjc AX reads: a rebuild of what Peekaboo already solved, without its vision QA, element IDs, or background input synthesis.

## 9. Open questions for Hamdan

1. Which provider should Peekaboo's vision use? A hosted provider sends screenshots off-device; a local one keeps them on the M5 Air but is slower and uses memory. This is a privacy call, not a technical one.
2. Do you want Phase B (actual screenshots sent to the chat) at all?
3. Should `peekaboo agent` ever run unattended, or always as single commands Instinct issues?
4. Confirm the Mac is on macOS 15 or later (Peekaboo requires it; the M5 Air almost certainly is).

## Sources

- Peekaboo repo and README: https://github.com/openclaw/Peekaboo
- Peekaboo docs site: https://peekaboo.sh/
- Command index: https://github.com/openclaw/Peekaboo/tree/main/docs (docs/commands/README.md)
- OpenAgent (private): README.md, bridge/dispatcher.py, bridge/harness.py, docs/setup.md, docs/voice-routing-design.md
