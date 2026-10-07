"""Immersive, tactile terminal sound engine for OpenAgent.

Provides audio feedback for events across the system:
- Tool call interception, execution, success, and errors
- WhatsApp response sending and file/screenshot attachments
- Inbound voice note arrival and playback transitions
- Incoming chat message detection
- User push-to-talk speech recording start/stop
- Continuous voice mode wake/sleep transitions
- Real-time diagnostic logging and system boot chimes
"""

import os
import shutil
import subprocess
import threading
import time
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Union


class SoundEvent(str, Enum):
    """Categorized acoustic feedback events for OpenAgent."""
    TOOL_INTERCEPT = "tool_intercept"
    TOOL_START = "tool_start"
    TOOL_SUCCESS = "tool_success"
    TOOL_ERROR = "tool_error"
    RESPONSE_SENT = "response_sent"
    ATTACHMENT_SENT = "attachment_sent"
    VOICE_NOTE_DETECTED = "voice_note_detected"
    VOICE_PLAYBACK_START = "voice_playback_start"
    VOICE_PLAYBACK_FINISHED = "voice_playback_finished"
    CHAT_MESSAGE_DETECTED = "chat_message_detected"
    MESSAGE_SENT = "message_sent"
    RECORDING_START = "recording_start"
    RECORDING_STOP = "recording_stop"
    VOICE_WAKE = "voice_wake"
    VOICE_SLEEP = "voice_sleep"
    MIC_MUTE = "mic_mute"
    MIC_UNMUTE = "mic_unmute"
    LOG_EVENT = "log_event"
    BOOT = "boot"


# Primary sound paths with graceful fallback chains (macOS native high-fidelity audio assets)
_SOUND_MAP: Dict[SoundEvent, List[str]] = {
    SoundEvent.TOOL_INTERCEPT: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/siri/jbl_begin.caf",
        "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/AlertTones/Modern/Chord.m4r",
        "/System/Library/Sounds/Submarine.aiff",
        "/System/Library/Sounds/Ping.aiff",
    ],
    SoundEvent.TOOL_START: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/ink/InkSoundStroke1.aif",
        "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/AlertTones/Modern/Popcorn.m4r",
        "/System/Library/Sounds/Tink.aiff",
    ],
    SoundEvent.TOOL_SUCCESS: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/payment_success.aif",
        "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/AlertTones/Modern/Complete.m4r",
        "/System/Library/Sounds/Hero.aiff",
    ],
    SoundEvent.TOOL_ERROR: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/payment_failure.aif",
        "/System/Library/Sounds/Basso.aiff",
        "/System/Library/Sounds/Sosumi.aiff",
    ],
    SoundEvent.RESPONSE_SENT: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/SentMessage.caf",
        "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/AlertTones/Classic/Swoosh.m4r",
        "/System/Library/Sounds/Glass.aiff",
    ],
    SoundEvent.ATTACHMENT_SENT: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/Screen Capture.aif",
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/SentMessage.caf",
        "/System/Library/Sounds/Glass.aiff",
    ],
    SoundEvent.VOICE_NOTE_DETECTED: [
        "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/AlertTones/ReceivedMessage.caf",
        "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/AlertTones/Modern/Circles.m4r",
        "/System/Library/Sounds/Ping.aiff",
    ],
    SoundEvent.VOICE_PLAYBACK_START: [
        "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/AlertTones/Modern/Pulse.m4r",
        "/System/Library/Sounds/Pop.aiff",
    ],
    SoundEvent.VOICE_PLAYBACK_FINISHED: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/media_paused.caf",
        "/System/Library/Sounds/Purr.aiff",
        "/System/Library/Sounds/Pop.aiff",
    ],
    SoundEvent.CHAT_MESSAGE_DETECTED: [
        "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/AlertTones/Modern/Note.m4r",
        "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/AlertTones/Modern/Popcorn.m4r",
        "/System/Library/Sounds/Pop.aiff",
    ],
    SoundEvent.MESSAGE_SENT: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/acknowledgment_sent.caf",
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/SentMessage.caf",
        "/System/Library/Sounds/Blow.aiff",
    ],
    SoundEvent.RECORDING_START: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/begin_record.caf",
        "/System/Library/Sounds/Tink.aiff",
    ],
    SoundEvent.RECORDING_STOP: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/end_record.caf",
        "/System/Library/Sounds/Pop.aiff",
    ],
    SoundEvent.VOICE_WAKE: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/siri/jbl_confirm.caf",
        "/System/Library/Sounds/Hero.aiff",
    ],
    SoundEvent.VOICE_SLEEP: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/media_paused.caf",
        "/System/Library/Sounds/Purr.aiff",
    ],
    SoundEvent.MIC_MUTE: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/mic_mute.caf",
        "/System/Library/Sounds/Pop.aiff",
    ],
    SoundEvent.MIC_UNMUTE: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/mic_unmute.caf",
        "/System/Library/Sounds/Tink.aiff",
    ],
    SoundEvent.LOG_EVENT: [
        "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/ink/InkSoundStroke4.aif",
        "/System/Library/Sounds/Tink.aiff",
    ],
    SoundEvent.BOOT: [
        "/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/AlertTones/Modern/Complete.m4r",
        "/System/Library/Sounds/Hero.aiff",
    ],
}

