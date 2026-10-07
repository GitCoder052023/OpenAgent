"""Capture guard regression tests. No mic, WhatsApp, or Vosk required."""
import struct
from OpenAgent.config import Config
from OpenAgent.voice import RATE, prepare_clip, gate_pcm


def pcm(seconds, level=0):
    return struct.pack('<h', level) * int(RATE * seconds)


def test_voice_default_silence_is_valid():
    assert 1 <= Config().voice_silence_seconds <= 30


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


def test_keyboard_typing_clicks_rejected_even_with_phantom_word():
    # 9-second clip simulating mechanical typing: 30 clicks of 25ms each at 700 RMS
    click = struct.pack('<h', 700) * int(RATE * 0.025)
    raw = bytearray(struct.pack('<h', 20) * (RATE * 9))
    for i in range(30):
        pos = int(i * 0.28 * RATE * 2)
        if pos + len(click) <= len(raw):
            raw[pos:pos + len(click)] = click
    typing_pcm = bytes(raw)

    # Must reject even if Vosk hallucinated 1 word ("the")
    assert not gate_pcm(typing_pcm, source="voice", recognized=["the"])
    assert prepare_clip(typing_pcm, ["the"]) is None
    # Must also reject on hotkey mode
    assert not gate_pcm(typing_pcm, source="hotkey")


def test_real_speech_with_sustained_voicing_passes():
    # 3-second clip: 0.5s pre-roll, two 350ms continuous vowels at 1200 RMS, 0.5s pause, 0.8s post-roll
    vowel = struct.pack('<h', 1200) * int(RATE * 0.35)
    raw = bytearray(struct.pack('<h', 20) * (RATE * 3))
    raw[int(RATE * 0.5 * 2):int(RATE * 0.5 * 2) + len(vowel)] = vowel
    raw[int(RATE * 1.3 * 2):int(RATE * 1.3 * 2) + len(vowel)] = vowel
    speech_pcm = bytes(raw)

    assert gate_pcm(speech_pcm, source="voice", recognized=["hey", "jarvis"])
    out = prepare_clip(speech_pcm, ["hey", "jarvis"])
    assert out is not None
    assert len(out) > 0


def test_sparse_recognition_rejected():
    # 12-second clip with 1 word: even with sustained energy, 1 word in 12s is sparse recognition
    raw = pcm(12, 1000)
    assert not gate_pcm(raw, source="voice", recognized=["hello"])
    assert prepare_clip(raw, ["hello"]) is None
    # 2 words in 12s passes
    assert gate_pcm(raw, source="voice", recognized=["hello", "world"])


def test_voice_muted_event_state():
    import threading
    muted = threading.Event()
    assert not muted.is_set()
    muted.set()
    assert muted.is_set()
    muted.clear()
    assert not muted.is_set()
