from dataclasses import dataclass
import os

@dataclass(frozen=True)
class Config:
    number: str = "+16508702892"
    model: str = "models/ggml-base.bin"
    whisper_cli: str = "whisper-cli"
    recorder: str = "rec"
    min_send_interval: float = 8.0
    max_record_seconds: int = 30
    reply_timeout: int = 90
    language: str = "auto"
    header_path: str = ""
    message_list_path: str = ""
    incoming_marker: str = ""

    @classmethod
    def from_env(cls):
        return cls(number=os.getenv("BRIDGE_WHATSAPP_NUMBER", cls.number),
                   model=os.getenv("BRIDGE_WHISPER_MODEL", cls.model),
                   whisper_cli=os.getenv("BRIDGE_WHISPER_CLI", cls.whisper_cli),
                   recorder=os.getenv("BRIDGE_RECORDER", cls.recorder),
                   language=os.getenv("BRIDGE_LANGUAGE", cls.language),
                   header_path=os.getenv("BRIDGE_HEADER_PATH", ""),
                   message_list_path=os.getenv("BRIDGE_MESSAGE_LIST_PATH", ""),
                   incoming_marker=os.getenv("BRIDGE_INCOMING_MARKER", ""))
