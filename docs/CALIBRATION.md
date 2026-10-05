# OpenAgent Calibration & Verification Guide

This guide covers advanced calibration and verification for OpenAgent's macOS Accessibility (AX) integration, audio routing, and WhatsApp Desktop environment.

---

## 1. Chat Verification & Lock Assertions

OpenAgent enforces strict chat verification by default (`BRIDGE_SAFE_MODE=true`).

1. Open the official WhatsApp Desktop application.
2. Select your Instinct assistant chat.
3. Verify that the configured phone number matches the selected chat header (`BRIDGE_WHATSAPP_NUMBER`, default `+16508702892`).
4. **Safety Rule**: If the chat header cannot be verified or only displays an unverified contact name, do not disable safe mode. Keep WhatsApp visible and foregrounded during initial setup.

---

## 2. macOS Permissions & Audio Routing

Ensure the following permissions are granted under **System Settings → Privacy & Security**:
- **Accessibility**: WhatsApp UI inspection and native UI interaction.
- **Input Monitoring**: Global push-to-talk hotkey capture (`F8`).
- **Microphone**: Audio recording via SoX.
- **Screen Recording**: Required for `mac_see` window capture.
- **Automation**: System Events and AppleScript app control.

> **Tip**: If permissions appear to be ignored after an OS update, toggle them off and on, then restart your terminal.

For voice playback, verify that your desired audio output device (speakers or Bluetooth headphones) is set as the active macOS system output.

---

## 3. Automated One-Command Calibration (`calibrate.py`)

OpenAgent provides an automated one-command calibration engine:

```bash
# 1. Verify and inspect calibration against live WhatsApp Desktop
./calibrate.py

# 2. Automatically apply detected calibration paths & markers to .env (with backup)
./calibrate.py --save

# 3. Dump the active WhatsApp AX tree for manual inspection
./calibrate.py --dump ax-tree.json
```

The script automatically detects:
* **Chat Header Path** (`BRIDGE_HEADER_PATH`)
* **Message List Container** (`BRIDGE_MESSAGE_LIST_PATH`)
* **Incoming Direction & Voice Markers** (`BRIDGE_INCOMING_MARKER`, `BRIDGE_VOICE_PLAY_MARKER`, `BRIDGE_VOICE_PAUSE_MARKER`)
* **Attachment & Send Button Labels** (`BRIDGE_ATTACH_LABEL`, `BRIDGE_DOCUMENT_LABEL`, `BRIDGE_ATTACHMENT_SEND_LABEL`)

> [!CAUTION]
> `ax-tree.json` contains raw UI hierarchy data which may include private message snippets. Treat it as sensitive local data, do not commit it to Git, and delete it after calibration.

---

## 4. Voice-Note Watcher Calibration

If using the automatic incoming voice-note watcher, identify the following AX elements from your snapshot:
- Message list container (`AXList`, `AXScrollArea`, or `AXGroup`)
- Incoming message marker
- Voice-note Play button label
- Voice-note Pause button label

Configure in `.env`:
```env
BRIDGE_MESSAGE_LIST_PATH=<AX message list path>
BRIDGE_INCOMING_MARKER=<incoming marker>
BRIDGE_VOICE_PLAY_MARKER=<play label>
BRIDGE_VOICE_PAUSE_MARKER=<pause label>
```

> **Note**: If WhatsApp does not expose reliable markers on your build, leave these empty and use manual audio playback.

---

## 5. Audio Send Route Calibration

OpenAgent can send recorded audio through three routes configured by `BRIDGE_SEND_ROUTE`:

| Route | Value | Behavior |
| :--- | :--- | :--- |
| **Picker (Default)** | `picker` | Uses native WhatsApp attachment dialog via UI automation. |
| **Clipboard** | `clipboard` | Stages `.m4a` to macOS pasteboard and triggers `Cmd+V`. |
| **Automatic** | `auto` | Tries clipboard first; falls back to picker if paste state is ambiguous or rejected. |

For the picker route, calibrate labels if your WhatsApp UI is in a non-English locale:
```env
BRIDGE_ATTACH_LABEL="Attach"
BRIDGE_DOCUMENT_LABEL="Document"
BRIDGE_ATTACHMENT_SEND_LABEL="Send"
```

### Clipboard Paste States (Auto Mode)
- `preview`: File successfully attached and preview modal opened.
- `polluted`: Raw file path pasted into text composer. OpenAgent automatically clears the draft and switches to picker.
- `empty`: Paste was ignored. OpenAgent retries once before falling back.
- `ambiguous`: State could not be confirmed. OpenAgent halts safely to prevent duplicate sends.

---

## 6. Voice Models & Transcription

### Whisper (Speech-to-Text)
Download models using the helper script:
```bash
bash scripts/download-model.sh base       # Multilingual (recommended)
bash scripts/download-model.sh base.en    # English-only optimized
```

Configure in `.env`:
```env
BRIDGE_WHISPER_MODEL=models/ggml-base.bin
BRIDGE_LANGUAGE=auto
```

### Vosk (Offline Wake-Word Detection)
Download and extract the lightweight Vosk model:
```bash
mkdir -p models
curl -L https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip -o models/vosk.zip
unzip models/vosk.zip -d models/
rm models/vosk.zip
```

Configure in `.env`:
```env
BRIDGE_VOICE_MODEL=models/vosk-model-small-en-us-0.15
```

---

## 7. Diagnostics & Logging

Follow the live bridge log:
```bash
tail -f ~/Library/Logs/OpenAgent/bridge.jsonl
```

Key diagnostic events to look for:
- `audio_gate` (`accepted: true/false`): Audio energy RMS check.
- `watcher_config`: Active AX watcher configuration.
- `text_baseline`: Historical messages indexed on startup (prevents replaying old messages).
- `tool_dispatch`: Successful interception and routing of a `JARVIS_CALL`.
- `tool_result`: Local execution result formatted for reply.

To run with verbose output or preflight diagnostics:
```bash
./boot.py --verbose     # Live diagnostic logging in terminal
./boot.py --doctor      # Instant preflight subsystem health audit
```
