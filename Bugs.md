# Bugs

## Critical: Tool responses can be sent to the active WhatsApp chat instead of the Instinct bridge chat

### Context
OpenAgent runs on Hamdan's MacBook and reads inbound WhatsApp messages through WhatsApp Desktop. It executes `JARVIS_CALL` envelopes and posts tool output as `[Jarvis Tool Response: ...]`. The October 5, 2026 protocol update added `mac_*` tools that can inspect and operate WhatsApp Desktop.

### Observed behaviour
On October 5, 2026, at about 11:22 AM IST, a `mac_ax` action opened the "Mantasha Bhabhi" chat, followed by a `mac_ax` query. The resulting `[Jarvis Tool Response: ...]` was posted in that personal chat rather than in the Instinct bridge chat. Hamdan had to delete the message for everyone. No private chat content is included here.

### Evidence and related observations
- The failure occurred after the protocol update made WhatsApp Desktop operable through `mac_*` tools. Before the update, the harness blocked attempts to target WhatsApp with the message: `WhatsApp Desktop is reserved for bridge communication`.
- A `mac_ax` query using app name `WhatsApp` was ambiguous among several WhatsApp-related processes (including ServiceExtension, the main WhatsApp process, AutoFill, and ThemeWidgetControlViewService). The main app PID was needed to target the intended process.
- Screen Recording permission resets whenever the bridge or terminal restarts, requiring permission to be granted again.
- When Chrome remote debugging is disabled, `browser_*` tools fail with `DevToolsActivePort not found`.

### Expected behaviour
Tool responses must always be delivered to the verified Instinct bridge chat, regardless of which WhatsApp chat is currently active or open. The bridge must never send tool responses to any other chat. WhatsApp UI operations must not change the destination used by the bridge for its own responses.
