"""Capture guard regression tests. No mic, WhatsApp, or Vosk required."""
import struct
from bridge.config import Config
from bridge.voice import RATE, prepare_clip


def pcm(seconds, level=0):
    return struct.pack('<h', level) * int(RATE * seconds)


def test_voice_default_silence_is_valid():
    assert Config().voice_silence_seconds == 1


def test_no_recognition_or_quiet_audio_is_not_sent():
    assert prepare_clip(pcm(3, 350), []) is None
    assert prepare_clip(pcm(3, 0), ['noise']) is None


def test_trim_silent_edges_with_short_margin():
    raw = pcm(2) + pcm(2, 1800) + pcm(3)
    out = prepare_clip(raw, ['hello'])
    assert out is not None
    assert 2 <= len(out) / (RATE * 2) < 3


def test_short_ambient_word_in_three_minute_recording_dropped():
    raw = pcm(100) + pcm(1, 2000) + pcm(79)
    assert prepare_clip(raw, ['mummy']) is None
