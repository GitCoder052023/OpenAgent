"""Opt-in local, continuous microphone command mode.

No idle audio is saved. Commands require standalone wake phrases.
Real-time partial and final recognition with visible audio feedback.
"""
try:
    import audioop
    import math
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
from .diagnostics import event
from .sound import SoundEvent, play as play_sound
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


def _bare_wake_or_confirm(norm: str) -> bool:
    """True only when the utterance is essentially just a wake/confirm phrase.

    While awake, substring-matching short wake words like "jarvis" anywhere in a
    long message must NOT discard the message: people naturally say "Jarvis"
    mid-sentence when talking to Jarvis, and Vosk can merge the wake phrase and
    the real request into one result. Only ignore results that are the bare
    phrase itself, plus at most one extra filler token.
    """
    if norm in WAKE_WORDS or norm in CONFIRM_WORDS:
        return True
    words = norm.split()
    if len(words) > 4:
        return False
    for phrase in tuple(WAKE_WORDS) + tuple(CONFIRM_WORDS):
        if phrase in norm and len(words) - len(phrase.split()) <= 1:
            return True
    return False


def gate_pcm(pcm, source="voice", recognized=None):
    """Conservative energy gate; recognition is only a hint, never proof of speech."""
    seconds = len(pcm) / (RATE * 2)
    if seconds < 1 or len(pcm) % 2:
        event("audio_gate", source=source, accepted=False, reason="invalid_or_short", duration_s=round(seconds, 2))
        return False
    window = RATE // 50 * 2
    levels = [audioop.rms(pcm[i:i + window], 2) for i in range(0, len(pcm) - window + 1, window)]
    peak = max(levels, default=0)
    # A fixed floor avoids promoting steady room hiss to speech. Relative floor
    # rejects low-level tails after isolated peaks, not a voice classifier.
    threshold = max(180, min(650, int(peak * 0.13)))
    active = sum(level >= threshold for level in levels)
    active_s = active / 50
    ratio = active_s / seconds
    words = len(" ".join(recognized or []).split())

    # Count sustained active runs (>= 4 consecutive 20ms windows, i.e. >= 80ms continuous voicing).
    # Speech contains sustained vowel/consonant phonemes; typing clicks are isolated 10-30ms impulses.
    max_run = 0
    curr_run = 0
    sustained_windows = 0
    for level in levels:
        if level >= threshold:
            curr_run += 1
            if curr_run > max_run:
                max_run = curr_run
        else:
            if curr_run >= 4:
                sustained_windows += curr_run
            curr_run = 0
    if curr_run >= 4:
        sustained_windows += curr_run
    sustained_s = sustained_windows / 50

    reason = "ok"
    if recognized is not None and not words:
        reason = "no_recognition"
    elif peak < 400 or active_s < 0.7:
        reason = "low_energy"
    elif max_run < 4 or sustained_s < 0.15:
        reason = "impulse_noise"
    elif (seconds >= 5.0 and ratio < 0.15) or (seconds >= 8.0 and (ratio < 0.18 or active_s < 1.3)):
        reason = "mostly_quiet"
    elif seconds >= 8.0 and recognized is not None and words < max(2, int(seconds / 8)):
        reason = "sparse_recognition"
    event("audio_gate", source=source, accepted=reason == "ok", reason=reason,
          duration_s=round(seconds, 2), active_s=round(active_s, 2),
          active_ratio=round(ratio, 3), peak=peak, threshold=threshold, words=words,
          max_run=max_run, sustained_s=round(sustained_s, 2))
    return reason == "ok"


def prepare_clip(pcm, recognized):
    """Trim quiet edges after the conservative shared energy/recognition gate."""
    if not gate_pcm(pcm, source="voice", recognized=recognized):
        return None
    window = RATE // 50 * 2
    levels = [audioop.rms(pcm[i:i + window], 2) for i in range(0, len(pcm) - window + 1, window)]
    threshold = max(180, min(650, int(max(levels) * 0.13)))
    active = [i for i, level in enumerate(levels) if level >= threshold]
    margin = 18
    start = max(0, active[0] - margin) * window
    end = min(len(pcm), (active[-1] + margin + 1) * window)
    return pcm[start:end]



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

        if _bare_wake_or_confirm(text):
            return "ignore"

        return "send"


