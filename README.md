# jarvis-bridge

An experimental, local push-to-talk Mac bridge to Instinct in WhatsApp Desktop. F8 records speech, whisper.cpp transcribes locally, and a guarded AppleScript sends only in the configured chat. **Not plug-and-play and not tested on Hamdan's Mac.** See [setup](docs/setup.md) and [limitations](docs/limitations.md) before sending anything.

The opt-in reply watcher now **plays incoming WhatsApp voice notes in the app**, through the Mac's selected speaker or Bluetooth output. It does **not** convert text replies to speech: links, codes and other text remain visible in WhatsApp, not read aloud. Consecutive new voice notes are queued and started one after the previous note's play/pause control indicates completion. If that state is not available or stable, the watcher stops instead of overlapping audio. It does not download note bytes or call TTS for replies. The watcher is disabled until the actual WhatsApp Accessibility labels/paths and incoming direction have been calibrated on this Mac. It watches for 90 seconds after an outgoing message and is not a background notification service.

**Locked WhatsApp destination:** `+16508702892` by default. It is not Instinct's iMessage number. Verify the unsaved-number chat header yourself and calibrate `BRIDGE_HEADER_PATH`; a contact display name alone is not enough.

## Requirements and install

macOS, WhatsApp Desktop, Python 3.11+, Homebrew, mic, Accessibility/Microphone/Input Monitoring permission; whisper.cpp and SoX. WhatsApp must be visible and the exact number shown in the selected chat. Bluetooth output is selected in macOS Control Center. Actual AX layout, voice controls, hotkeys and audio output require on-device tests.

```sh
xcode-select --install
brew install python sox whisper-cpp
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
bash scripts/download-model.sh base  # multilingual, unlike base.en
cp .env.example .env
# Calibrate .env using docs/setup.md; never commit the AX dump.
set -a; source .env; set +a
jarvis-bridge inspect > ax-tree.json
jarvis-bridge run  # hold F8 to speak, release to send; Esc quits
pytest -q
```

The manual `jarvis-bridge speak --text 'Speaker check'` still tests the Mac's `say` output, but automatic replies never invoke it. Text links/codes must be read on-screen. The model downloader and UI automation should be reviewed before use.

## Safety

This is a fail-closed prototype. The selected number is checked by a locally calibrated AX path; outgoing sending checks the header around paste/Enter. Incoming playback requires a calibrated message list, incoming direction marker, exact voice play and pause labels, and a stable append-only list; no general notifications, other chats, or text are spoken. GUI scripting cannot guarantee an atomic chat lock. If the path changes or playback state is unclear, it stops. Keep WhatsApp foreground and supervise. Native UI automation does not guarantee zero WhatsApp account risk. Clipboard and AX dumps can contain private data; do not dictate secrets or commit `ax-tree.json`. See [architecture](docs/architecture.md).
