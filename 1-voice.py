"""Opt-in local, continuous microphone command mode.

The audio stream stays open while this process runs. No idle audio is saved.
Only finalized phrases can cause a transition; a two-part exact command is
required to sleep. This is not speaker authentication or call isolation.
"""
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
            # An unrelated utterance cancels the sleep request and is handled normally.
        if SLEEP_REQUEST.fullmatch(text):
            self.confirm_until = now + 8.0
            return "sleep_prompt"
        if text == normalized("wake up jarvis") or text == normalized("confirm stand by jarvis"):
            return "ignore"
        return "send" if text else "ignore"


def listen(cfg, on_audio, stop):
    """Listen continuously through the default mic and deliver one WAV per utterance.

    Vosk's finalized recognition is used only for command classification, never
    for the content sent to WhatsApp. Incoming PCM is held in memory only while
    awake; utterances end after recognition endpoint or max_record_seconds.
    """
    try:
        import sounddevice as sd
        from vosk import Model, KaldiRecognizer, SetLogLevel
    except ImportError as exc:
        raise RuntimeError("Voice mode needs pip install '.[voice]' (vosk and sounddevice)") from exc
    model_path = Path(cfg.voice_model).expanduser()
    if not model_path.is_dir():
        raise RuntimeError(f"Voice model directory missing: {model_path}. Set BRIDGE_VOICE_MODEL.")
    SetLogLevel(-1)
    model = Model(str(model_path))
    recognizer = KaldiRecognizer(model, RATE)
    state = VoiceState()
    chunks = []
    frames = 0
    q = queue.Queue(maxsize=128)
    max_frames = RATE * max(2, cfg.max_record_seconds)

    def callback(indata, count, timestamp, status):
        if status:
            print(f"[Mic warning] {status}")
        try:
            q.put_nowait(bytes(indata))
        except queue.Full:
            # Discard the active utterance; missing audio must never become a command.
            try:
                q.put_nowait(None)
            except queue.Full:
                pass

    def finish(text):
        nonlocal chunks, frames, recognizer
        action = state.accept(text)
        if action == "wake":
            print("[Jarvis awake] Speak; pause to send audio. Say 'Jarvis stand by', then 'confirm stand by Jarvis' to sleep.")
        elif action == "sleep_prompt":
            print("[Sleep requested] Say 'confirm stand by Jarvis' within 8 seconds; anything else cancels it.")
        elif action == "sleep":
            print("[Jarvis sleeping] Listening for 'Wakeup Jarvis'.")
        elif action == "send" and chunks and frames >= RATE:
            # WAV encoding happens in the worker; do not block the microphone callback.
            on_audio(b"".join(chunks))
        chunks, frames = [], 0
        recognizer = KaldiRecognizer(model, RATE)

    print("[Voice mode] Default microphone open. Idle audio is not saved. Say 'Wakeup Jarvis'. Esc quits.")
    with sd.RawInputStream(samplerate=RATE, blocksize=4000, dtype="int16", channels=1, callback=callback):
        while not stop.is_set():
            try:
                data = q.get(timeout=0.3)
            except queue.Empty:
                continue
            if data is None:
                chunks, frames = [], 0
                recognizer = KaldiRecognizer(model, RATE)
                print("[Mic overflow] Dropped partial audio; retry the command.")
                continue
            if state.awake:
                chunks.append(data)
                frames += len(data) // 2
            if recognizer.AcceptWaveform(data):
                finish(json.loads(recognizer.Result()).get("text", ""))
            elif state.awake and frames >= max_frames:
                finish(json.loads(recognizer.FinalResult()).get("text", ""))