def listen(cfg, on_audio, stop, playing=None, user_recording=None, muted=None):
    """Listen continuously; group recognized speech until a sustained quiet gap."""
    try:
        import sounddevice as sd
        from vosk import Model, KaldiRecognizer, SetLogLevel
    except ImportError as exc:
        raise RuntimeError("Voice mode needs uv sync --extra voice (vosk and sounddevice)") from exc

    model_path = Path(cfg.voice_model).expanduser()
    if not model_path.is_absolute() and not model_path.is_dir():
        here = Path(__file__).resolve()
        repo_root = here.parents[2] if len(here.parents) > 2 and here.parents[1].name == "src" else here.parents[1]
        if (repo_root / model_path).is_dir():
            model_path = repo_root / model_path
    if not model_path.is_dir():
        raise RuntimeError(f"Voice model directory missing: {model_path}. Set BRIDGE_VOICE_MODEL.")

    silence_seconds = cfg.voice_silence_seconds
    if not 1 <= silence_seconds <= 30:
        raise ValueError("BRIDGE_VOICE_SILENCE_SECONDS must be between 1 and 30")

    SetLogLevel(-1)
    model = Model(str(model_path))
    recognizer = KaldiRecognizer(model, RATE)
    state = VoiceState()
    phrase = []
    phrase_frames = 0
    clip = []
    clip_frames = 0
    recognized = []
    last_voice_at = 0.0
    q = queue.Queue(maxsize=128)

    max_level_seen = 0
    start_time = time.monotonic()
    checked_mic_level = False
    was_playing = False
    last_buffer_log = 0.0

    def callback(indata, count, timestamp, status):
        if status:
            print(f"[Mic warning] {status}")
        # Drop mic audio at source while Jarvis voice note is playing through speakers or when muted
        if (playing is not None and playing.is_set()) or (muted is not None and muted.is_set()):
            return
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
        nonlocal clip, clip_frames, recognized
        raw = b"".join(clip)
        words = len(" ".join(recognized).split())
        event("capture_flush", duration_s=round(len(raw)/32000, 2), recognized_words=words)
        if not words:
            if user_recording is not None:
                user_recording.clear()
            if clip_frames:
                print("[Voice mode] Dropped quiet or unrecognized audio.")
            clip, clip_frames, recognized = [], 0, []
            return
        pcm = prepare_clip(raw, recognized)
        if pcm is not None:
            on_audio(pcm)
        else:
            if user_recording is not None:
                user_recording.clear()
            if clip_frames:
                print("[Voice mode] Dropped quiet or unrecognized audio.")
        clip, clip_frames, recognized = [], 0, []

    def finish(text, now):
        nonlocal phrase, phrase_frames, clip, clip_frames, recognizer, last_voice_at, recognized
        text = (text or "").strip()
        if not text:
            return "empty"
        action = state.accept(text, now)
        if action == "wake":
            play_sound(SoundEvent.VOICE_WAKE)
            print(f"\n[⚡ Jarvis awake] Listening to your request... ({silence_seconds:g}s of quiet sends audio)")
        elif action == "sleep_prompt":
            flush()
            if user_recording is not None:
                user_recording.clear()
            print("\n[Sleep requested] Say 'confirm stand by Jarvis' within 8 seconds; anything else cancels it.")
        elif action == "sleep":
            play_sound(SoundEvent.VOICE_SLEEP)
            flush()
            if user_recording is not None:
                user_recording.clear()
            print("\n[💤 Jarvis sleeping] Listening for 'Wakeup Jarvis' or 'Hey Jarvis'.")
        elif action == "send":
            if user_recording is not None:
                user_recording.set()
            play_sound(SoundEvent.RECORDING_START)
            clip.extend(phrase)
            clip_frames += phrase_frames
            recognized.append(text)
            if not last_voice_at:
                last_voice_at = now
            print(f"[Capturing] \"{text}\"")
        elif not state.awake:
            print(f"[Mic heard] \"{text}\"")
            clip, clip_frames, recognized = [], 0, []
        elif phrase_frames:
            # Awake and the result was only a wake/confirm echo: the wake phrase
            # itself is dropped on purpose, but never silently.
            event("capture_drop", reason="wake_echo", dropped_s=round(phrase_frames / RATE, 2))
            print(f"[Voice mode] Ignored wake-word echo ({phrase_frames / RATE:.1f}s).")
        phrase, phrase_frames = [], 0
        recognizer = KaldiRecognizer(model, RATE)
        return action

    print("[Voice mode] Default microphone open. Idle audio is not saved. Press F5 to mute/unmute mic. Say 'Wakeup Jarvis'. Esc quits.")
    with sd.RawInputStream(samplerate=RATE, blocksize=4000, dtype="int16", channels=1, callback=callback):
        while not stop.is_set():
            try:
                data = q.get(timeout=0.3)
            except queue.Empty:
                data = b""  # Still observe playback transitions when the callback drops frames.

            now = time.monotonic()

            # Hardware / software mic mute guard:
            if muted is not None and muted.is_set():
                phrase.clear()
                phrase_frames = 0
                clip.clear()
                clip_frames = 0
                recognized.clear()
                last_voice_at = 0.0
                while not q.empty():
                    try:
                        q.get_nowait()
                    except queue.Empty:
                        break
                recognizer = KaldiRecognizer(model, RATE)
                continue

            # Echo cancellation / feedback suppression:
            # If WhatsApp is currently playing a voice note, or during echo-tail cooldown:
            if playing is not None and playing.is_set():
                if not was_playing: event("echo_guard", state="playback_started")
                was_playing = True
                phrase.clear()
                phrase_frames = 0
                clip.clear()
                clip_frames = 0
                recognized.clear()
                last_voice_at = 0.0
                while not q.empty():
                    try:
                        q.get_nowait()
                    except queue.Empty:
                        break
                recognizer = KaldiRecognizer(model, RATE)
                continue

            if was_playing:
                event("echo_guard", state="playback_finished_queue_flushed")
                was_playing = False
                phrase.clear()
                phrase_frames = 0
                clip.clear()
                clip_frames = 0
                recognized.clear()
                last_voice_at = 0.0
                while not q.empty():
                    try:
                        q.get_nowait()
                    except queue.Empty:
                        break
                recognizer = KaldiRecognizer(model, RATE)
                continue

            if not data:
                if data == b"":
                    continue
                phrase, phrase_frames, clip, clip_frames = [], 0, [], 0
                recognized.clear()
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

            partial = ""
            if state.awake:
                phrase.append(data)
                phrase_frames += len(data) // 2

            # Speech recognition
            if recognizer.AcceptWaveform(data):
                res_text = json.loads(recognizer.Result()).get("text", "").strip()
                if res_text:
                    finish(res_text, now)
            else:
                try:
                    partial = json.loads(recognizer.PartialResult()).get("partial", "").strip()
                except Exception:
                    partial = ""
                if not state.awake and partial and is_wake_phrase(partial):
                    finish(partial, now)

            if state.awake:
                # Active speech indicator: words in partial recognition or active voicing
                is_speaking = bool(partial) or (level >= 200 and last_voice_at and (now - last_voice_at < 1.0))
                if is_speaking:
                    if user_recording is not None and not user_recording.is_set():
                        user_recording.set()
                elif not clip_frames and phrase_frames > RATE * 3:
                    # Cap speculative pre-roll only when no speech has begun yet (pure ambient idle)
                    target_frames = int(RATE * 2.5)
                    while phrase and phrase_frames > target_frames:
                        dropped = phrase.pop(0)
                        phrase_frames -= len(dropped) // 2

                if level >= 180 or partial:
                    last_voice_at = now
                if now - last_buffer_log >= 1.0:
                    last_buffer_log = now
                    event("capture_buffer", phrase_s=round(phrase_frames / RATE, 2),
                          clip_s=round(clip_frames / RATE, 2), audio_level=level)

            if not state.awake:
                continue

            # Silence threshold reached while awake: finalize speech and send
            if (clip_frames or phrase_frames) and last_voice_at and now - last_voice_at >= silence_seconds:
                trailing = phrase.copy()
                trailing_frames = phrase_frames
                final_text = json.loads(recognizer.FinalResult()).get("text", "").strip()
                event("capture_silence", trailing_s=round(trailing_frames / RATE, 2),
                      clip_s=round(clip_frames / RATE, 2), final_words=len(final_text.split()))
                if final_text:
                    action = finish(final_text, now)
                    if action == "ignore" and trailing_frames:
                        event("capture_drop", reason="wake_echo_flush", dropped_s=round(trailing_frames / RATE, 2))
                if state.awake:
                    if clip_frames:
                        if not final_text:
                            clip.extend(trailing)
                            clip_frames += trailing_frames
                        flush()
                    else:
                        phrase.clear()
                        phrase_frames = 0
                        if user_recording is not None:
                            user_recording.clear()
                last_voice_at = 0.0
