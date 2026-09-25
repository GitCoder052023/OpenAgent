# jarvis-bridge

A local, push-to-talk Mac bridge to Instinct in **WhatsApp Desktop**. This is an early, fail-closed MVP, **not** a finished hands-free assistant. It records only while F8 is held, transcribes with whisper.cpp locally, and pastes the text to the currently open WhatsApp chat only when its Accessibility snapshot passes a conservative number check. This check has not been validated as a true chat-header lock on your WhatsApp version. Esc stops it. Automatic reply reading and `say` playback are implemented as an opt-in, locally calibrated Accessibility watcher (see [limitations](docs/limitations.md)). They are not enabled until incoming-message direction and chat scope can be checked on your Mac. Do not leave it running unattended.

**Default WhatsApp chat:** `+16508702892`. This is not Instinct's separate iMessage number. Confirm the chat yourself before any test send. Set `BRIDGE_WHATSAPP_NUMBER` if your actual WhatsApp chat differs.

## Requirements

- macOS, WhatsApp Desktop, Python 3.11+, Homebrew, a microphone, and macOS Accessibility/Microphone permission.
- Intel and Apple Silicon should work in principle; this has **not** been tested on your MacBook Air M5 or your WhatsApp version.
- WhatsApp must be open in the foreground. Use an **unsaved-number chat** so its header visibly shows the exact phone number; if the app only shows a contact name, the bridge must stop rather than guess.

## Install

```sh
xcode-select --install
brew install python sox whisper-cpp
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
mkdir -p models
# Download a multilingual whisper.cpp GGML model from the official project.
# Example after checking current official model links in docs/setup.md:
# bash scripts/download-model.sh base
cp .env.example .env
```

Read [setup](docs/setup.md) before running. The default `base` model is multilingual for English/Hinglish/Hindi. The `base.en` model is English-only; avoid it for Hinglish. Don't download model binaries into Git.

```sh
set -a; source .env; set +a
jarvis-bridge inspect > ax-tree.json  # sensitive chat metadata: keep local, never commit
jarvis-bridge run                   # hold F8 to speak; Esc stops
jarvis-bridge speak --text 'Test playback' # manual audio test
pytest -q
```

**Do not test with a real send until `inspect` shows the right chat header, you can identify exactly one composer, and you have set `BRIDGE_HEADER_PATH` to the selected chat's actual phone-number label.** Start with a harmless test sentence. Watch the desktop screen throughout.

## Safety

- No always-on mic, remote speech service, unofficial WhatsApp protocol, mass messaging, or auto-navigation between chats.
- One intended chat number; refuses to send if the number check is absent/ambiguous. The number check still needs on-device validation to prove it refers to the current chat header rather than another part of the window. Single-line messages under 1000 characters, at least 8 seconds apart. F8 is push-to-talk, Esc is kill switch.
- Native UI automation is still unofficial automation: using the official client **does not guarantee compliance with WhatsApp policies or eliminate account risk**. Keep manual supervision, avoid high volumes, and stop if challenged or throttled.
- The clipboard receives the transcript; other local applications may see it, and a crash may leave it there. Do not dictate secrets.
- `ax-tree.json` may contain private chat content: do not share or commit it.

## What works / what doesn't

The sender and an opt-in Accessibility reply watcher with TTS are implemented, but **unverified on the user's Mac**. If WhatsApp does not expose a stable chat header, composer, and incoming-message direction, the safe outcome is an error. See [limitations](docs/limitations.md) and [architecture](docs/architecture.md). This repo does not promise a working end-to-end loop without calibration.
