"""Opt-in local, continuous microphone command mode.

No idle audio is saved. Commands require standalone wake phrases.
Real-time partial and final recognition with visible audio feedback.
"""
try:
    import audioop
except ImportError:
    try:
        import audioop_lts as audioop
    except ImportError:
        import array
        import math

        class _AudioOpFallback:
            @staticmethod
            def rms(fragment, width):
                if not fragment:
                    return 0
                if width == 2:
                    a = array.array("h")
                    a.frombytes(fragment)
                    if not a:
                        return 0
                    return int(math.isqrt(sum(x * x for x in a) // len(a)))
                elif width == 1:
                    return int(math.isqrt(sum((b - 128) ** 2 for b in fragment) // len(fragment)))
                elif width == 4:
                    a = array.array("i")
                    a.frombytes(fragment)
                    if not a:
                        return 0
                    return int(math.isqrt(sum(x * x for x in a) // len(a)))
                return 0

        audioop = _AudioOpFallback()

import json
import queue
import re
import time
from pathlib import Path

RATE = 16000

WAKE_WORDS = (
    "wake up jarvis",
    "wakeup jarvis",
    "wake jarvis",
    "hey jarvis",
    "hi jarvis",
    "hello jarvis",
    "ok jarvis",
    "okay jarvis",
    "wake up",
    "wakeup",
    "jarvis wake up",
    "jarvis",
    # Common Vosk phonetic misrecognitions for "jarvis"
    "wake up service",
    "wake up travis",
    "wake up drivers",
    "wake up davis",
)

SLEEP_WORDS = (
    "jarvis stand by",
    "stand by jarvis",
    "stand by",
    "jarvis sleep",
    "go to sleep",
    "sleep jarvis",
)

CONFIRM_WORDS = (
    "confirm stand by jarvis",
    "confirm stand by",
    "confirm sleep",
    "confirm",
)


def normalized(text):
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", text.casefold()).split())


def is_wake_phrase(text: str) -> bool:
    norm = normalized(text)
    if not norm:
        return False
    return any(w in norm for w in WAKE_WORDS)


def is_sleep_phrase(text: str) -> bool:
    norm = normalized(text)
    if not norm:
        return False
    return any(w in norm for w in SLEEP_WORDS)


def is_confirm_phrase(text: str) -> bool:
    norm = normalized(text)
    if not norm:
        return False
    return any(w in norm for w in CONFIRM_WORDS)


class VoiceState:
    def __init__(self):
        self.awake = False
        self.confirm_until = 0.0

    def accept(self, text, now=None):
        """Return wake, sleep_prompt, sleep, ignore or send; never sleep on a substring."""
        now = time.monotonic() if now is None else now
        text = normalized(text)
        if not text:
            return "ignore"

        if not self.awake:
            if is_wake_phrase(text):
                self.awake = True
                return "wake"
            return "ignore"

        if self.confirm_until:
            deadline = self.confirm_until
            self.confirm_until = 0.0
            if now <= deadline and is_confirm_phrase(text):
                self.awake = False
                return "sleep"

        if is_sleep_phrase(text):
            self.confirm_until = now + 8.0
            return "sleep_prompt"

        if is_wake_phrase(text) or is_confirm_phrase(text):
            return "ignore"

        return "send"


def listen(cfg, on_audio, stop):
    """Listen continuously; group recognized speech until a sustained quiet gap."""
    try:
        import sounddevice as sd
        from vosk import Model, KaldiRecognizer, SetLogLevel
    except ImportError as exc:
        raise RuntimeError("Voice mode needs pip install '.[voice]' (vosk and sounddevice)") from exc

    model_path = Path(cfg.voice_model).expanduser()
    if not model_path.is_dir():
        raise RuntimeError(f"Voice model directory missing: {model_path}. Set BRIDGE_VOICE_MODEL.")

    silence_seconds = cfg.voice_silence_seconds
    if not 2 <= silence_seconds <= 30:
        raise ValueError("BRIDGE_VOICE_SILENCE_SECONDS must be between 2 and 30")

    SetLogLevel(-1)
    model = Model(str(model_path))
    recognizer = KaldiRecognizer(model, RATE)
    state = VoiceState()
    phrase = []
    phrase_frames = 0
    clip = []
    clip_frames = 0
    last_voice_at = 0.0
    q = queue.Queue(maxsize=128)

    max_level_seen = 0
    start_time = time.monotonic()
    checked_mic_level = False

    def callback(indata, count, timestamp, status):
        if status:
            print(f"[Mic warning] {status}")
        try:
            q.put_nowait(bytes(indata))
        except queue.Full:
            while not q.empty():
                try:
                    q.get_nowait()
                except queue.Empty:
                    break
            q.put_nowait(None)

    def flush():
        nonlocal clip, clip_frames
        if clip_frames >= RATE:
            on_audio(b"".join(clip))
        clip, clip_frames = [], 0

    def finish(text, now):
        nonlocal phrase, phrase_frames, clip, clip_frames, recognizer, last_voice_at
        text = (text or "").strip()
        if not text:
            return
        action = state.accept(text, now)
        if action == "wake":
            print(f"\n[⚡ Jarvis awake] Listening to your request... ({silence_seconds:g}s of quiet sends audio)")
        elif action == "sleep_prompt":
            flush()
            print("\n[Sleep requested] Say 'confirm stand by Jarvis' within 8 seconds; anything else cancels it.")
        elif action == "sleep":
            flush()
            print("\n[💤 Jarvis sleeping] Listening for 'Wakeup Jarvis' or 'Hey Jarvis'.")
        elif action == "send":
            clip.extend(phrase)
            clip_frames += phrase_frames
            if not last_voice_at:
                last_voice_at = now
            print(f"[Capturing] \"{text}\"")
        elif not state.awake:
            print(f"[Mic heard] \"{text}\"")
            clip, clip_frames = [], 0
        phrase, phrase_frames = [], 0
        recognizer = KaldiRecognizer(model, RATE)

    print("[Voice mode] Default microphone open. Idle audio is not saved. Say 'Wakeup Jarvis'. Esc quits.")
    with sd.RawInputStream(samplerate=RATE, blocksize=4000, dtype="int16", channels=1, callback=callback):
        while not stop.is_set():
            try:
                data = q.get(timeout=0.3)
            except queue.Empty:
                continue

            now = time.monotonic()
            if data is None:
                phrase, phrase_frames, clip, clip_frames = [], 0, [], 0
                last_voice_at = 0.0
                recognizer = KaldiRecognizer(model, RATE)
                print("[Mic overflow] Dropped partial audio; retry the command.")
                continue

            # Audio level calculation
            level = audioop.rms(data, 2)
            if level > max_level_seen:
                max_level_seen = level

            # Diagnostic check for mic input permissions after a few seconds
            if not checked_mic_level and now - start_time > 4.0:
                checked_mic_level = True
                if max_level_seen < 30:
                    print("\n[Mic warning] Audio level near 0. If you are speaking, ensure Terminal has Microphone permission:")
                    print("  → macOS System Settings > Privacy & Security > Microphone > Enable Terminal/Python\n")

            if state.awake:
                phrase.append(data)
                phrase_frames += len(data) // 2
                if level >= 200:
                    last_voice_at = now

            # Speech recognition
            if recognizer.AcceptWaveform(data):
                res_text = json.loads(recognizer.Result()).get("text", "").strip()
                if res_text:
                    finish(res_text, now)
            elif not state.awake:
                # Catch wake words in real-time partial results without waiting for phrase silence
                partial = json.loads(recognizer.PartialResult()).get("partial", "").strip()
                if partial and is_wake_phrase(partial):
                    finish(partial, now)

            if not state.awake:
                continue

            # Silence threshold reached while awake: finalize speech and send
            if (clip_frames or phrase_frames) and last_voice_at and now - last_voice_at >= silence_seconds:
                trailing = phrase.copy()
                trailing_frames = phrase_frames
                final_text = json.loads(recognizer.FinalResult()).get("text", "").strip()
                if final_text:
                    finish(final_text, now)
                if state.awake and not final_text:
                    clip.extend(trailing)
                    clip_frames += trailing_frames
                if state.awake and clip_frames >= RATE:
                    dur_s = clip_frames / RATE
                    print(f"\n[Audio captured (~{dur_s:.1f}s)] Sending to WhatsApp (+{cfg.number})...")
                    flush()
                    print("[Sent! Jarvis listening for next utterance or 'Jarvis stand by']")
                last_voice_at = 0.0
