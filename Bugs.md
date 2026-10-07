# Bugs

## Critical: Tool responses can be sent to the active WhatsApp chat instead of the Instinct bridge chat

### Context
OpenAgent runs on the user's host Mac and reads inbound WhatsApp messages through WhatsApp Desktop. It executes `JARVIS_CALL` envelopes and posts tool output as `[Jarvis Tool Response: ...]`. The October 5, 2026 protocol update added `mac_*` tools that can inspect and operate WhatsApp Desktop.

### Observed behaviour
On October 5, 2026, at about 11:22 AM IST, a `mac_ax` action opened an unrelated personal contact chat, followed by a `mac_ax` query. The resulting `[Jarvis Tool Response: ...]` was posted in that personal chat rather than in the Instinct bridge chat. The user had to delete the message for everyone. No private chat content is included here.

### Evidence and related observations
- The failure occurred after the protocol update made WhatsApp Desktop operable through `mac_*` tools. Before the update, the harness blocked attempts to target WhatsApp with the message: `WhatsApp Desktop is reserved for bridge communication`.
- A `mac_ax` query using app name `WhatsApp` was ambiguous among several WhatsApp-related processes (including ServiceExtension, the main WhatsApp process, AutoFill, and ThemeWidgetControlViewService). The main app PID was needed to target the intended process.
- Screen Recording permission resets whenever the bridge or terminal restarts, requiring permission to be granted again.
- When Chrome remote debugging is disabled, `browser_*` tools fail with `DevToolsActivePort not found`.

### Expected behaviour
Tool responses must always be delivered to the verified Instinct bridge chat, regardless of which WhatsApp chat is currently active or open. The bridge must never send tool responses to any other chat. WhatsApp UI operations must not change the destination used by the bridge for its own responses.

### Status & Resolution
**Status**: Resolved

#### Root Causes
1. **Relaxed Chat Verification**: In `src/OpenAgent/ax.py`, `verify_header()` had a fallback in unlocked mode (`safe_mode=False`) that printed a warning and returned `True` for any open chat, treating personal chats as verified.
2. **Missing Chat Auto-Switch & Non-Raising Assertions**: `Desktop.assert_locked()` in `src/OpenAgent/desktop.py` caught verification errors in unlocked mode and returned `False` instead of raising, while callers did not check the boolean return value. Additionally, `Desktop.send_tool_response()` only performed a quick check that passed due to #1.
3. **Application Disambiguation**: `MacOS._resolve_app()` in `src/tools/macos-harness/src/macos_harness/macos.py` failed when targeting `WhatsApp` because macOS returned multiple processes (`ServiceExtension`, `AutoFill`, `ThemeWidgetControlViewService`, and `\u200eWhatsApp`). The leading Unicode LRM mark (`\u200e`) prevented exact matching and caused an ambiguity exception.

#### Fixes Implemented
1. **Strict Chat Verification (`src/OpenAgent/ax.py`)**:
   - `verify_header()` now strictly validates that the active chat header matches either the target phone number or the verified "Instinct" contact name.
   - Any unrelated chat strictly returns `False` in unlocked mode and raises `RuntimeError` in safe mode.
2. **Automated Bridge Chat Restoration (`src/OpenAgent/ax.py`)**:
   - `ensure_whatsapp_ready()` uses direct `whatsapp://send?phone={target}` URL scheme navigation with AX chat list fallback to restore the Instinct bridge chat immediately if another chat was opened.
3. **Fail-Closed Sending (`src/OpenAgent/desktop.py`)**:
   - Implemented `Desktop.is_locked()` to detect whether WhatsApp is currently on the bridge chat.
   - `Desktop.assert_locked()` now strictly raises `RuntimeError` if the active chat does not match the bridge, regardless of safe mode setting.
   - `Desktop.send_tool_response()`, `Desktop.send()`, and `Desktop.send_file()` automatically switch WhatsApp back to the bridge chat if `not self.is_locked()`, and execute strict `assert_locked()` checks before pasting and committing. If the bridge chat cannot be confirmed, they fail closed and refuse to send.
4. **Inbound Message Isolation (`src/OpenAgent/replies.py`)**:
   - `watch()` verifies `verify_header()` and raises `RuntimeError` on mismatch, ensuring messages are never read or processed from unverified chats.
5. **Process Disambiguation (`src/tools/macos-harness/src/macos_harness/macos.py`)**:
   - Sanitized application names to strip invisible characters (`\u200e`) and added helper extension filtering (`.appex`, `serviceextension`, `autofill`), ensuring the main WhatsApp application process is reliably resolved.
6. **Automated Test Coverage (`tests/test_safety.py`)**:
   - Added unit and regression tests verifying rejection of unrelated chats, fail-closed send behaviors, automatic bridge chat switching, inbound message isolation, and process disambiguation. All 204 tests pass cleanly.

