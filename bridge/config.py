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
    voice_play_marker: str = ""
    voice_pause_marker: str = ""
    max_voice_seconds: int = 300
    attach_label: str = ""
    document_label: str = ""
    attachment_send_label: str = ""

    @classmethod
    def from_env(cls):
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
                   attachment_send_label=os.getenv("BRIDGE_ATTACHMENT_SEND_LABEL", ""))
