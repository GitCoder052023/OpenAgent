# Architecture and next steps

`pynput` catches F8 down/up; SoX `rec` captures a local 16-kHz mono WAV only while pressed; `whisper-cli` transcribes the file; Python validates the transcript, a monotonic send interval and the WhatsApp AX header; AppleScript focuses the single composer and pastes; Python revalidates the header before AppleScript presses Return. Esc quits and stops recording. The WAV is removed after each attempt. On errors the bridge prints a refusal.

The WhatsApp number is configurable and defaults to Instinct's WhatsApp line. **There is no automation of other chats.** The outgoing pasted text and AX dump are private data. The user's text can be English or Hinglish; multilingual whisper models and auto language detection are available, but accuracy is not guaranteed. Replies can also be Hinglish or English; macOS `say` pronunciation quality varies.

The optional watcher polls the Accessibility snapshot once per second for at most 90 seconds after a send. It verifies the calibrated chat header, reads only groups with a calibrated incoming marker under a calibrated message-list path, and calls `say`. It halts on list changes it cannot understand. This is **not** a notification fallback: notifications alone cannot reliably tie a body to the active chat and incoming sender, so using them to speak would risk reading another contact.

## v1 completion criteria

- Verify and adjust AX chat header and composer selectors on the actual Mac/WhatsApp version.
- Calibrate and verify the reply adapter against actual incoming/outgoing WhatsApp AX fixtures. It currently depends on paths and markers and has no stable IDs. If AX does not expose chat scope and direction, keep manual playback or use a user-approved alternative channel/API.
- Test hotkey, mic, multilingual transcription, clipboard, rate limiting, speaker selection and safe failure on wrong chat. Review local WhatsApp policies and stop on warnings or throttling.

## v2 ideas, only after v1 is stable

- Optional openWakeWord "Jarvis" trigger, **off by default**, with a listening chime, local processing and explicit consent from anyone whose speech might be captured.
- Better British TTS voice with a local provider; clear indication when playback is speaking Hinglish rather than forcing English pronunciation.
- Optional `SwitchAudioSource` to select a specific paired Bluetooth output, falling back to system output.
- `launchd` service after proving startup has microphone/Accessibility permission and a visible stop control; no auto-send on boot.
