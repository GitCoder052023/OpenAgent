from dataclasses import dataclass
from pathlib import Path
import os


def load_env_file(path=None):
    env_file = Path(path) if path else Path(__file__).resolve().parents[1] / ".env"
    if env_file.is_file():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("\"'")
                    if key and key not in os.environ:
                        os.environ[key] = val


@dataclass(frozen=True)
class Config:
    number: str = "+16508702892"
    model: str = "models/ggml-base.bin"
    whisper_cli: str = "whisper-cli"
    recorder: str = "rec"
    min_send_interval: float = 2.0
    max_record_seconds: int = 1000
    reply_timeout: int = 90
    language: str = "auto"
    header_path: str = ""
    message_list_path: str = ""
    incoming_marker: str = ""
    voice_play_marker: str = ""
    voice_pause_marker: str = ""
    max_voice_seconds: int = 1000
    attach_label: str = ""
    document_label: str = ""
    attachment_send_label: str = ""
    safe_mode: bool = True
    send_mode: str = "audio"
    send_route: str = "picker"
    hotkey: str = "f8"
    voice_model: str = "models/vosk-model-small-en-us-0.15"
    voice_silence_seconds: float = 2.0
    ledger_path: str = ""

    @classmethod
    def from_env(cls):
        load_env_file()
        hotkey = os.getenv("BRIDGE_HOTKEY", "f8").strip().lower()
        safe_mode_env = os.getenv("BRIDGE_SAFE_MODE", "").strip().lower()
        if safe_mode_env in ("false", "0", "no", "off"):
            safe_mode = False
        elif os.getenv("BRIDGE_UNLOCKED", "").strip().lower() in ("true", "1", "yes", "on"):
            safe_mode = False
        else:
            safe_mode = True

        send_mode = os.getenv("BRIDGE_SEND_MODE", "audio").strip().lower()
        if send_mode not in ("text", "audio"):
            send_mode = "audio"

        send_route = os.getenv("BRIDGE_SEND_ROUTE", "picker").strip().lower()
        if send_route not in ("auto", "clipboard", "picker"):
            send_route = "picker"

        ledger_path = os.getenv("BRIDGE_LEDGER_FILE", "").strip()

        return cls(number=os.getenv("BRIDGE_WHATSAPP_NUMBER", cls.number),
                   model=os.getenv("BRIDGE_WHISPER_MODEL", cls.model),
                   whisper_cli=os.getenv("BRIDGE_WHISPER_CLI", cls.whisper_cli),
                   recorder=os.getenv("BRIDGE_RECORDER", cls.recorder),
                   language=os.getenv("BRIDGE_LANGUAGE", cls.language),
                   header_path=os.getenv("BRIDGE_HEADER_PATH", ""),
                   message_list_path=os.getenv("BRIDGE_MESSAGE_LIST_PATH", ""),
                   incoming_marker=os.getenv("BRIDGE_INCOMING_MARKER", ""),
                   voice_play_marker=os.getenv("BRIDGE_VOICE_PLAY_MARKER", ""),
                   voice_pause_marker=os.getenv("BRIDGE_VOICE_PAUSE_MARKER", ""),
                   attach_label=os.getenv("BRIDGE_ATTACH_LABEL", ""),
                   document_label=os.getenv("BRIDGE_DOCUMENT_LABEL", ""),
                   attachment_send_label=os.getenv("BRIDGE_ATTACHMENT_SEND_LABEL", ""),
                   safe_mode=safe_mode,
                   send_mode=send_mode,
                   send_route=send_route,
                   hotkey=hotkey,
                   voice_model=os.getenv("BRIDGE_VOICE_MODEL", cls.voice_model),
                   voice_silence_seconds=float(os.getenv("BRIDGE_VOICE_SILENCE_SECONDS", cls.voice_silence_seconds)),
                   ledger_path=ledger_path)