# Volume scaling factor per event (0.0 - 1.0) for acoustic balance
_EVENT_VOLUME_SCALE: Dict[SoundEvent, float] = {
    SoundEvent.TOOL_INTERCEPT: 0.85,
    SoundEvent.TOOL_START: 0.50,
    SoundEvent.TOOL_SUCCESS: 0.85,
    SoundEvent.TOOL_ERROR: 0.80,
    SoundEvent.RESPONSE_SENT: 0.80,
    SoundEvent.ATTACHMENT_SENT: 0.70,
    SoundEvent.VOICE_NOTE_DETECTED: 0.85,
    SoundEvent.VOICE_PLAYBACK_START: 0.60,
    SoundEvent.VOICE_PLAYBACK_FINISHED: 0.60,
    SoundEvent.CHAT_MESSAGE_DETECTED: 0.75,
    SoundEvent.MESSAGE_SENT: 0.80,
    SoundEvent.RECORDING_START: 0.70,
    SoundEvent.RECORDING_STOP: 0.70,
    SoundEvent.VOICE_WAKE: 0.85,
    SoundEvent.VOICE_SLEEP: 0.70,
    SoundEvent.MIC_MUTE: 0.85,
    SoundEvent.MIC_UNMUTE: 0.85,
    SoundEvent.LOG_EVENT: 0.25,      # Quiet, subtle tactile feedback for logs
    SoundEvent.BOOT: 0.85,
}

# Minimum cooldown (seconds) between triggers of the same event to prevent stutter/spam
_EVENT_DEBOUNCE_SECS: Dict[SoundEvent, float] = {
    SoundEvent.LOG_EVENT: 0.30,      # Prevent log flood sound spam
    SoundEvent.TOOL_START: 0.05,
    SoundEvent.TOOL_SUCCESS: 0.05,
    SoundEvent.TOOL_ERROR: 0.05,
    SoundEvent.TOOL_INTERCEPT: 0.20,
    SoundEvent.CHAT_MESSAGE_DETECTED: 0.20,
    SoundEvent.VOICE_NOTE_DETECTED: 0.30,
    SoundEvent.MESSAGE_SENT: 0.20,
    SoundEvent.RESPONSE_SENT: 0.20,
    SoundEvent.MIC_MUTE: 0.15,
    SoundEvent.MIC_UNMUTE: 0.15,
}


