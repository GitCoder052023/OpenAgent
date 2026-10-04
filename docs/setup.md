# Setup and first test

1. Install WhatsApp Desktop from its official source, open the unsaved-number Instinct chat, and verify **+16508702892** in the selected chat header. The iMessage line differs. Keep WhatsApp visible and foreground. If only a saved contact name appears, stop rather than weakening the lock.
2. Install command-line tools, Python, SoX and whisper.cpp per README. Check `which whisper-cli rec` and `whisper-cli --help`. Review `scripts/download-model.sh`; its upstream model documentation is https://github.com/ggml-org/whisper.cpp/tree/master/models . `bash scripts/download-model.sh base` fetches the multilingual model; `base.en` is English-only. Set `BRIDGE_WHISPER_MODEL=models/ggml-base.bin` and `BRIDGE_LANGUAGE=auto` for Hinglish; check transcription with your accent.
3. Grant Terminal/Python Microphone, Accessibility, Input Monitoring (F8), and Automation access for WhatsApp/System Events as prompted in macOS System Settings > Privacy & Security. Restart the app if permission does not stick. Select the desired Bluetooth speaker/headphones as **macOS system output** in Control Center, and test ordinary WhatsApp voice playback manually first.
4. `OpenAgent inspect > ax-tree.json` contains private chat content: keep it local, never commit or share it, and delete after calibration. Find the selected chat header's exact-number `AXStaticText`/`AXButton` and set `BRIDGE_HEADER_PATH` to its `path`. Confirm that opening another chat fails the number check. Inspect the composer before testing a harmless send. Run `OpenAgent run`, hold F8, release, observe the selected chat, then Esc to stop. A media-key F8 may require Fn+F8 or a local key change. Never relax the number check to make a test pass.

## Opt-in voice-note watcher

5. In that exact chat, arrange harmless incoming voice and text test messages plus an outgoing voice message. Inspect the AX tree. Identify a message list container (`AXList`, `AXScrollArea`, `AXGroup`) and set `BRIDGE_MESSAGE_LIST_PATH`; find an **incoming direction marker in non-body AX title/description** that is absent on outbound bubbles, and set `BRIDGE_INCOMING_MARKER`. Find exact play and pause labels for an incoming voice-note `AXButton` and set `BRIDGE_VOICE_PLAY_MARKER` and `BRIDGE_VOICE_PAUSE_MARKER`. These must be distinct, and must identify one control per voice group. If your WhatsApp build lacks reliable direction or play/pause labels, leave them empty and use manual playback.
6. After a harmless test send, the watcher baselines visible voice notes, then polls once per second for up to 90 seconds. It skips text (including links/codes) and outgoing media. It queues new inbound voice notes in AX order, presses the first one's native WhatsApp play button, waits until its pause button returns to play, then starts the next. It verifies the number again before pressing. Audio goes through WhatsApp to macOS system output; the bridge does not download media or TTS the text. Test two consecutive voice notes to check ordering and completion, with the screen visible. If another note is already playing, state changes are ambiguous, or the list virtualizes/reorders, it stops rather than guessing.
7. `OpenAgent speak --text 'Speaker check'` only tests the old manual TTS command, **not** incoming playback. Do not leave the watcher unattended. On-device AX labels and playback transitions are not verified by repository tests.

See [limitations](limitations.md) before relying on it.

## Audio-file input mode

The bridge still records locally and encodes M4A. It puts the file on the macOS clipboard (both the file-URL and the legacy filenames flavor), focuses the composer in the verified Instinct chat, pastes with Cmd+V, waits up to 8 seconds for a WhatsApp attachment preview that names that file, and sends from that preview. This is a **file attachment**, not a native WhatsApp voice note. With the default `BRIDGE_SEND_ROUTE=picker`, the bridge skips this clipboard flow and sends straight through the Attach > Document picker; the flow above applies to `BRIDGE_SEND_ROUTE=auto` and `clipboard`.

After each paste attempt the bridge classifies what WhatsApp actually did, because a wrong guess here sends duplicates:

