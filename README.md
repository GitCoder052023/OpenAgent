# jarvis-bridge

An experimental, local push-to-talk Mac bridge to Instinct in WhatsApp Desktop. F8 records speech, whisper.cpp transcribes locally, and a guarded AppleScript sends only in the configured chat. **Not plug-and-play and not tested on Hamdan's Mac.** See [setup](docs/setup.md) and [limitations](docs/limitations.md) before sending anything.

The opt-in reply watcher now **plays incoming WhatsApp voice notes in the app**, through the Mac's selected speaker or Bluetooth output. It does **not** convert text replies to speech: links, codes and other text remain visible in WhatsApp, not read aloud. Consecutive new voice notes are queued and started one after the previous note's play/pause control indicates completion. If that state is not available or stable, the watcher stops instead of overlapping audio. It does not download note bytes or call TTS for replies. The watcher is disabled until the actual WhatsApp Accessibility labels/paths and incoming direction have been calibrated on this Mac. It watches for 90 seconds after an outgoing message and is not a background notification service.

**Locked WhatsApp destination:** `+16508702892` by default. It is not Instinct's iMessage number. Verify the unsaved-number chat header yourself and calibrate `BRIDGE_HEADER_PATH`; a contact display name alone is not enough.

## Requirements and install

macOS, WhatsApp Desktop, Python 3.11+, Homebrew, mic, Accessibility/Microphone/Input Monitoring permission; whisper.cpp and SoX. WhatsApp must be visible and the exact number shown in the selected chat. Bluetooth output is selected in macOS Control Center. Actual AX layout, voice controls, hotkeys and audio output require on-device tests.

```sh
xcode-select --install
brew install python sox whisper-cpp ffmpeg
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

## One-Command Quick Start

Spin up the entire system (dependencies check, OpenCode execution harness, WhatsApp Desktop backgrounding, and tool call interceptor) in one command:

```bash
./start.sh
```

To run with specific flags (e.g. Whisper text mode):
```bash
./start.sh --send-mode text
```

The manual `jarvis-bridge speak --text 'Speaker check'` still tests the Mac's `say` output, but automatic replies never invoke it. Text links/codes must be read on-screen. The model downloader and UI automation should be reviewed before use.

## Safety

This is a fail-closed prototype. The selected number is checked by a locally calibrated AX path; outgoing sending checks the header around paste/Enter. Incoming playback requires a calibrated message list, incoming direction marker, exact voice play and pause labels, and a stable append-only list; no general notifications, other chats, or text are spoken. GUI scripting cannot guarantee an atomic chat lock. If the path changes or playback state is unclear, it stops. Keep WhatsApp foreground and supervise. Native UI automation does not guarantee zero WhatsApp account risk. Clipboard and AX dumps can contain private data; do not dictate secrets or commit `ax-tree.json`. See [architecture](docs/architecture.md).

## Audio attachment send mode

F8 release now sends the recorded M4A as a WhatsApp **file attachment** instead of running Whisper transcription. This can avoid local transcription time, but is not a native WhatsApp voice-note bubble and does not guarantee the receiving service will process M4A attachments. Sending is disabled until `BRIDGE_ATTACH_LABEL`, `BRIDGE_DOCUMENT_LABEL`, and `BRIDGE_ATTACHMENT_SEND_LABEL` are locally calibrated. The file chooser and draft send need supervised testing on Hamdan's Mac. The incoming voice-note playback remains the opt-in watcher described above. See [setup](docs/setup.md).


## Phase 2: opt-in always-listening voice mode (experimental)

Install the extra dependencies with `pip install -e '.[voice]'`. Download and extract an offline English Vosk model from [Vosk's model list](https://alphacephei.com/vosk/models) to `models/vosk-model-small-en-us-0.15`, or set `BRIDGE_VOICE_MODEL` to the extracted model directory. Grant Terminal/Python microphone and Accessibility permissions; verify that SoX and ffmpeg work. Run `jarvis-bridge run --voice --send-mode audio` with the Mac's default microphone selected. Esc exits. The microphone stays open while the process runs. Idle audio stays in memory only and is not saved or sent. Say exactly "Wakeup Jarvis" as a separate utterance; speech after that is grouped into an M4A attachment after 4.5 seconds of quiet, with no duration cap in voice mode. Short 1-2 second natural pauses stay in the same clip. A sleep request flushes the current clip. Esc exits and drops any unfinished clip. Very long clips consume memory and disk, take longer to encode and upload, and can hit WhatsApp attachment limits; test with short clips first. Set `BRIDGE_VOICE_SILENCE_SECONDS=5` in `.env` to adjust the gap (2-30 seconds). This uses Vosk endpoints and microphone signal level; test with your mic, since background noise or a quiet voice can affect timing. To stop sending, say exactly "Jarvis stand by", then exactly "confirm stand by Jarvis" as a separate utterance within eight seconds. Any other utterance cancels the pending sleep request. Restarting the app starts asleep. Hotkey mode is unchanged.

**Important:** Vosk is used only to spot command phrases, not to transcribe outgoing speech; outgoing audio remains M4A. English recognition may mishear Hinglish. This is not speaker verification or call detection: a nearby person or call audio through the selected mic could wake it or supply both sleep phrases. Use headphones during calls and exit with Esc when privacy matters. Test wake, Hinglish, pauses, call audio, and the exact sleep confirmation on your Mac before trusting it. No software-only phrase regex can guarantee zero false triggers. There is no on-device validation from this repo; do not leave unattended. The existing WhatsApp AX calibration, destination checks, and attachment-send caveats still apply.