class SoundEngine:
    """Thread-safe, non-blocking asynchronous audio engine for OpenAgent."""

    def __init__(self, enabled: Optional[bool] = None, volume: Optional[float] = None):
        if enabled is None:
            env_val = os.getenv("OPENAGENT_SOUNDS_ENABLED", os.getenv("BRIDGE_SOUND_ENABLED", "true")).strip().lower()
            self._enabled = env_val not in ("false", "0", "no", "off", "disable")
        else:
            self._enabled = bool(enabled)

        if volume is None:
            try:
                self._volume = float(os.getenv("OPENAGENT_SOUNDS_VOLUME", os.getenv("BRIDGE_SOUND_VOLUME", "1.0")))
            except (ValueError, TypeError):
                self._volume = 1.0
        else:
            self._volume = max(0.0, min(1.0, float(volume)))

        self._player_bin = shutil.which("afplay")
        self._resolved_paths: Dict[SoundEvent, Optional[str]] = {}
        self._last_played: Dict[SoundEvent, float] = {}
        self._lock = threading.Lock()

        # Cache resolved sound file paths at initialization
        self._warmup_cache()

    @property
    def enabled(self) -> bool:
        return self._enabled

    @enabled.setter
    def enabled(self, val: bool):
        self._enabled = bool(val)

    @property
    def volume(self) -> float:
        return self._volume

    @volume.setter
    def volume(self, val: float):
        self._volume = max(0.0, min(1.0, float(val)))

    def _warmup_cache(self):
        for event, candidates in _SOUND_MAP.items():
            for p in candidates:
                if os.path.isfile(p):
                    self._resolved_paths[event] = p
                    break
            if event not in self._resolved_paths:
                self._resolved_paths[event] = None

    def get_sound_path(self, event: SoundEvent) -> Optional[str]:
        if event in self._resolved_paths:
            return self._resolved_paths[event]
        candidates = _SOUND_MAP.get(event, [])
        for p in candidates:
            if os.path.isfile(p):
                self._resolved_paths[event] = p
                return p
        self._resolved_paths[event] = None
        return None

    def play(self, event: Union[SoundEvent, str], volume_override: Optional[float] = None) -> bool:
        """Play sound for event asynchronously without blocking.
        
        Returns True if playback was dispatched, False otherwise.
        """
        # Auto-mute during pytest suite execution unless explicitly forced
        if "PYTEST_CURRENT_TEST" in os.environ and "OPENAGENT_FORCE_SOUND" not in os.environ:
            return False

        if not self._enabled:
            return False

        if not self._player_bin:
            return False

        if isinstance(event, str):
            try:
                event = SoundEvent(event)
            except ValueError:
                return False

        now = time.monotonic()
        debounce_interval = _EVENT_DEBOUNCE_SECS.get(event, 0.05)

        with self._lock:
            last = self._last_played.get(event, 0.0)
            if now - last < debounce_interval:
                return False
            self._last_played[event] = now

        sound_path = self.get_sound_path(event)
        if not sound_path:
            return False

        # Calculate final volume (base volume * event scale)
        event_scale = _EVENT_VOLUME_SCALE.get(event, 1.0)
        vol = (volume_override if volume_override is not None else self._volume) * event_scale
        vol = max(0.0, min(1.0, vol))
        if vol <= 0.001:
            return False

        def _play_worker(cmd_bin: str, file_path: str, vol_float: float):
            try:
                subprocess.run(
                    [cmd_bin, "-v", f"{vol_float:.3f}", file_path],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                    timeout=10.0,
                )
            except Exception:
                pass

        threading.Thread(
            target=_play_worker,
            args=(self._player_bin, sound_path, vol),
            daemon=True,
            name=f"openagent-sound-{event.value}",
        ).start()
        return True


# Global singleton instance for convenient application-wide access
_GLOBAL_ENGINE = SoundEngine()


def play(event: Union[SoundEvent, str], volume: Optional[float] = None) -> bool:
    """Trigger sound effect for event asynchronously."""
    return _GLOBAL_ENGINE.play(event, volume_override=volume)


def set_enabled(enabled: bool) -> None:
    """Enable or disable sound effects."""
    _GLOBAL_ENGINE.enabled = enabled


def set_volume(volume: float) -> None:
    """Set master sound effects volume (0.0 to 1.0)."""
    _GLOBAL_ENGINE.volume = volume


def is_enabled() -> bool:
    """Check if sound effects are enabled."""
    return _GLOBAL_ENGINE.enabled


def get_volume() -> float:
    """Get current master sound effects volume."""
    return _GLOBAL_ENGINE.volume


def get_engine() -> SoundEngine:
    """Return the global SoundEngine singleton instance."""
    return _GLOBAL_ENGINE


if __name__ == "__main__":
    import sys
    print("=" * 65)
    print("🎵  OPENAGENT IMMERSIVE TERMINAL SOUND ENGINE")
    print("=" * 65)
    engine = get_engine()
    print(f"Status:  {'ENABLED' if engine.enabled else 'DISABLED'}")
    print(f"Player:  {engine._player_bin or 'None'}")
    print(f"Master:  {engine.volume:.1f} (0.0 - 1.0)")
    print("-" * 65)
    print("Sound Event Inventory:")
    for ev in SoundEvent:
        p = engine.get_sound_path(ev)
        status = Path(p).name if p else "MISSING"
        scale = _EVENT_VOLUME_SCALE.get(ev, 1.0)
        print(f"  • {ev.value:<24} [{scale:.2f}x] -> {status}")
    print("-" * 65)

    if "--test" in sys.argv or "-t" in sys.argv:
        print("Playing demo preview of all events sequentially...")
        for ev in SoundEvent:
            print(f"  ▶ Playing {ev.value}...")
            engine.play(ev)
            time.sleep(0.7)
        print("Preview completed!")