- **preview**: a caption field or Cancel button plus the exact filename: the file attached, so it sends from the preview.
- **polluted**: the paste landed in the composer as plain text: the bridge selects all, deletes the draft, verifies it is gone, then uses the Attach > Document picker.
- **empty**: WhatsApp ignored the paste: it retries once via the Edit > Paste menu, then uses the picker.
- **ambiguous**: some paste evidence exists but no preview could be confirmed: it stops with an unknown-outcome error rather than risk a duplicate; inspect and clear the draft manually before retrying.

Once clipboard paste proves unsupported in a run, later sends in that run go straight to the picker. The picker is the default send route; set `BRIDGE_SEND_ROUTE=auto` in `.env` to try clipboard paste first with the picker as fallback, or `BRIDGE_SEND_ROUTE=clipboard` to forbid the picker fallback. Calibrate `BRIDGE_ATTACH_LABEL`, `BRIDGE_DOCUMENT_LABEL`, and `BRIDGE_ATTACHMENT_SEND_LABEL` for the picker route in the verified +16508702892 chat. Diagnose with the `clipboard_stage`, `paste_attempt`, `paste_poll`, `paste_outcome`, `composer_cleared`, `preview_send`, `audio_send_route`, and `picker_step` events (with `--verbose`, or in the JSONL log). WhatsApp's live recorder is not used. Do not leave this untested UI automation unattended.


## Phase 2 voice-mode trial

Install `pip install -e '.[voice]'` and put an extracted Vosk model at the `BRIDGE_VOICE_MODEL` path (see README). Run `OpenAgent run --voice --send-mode audio` with a headset and the right default input device. First test without other people or a call: say "Wakeup Jarvis" alone, pause, dictate a harmless short message, pause, then say "Jarvis stand by", pause, and "confirm stand by Jarvis" within 8 seconds. Check the WhatsApp destination and playback. Then test unrelated speech about sleep cycles: it should not change state. Esc closes the listener. Vosk English recognition of Hinglish is unverified, and phone/call leakage cannot be completely prevented by speech recognition. Keep mode off if either test fails.

If you see `Voice scan unavailable`, the reply watcher cannot find `BRIDGE_MESSAGE_LIST_PATH` in the current WhatsApp AX snapshot. During an attachment picker or preview this is expected and scanning resumes after it closes. If it persists when the right chat is visible, run `OpenAgent inspect > ax-tree.json`, inspect locally for a single `AXList`/`AXScrollArea`/`AXGroup` containing message bubbles, then update `.env` with its exact path. Do not send or commit the AX dump; it can contain private chat text. The watcher stays fail-closed until calibrated.



## Retest diagnostics (2026-09-27)

Update the checkout (`git pull`), restart the bridge, and run your normal command with `--verbose` for live JSON event lines. A rotating JSONL file is always written to `~/Library/Logs/OpenAgent/bridge.jsonl` (override with `BRIDGE_LOG_FILE=/your/private/path`). Inspect with `tail -f ~/Library/Logs/OpenAgent/bridge.jsonl`. Logs include send source, gate duration/active time/peak/decision, echo guard transitions, watcher calibration and scanning, parsed tool names, harness errors, and send outcome. **Do not share raw logs without review:** paths, errors and tool results may reveal private data. Audio, chat bodies and scripts are not deliberately logged.

First run with a short deliberate spoken test and then a silent test. `audio_gate` should say `accepted:true` for speech and `accepted:false` for silence, for both F8 and `--voice`. The gate is intentionally conservative and can drop soft speech; tune only after looking at the logged peak, active ratio, and duration. The echo guard only knows about voice notes played by this bridge, not manually played audio or other apps.

For tool interception, check `watcher_config`, `text_baseline`, `text_scan_result`, and `tool_dispatch`. The bridge needs a **single calibrated message list and incoming direction**; if `watcher_disabled` or `text_scan_unavailable` appears, recalibrate locally using `OpenAgent inspect` and the exact incoming bubble's AX metadata. The first watcher pass baselines existing messages rather than executing history, so send a **new harmless** tool-call envelope only after restart. Check that `tool_dispatch` lists the expected names and `tool_response_sent` follows. The existing test call from 8:41 will not replay on restart. If harness startup says DISABLED, check Bun and the local `harness/harness-bridge.ts` installation. Do not run arbitrary external tool-call envelopes: only the verified Instinct chat should supply them.


