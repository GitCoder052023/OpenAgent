"""Wake-to-send flow through the live listener, with the model stubbed out.

Drives `voice.listen()` with a synthetic microphone stream: energy decides
where utterances begin and end, and Whisper is the only recognizer. No mic,
no weights and no network.
"""
import struct
import sys
import threading
import time
import types
from unittest.mock import patch

import pytest

from OpenAgent import audio as audio_module
from OpenAgent import voice as voice_module
from OpenAgent.config import Config
from OpenAgent.voice import CHUNK_FRAMES, RATE


def tone(seconds, level=3000):
    return struct.pack("<h", level) * int(RATE * seconds)


def quiet(seconds):
    return struct.pack("<h", 20) * int(RATE * seconds)


def drive(stream_pcm, transcripts, silence_seconds=2.0, timeout=10.0):
    """Feed `stream_pcm` through listen(); return the clips handed to on_audio."""
    stop = threading.Event()
    sent = []
    done = threading.Event()
    spoken = list(transcripts)

    def fake_transcribe(pcm, cfg, language=None):
        return spoken.pop(0) if spoken else ""

    class FakeStream:
        def __init__(self, samplerate, blocksize, dtype, channels, callback):
            self.blocksize, self.callback = blocksize, callback

        def __enter__(self):
            threading.Thread(target=self._pump, daemon=True).start()
            return self

        def __exit__(self, *exc):
            return False

        def _pump(self):
            step = self.blocksize * 2
            for i in range(0, len(stream_pcm), step):
                self.callback(stream_pcm[i:i + step], self.blocksize, None, None)
                time.sleep(0.002)

    fake_sd = types.ModuleType("sounddevice")
    fake_sd.RawInputStream = FakeStream

    def on_audio(pcm, text=None):
        sent.append((pcm, text))
        done.set()

    ready = {"engine": "mlx", "model": "stub", "ready": True, "detail": "stubbed engine"}
    with patch.dict(sys.modules, {"sounddevice": fake_sd}), \
            patch.object(audio_module, "engine_status", return_value=ready), \
            patch.object(audio_module, "prewarm", return_value=True), \
            patch.object(audio_module, "transcribe_pcm", side_effect=fake_transcribe):
        listener = threading.Thread(
            target=voice_module.listen,
            args=(Config(voice_silence_seconds=silence_seconds), on_audio, stop),
            daemon=True,
        )
        listener.start()
        done.wait(timeout)
        stop.set()
        listener.join(timeout=5)
    return sent


# A wake phrase, a pause, a request, then the quiet gap that submits it.
SESSION = quiet(0.6) + tone(1.0) + quiet(1.0) + tone(3.0) + quiet(2.6)


def test_wake_phrase_then_request_is_sent_with_its_transcript():
    sent = drive(SESSION, ["hey jarvis", "run the test suite"])
    assert len(sent) == 1
    pcm, text = sent[0]
    assert text == "run the test suite"
    # The clip carries the request, not the wake phrase that preceded it.
    assert 2.0 <= len(pcm) / (RATE * 2) <= 5.0


def test_speech_before_the_wake_phrase_is_never_sent():
    sent = drive(SESSION, ["what time is the meeting", "run the test suite"], timeout=4.0)
    assert sent == []


def test_sleep_phrase_stops_further_sends():
    sent = drive(SESSION, ["hey jarvis", "jarvis stand by"], timeout=4.0)
    assert sent == []


@pytest.mark.parametrize("stream", [quiet(4.0), quiet(1.0) + tone(0.15) + quiet(2.0)])
def test_room_tone_and_impulses_never_reach_the_model(stream):
    # A blip too short to be speech must not wake anything or be transcribed.
    sent = drive(stream, ["hey jarvis", "run the test suite"], timeout=3.0)
    assert sent == []


def test_chunk_size_matches_the_stream_block():
    # listen() assumes each callback block is one endpointing chunk.
    assert CHUNK_FRAMES == RATE // 10
