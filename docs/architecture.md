# Architecture and next steps

`pynput` catches F8; SoX records while held; local whisper.cpp transcribes; Python checks the transcript, rate limit and calibrated selected-chat number; AppleScript pastes and sends in the visible WhatsApp Desktop chat, with another number check before Enter. Esc quits. No other chats are automated. This requires on-device calibration and supervision.

After a send, an opt-in 90-second watcher polls the WhatsApp AX tree once per second. It checks the selected number, incoming message-group marker and append-only message-list path. It skips text replies, including links/codes. For each new incoming group with exactly one voice-note play button, it queues its path in AX order, verifies the chat again, uses AXPress to play through WhatsApp's native audio output, and waits for the button to switch from pause back to play before starting the next. If this transition, order, or scope cannot be proved, it stops. No TTS is used for replies; the `speak` subcommand remains only as a manual audio test. There is no notification-based fallback because notifications do not prove the selected chat and sender.

## Before relying on v1

- Confirm the exact-number chat-header and composer selectors on Hamdan's Mac and show the lock fails on another chat.
- Calibrate incoming direction and voice-note play/pause AX controls with inbound/outbound fixtures. Test sequential notes, text silence, Bluetooth output, app version changes and stop behavior on virtualization/changed chats. Without stable AX signals, keep the watcher disabled and play manually.
- Check macOS permissions, hotkey, mic, multilingual transcription, clipboard and rate limiting. Never claim an end-to-end loop until exercised on the real Mac.

## Future ideas, not implemented

A stable message-ID adapter and a safe queue that survives list virtualization; optional background notifications only with provable chat association; optional wake word after explicit consent; explicit Bluetooth output selection. Do not enable unattended sends on boot.
