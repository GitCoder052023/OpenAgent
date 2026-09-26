"""Opt-in local, continuous microphone command mode.

No idle audio is saved. Commands require exact standalone phrases; this is not
speaker authentication or call isolation.
"""
import audioop
import json
import queue
import re
import time
from pathlib import Path

RATE = 16000
WAKE = re.compile(r"^wake\s*up\s+jarvis[.!?]*$", re.I)
SLEEP_REQUEST = re.compile(r"^jarvis[, ]+stand\s*by[.!?]*$", re.I)
SLEEP_CONFIRM = re.compile(r"^confirm\s+stand\s*by[, ]+jarvis[.!?]*$", re.I)


def normalized(text):
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", text.casefold()).split())


class VoiceState:
    def __init__(self):
        self.awake = False
        self.confirm_until = 0.0

    def accept(self, text, now=None):
        """Return wake, sleep_prompt, sleep, ignore or send; never sleep on a substring."""
        now = time.monotonic() if now is None else now
        text = normalized(text)
        if not self.awake:
            if WAKE.fullmatch(text):
                self.awake = True
                return "wake"
            return "ignore"
        if self.confirm_until:
            deadline = self.confirm_until
            self.confirm_until = 0.0
            if now <= deadline and SLEEP_CONFIRM.fullmatch(text):
                self.awake = False
                return "sleep"
        if SLEEP_REQUEST.fullmatch(text):
            self.confirm_until = now + 8.0
            return "sleep_prompt"
        if text == normalized("wake up jarvis") or text == normalized("confirm stand by jarvis"):
            return "ignore"
        return "send" if text else "ignore"


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

    def callback(indata, count, timestamp, status):
        if status:
            print(f"[Mic warning] {status}")
        try:
            q.put_nowait(bytes(indata))
        except queue.Full:
            # A lost fragment invalidates both the clip and any partial command.
            while not q.empty():
                try: q.get_nowait()
                except queue.Empty: break
            q.put_nowait(None)

    def flush():
        nonlocal clip, clip_frames
        if clip_frames >= RATE:
            on_audio(b"".join(clip))
        clip, clip_frames = [], 0

    def finish(text, now):
        nonlocal phrase, phrase_frames, clip, clip_frames, recognizer, last_voice_at
        action = state.accept(text, now)
        if action == "wake":
            print(f"[Jarvis awake] {silence_seconds:g}s of quiet sends audio. Say 'Jarvis stand by', then 'confirm stand by Jarvis' to sleep.")
        elif action == "sleep_prompt":
            flush()
            print("[Sleep requested] Say 'confirm stand by Jarvis' within 8 seconds; anything else cancels it.")
        elif action == "sleep":
            flush()
            print("[Jarvis sleeping] Listening for 'Wakeup Jarvis'.")
        elif action == "send":
            clip.extend(phrase)
            clip_frames += phrase_frames
            if not last_voice_at:
                last_voice_at = now
        elif not state.awake:
            clip, clip_frames = [], 0

No idle audio is saved. Commands require exact standalone phrases; this is not
speaker authentication or call isolation.
"""
import audioop
import json
import queue
import re
import time
from pathlib import Path

RATE = 16000
WAKE = re.compile(r"^wake\s*up\s+jarvis[.!?]*$", re.I)
SLEEP_REQUEST = re.compile(r"^jarvis[, ]+stand\s*by[.!?]*$", re.I)
SLEEP_CONFIRM = re.compile(r"^confirm\s+stand\s*by[, ]+jarvis[.!?]*$", re.I)


def normalized(text):
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", text.casefold()).split())


class VoiceState:
    def __init__(self):
        self.awake = False
        self.confirm_until = 0.0

    def accept(self, text, now=None):
        """Return wake, sleep_prompt, sleep, ignore or send; never sleep on a substring."""
        now = time.monotonic() if now is None else now
        text = normalized(text)
        if not self.awake:
            if WAKE.fullmatch(text):
                self.awake = True
                return "wake"
            return "ignore"
        if self.confirm_until:
            deadline = self.confirm_until
            self.confirm_until = 0.0
            if now <= deadline and SLEEP_CONFIRM.fullmatch(text):
                self.awake = False
                return "sleep"
        if SLEEP_REQUEST.fullmatch(text):
            self.confirm_until = now + 8.0
            return "sleep_prompt"
        if text == normalized("wake up jarvis") or text == normalized("confirm stand by jarvis"):
            return "ignore"
        return "send" if text else "ignore"


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

    def callback(indata, count, timestamp, status):
        if status:
            print(f"[Mic warning] {status}")
        try:
            q.put_nowait(bytes(indata))
        except queue.Full:
            # A lost fragment invalidates both the clip and any partial command.
            while not q.empty():
                try: q.get_nowait()
                except queue.Empty: break
            q.put_nowait(None)

    def flush():
        nonlocal clip, clip_frames
        if clip_frames >= RATE:
            on_audio(b"".join(clip))
        clip, clip_frames = [], 0

    def finish(text, now):
        nonlocal phrase, phrase_frames, clip, clip_frames, recognizer, last_voice_at
        action = state.accept(text, now)
        if action == "wake":
            print(f"[Jarvis awake] {silence_seconds:g}s of quiet sends audio. Say 'Jarvis stand by', then 'confirm stand by Jarvis' to sleep.")
        elif action == "sleep_prompt":
            flush()
            print("[Sleep requested] Say 'confirm stand by Jarvis' within 8 seconds; anything else cancels it.")
        elif action == "sleep":
            flush()
            print("[Jarvis sleeping] Listening for 'Wakeup Jarvis'.")
        elif action == "send":
            clip.extend(phrase)
            clip_frames += phrase_frames
            if not last_voice_at:
                last_voice_at = now
        elif not state.awake:
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
            if state.awake:
                phrase.append(data)
                phrase_frames += len(data) // 2
                if audioop.rms(data, 2) >= 250:
                    last_voice_at = now
            if recognizer.AcceptWaveform(data):
                finish(json.loads(recognizer.Result()).get("text", ""), now)
            if not state.awake:
                continue
            if (clip_frames or phrase_frames) and last_voice_at and now - last_voice_at >= silence_seconds:
                # Classify a trailing command before the clip is sent.
                trailing = phrase.copy()
                trailing_frames = phrase_frames
                final_text = json.loads(recognizer.FinalResult()).get("text", "")
                finish(final_text, now)
                if state.awake and not final_text.strip():
                    clip.extend(trailing)
                    clip_frames += trailing_frames
                if state.awake:
                    flush()
                last_voice_at = 0.0
