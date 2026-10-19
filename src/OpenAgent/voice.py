"""Opt-in local, continuous microphone command mode.

Wake phrases and requests are both recognized by on-device Whisper Large V3
Turbo ([`audio.py`](audio.py)): the stream is segmented by energy, and only a
finished utterance is transcribed. No idle audio is saved, and nothing leaves
the Mac until a request is sent.
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

import queue
from collections import deque
from .diagnostics import event
from .sound import SoundEvent, play as play_sound
import re
import time

RATE = 16000

# Utterance endpointing. Speech starts after ONSET_CHUNKS loud chunks and ends
# on a quiet gap: short while asleep, since wake phrases are brief, and the
# configured silence window once awake.
CHUNK_MS = 100
CHUNK_FRAMES = RATE * CHUNK_MS // 1000
ONSET_CHUNKS = 2
PREROLL_SECONDS = 1.0
MIN_UTTERANCE_SECONDS = 0.35
WAKE_GAP_SECONDS = 0.7
WAKE_MAX_SECONDS = 8.0
AWAKE_MAX_SECONDS = 120.0
MIN_ONSET_LEVEL = 200
MIN_RELEASE_LEVEL = 140
NOISE_FLOOR_ALPHA = 0.05

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
    # Common phonetic misrecognitions of "jarvis"
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
    mid-sentence when talking to Jarvis, and one utterance can carry both the
    wake phrase and the real request. Only ignore results that are the bare
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


def request_after_wake(text):
    """What was asked in the same breath as the wake phrase, if anything.

    Whisper hears a whole utterance at once, so "Wake up Jarvis, run the tests"
    arrives as one result. Waking and discarding it would lose the request.
    """
    norm = normalized(text)
    best = None
    for phrase in WAKE_WORDS:
        idx = norm.find(phrase)
        if idx == -1:
            continue
        # Prefer the match that consumes the most of the wake phrase: "wake up"
        # also matches "wake up jarvis", and only the longer one leaves the ask.
        rest = norm[idx + len(phrase):].strip()
        if best is None or len(rest.split()) < len(best.split()):
            best = rest
    return best if best and len(best.split()) >= 2 else ""


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


def has_speech_energy(pcm):
    """Cheap pre-filter: is there sustained voicing worth transcribing?

    Keeps room hiss, key clicks and chair creaks away from Whisper so the
    model only runs on things a person actually said.
    """
    seconds = len(pcm) / (RATE * 2)
    if seconds < 0.3 or len(pcm) % 2:
        return False
    window = RATE // 50 * 2
    levels = [audioop.rms(pcm[i:i + window], 2) for i in range(0, len(pcm) - window + 1, window)]
    peak = max(levels, default=0)
    if peak < 400:
        return False
    threshold = max(180, min(650, int(peak * 0.13)))
    run = sustained = 0
    for level in levels:
        if level >= threshold:
            run += 1
        else:
            if run >= 4:
                sustained += run
            run = 0
    if run >= 4:
        sustained += run
    return sustained / 50 >= 0.15


def listen(cfg, on_audio, stop, playing=None, user_recording=None, muted=None):
    """Listen continuously and transcribe each utterance with Whisper Large V3 Turbo.

    Speech is segmented by energy: an utterance starts on sustained voicing and
    ends after a quiet gap — short while asleep (wake phrases are brief), the
    configured silence window once awake. Only completed utterances reach
    Whisper, and nothing is written to disk until a request is actually sent.
    """
    try:
        import sounddevice as sd
    except ImportError as exc:
        raise RuntimeError("Voice mode needs uv sync --all-extras (sounddevice)") from exc

    from .audio import engine_status, prewarm, transcribe_pcm

    silence_seconds = cfg.voice_silence_seconds
    if not 1 <= silence_seconds <= 30:
        raise ValueError("BRIDGE_VOICE_SILENCE_SECONDS must be between 1 and 30")

    status = engine_status(cfg)
    if not status["ready"]:
        raise RuntimeError(f"Voice mode needs on-device speech recognition: {status['detail']}")
    print(f"[Voice mode] Loading {status['detail']}...")
    prewarm(cfg)

    state = VoiceState()
    q = queue.Queue(maxsize=256)  # ~25s of audio: enough to ride out a long transcription
    preroll = deque(maxlen=int(PREROLL_SECONDS * 1000 / CHUNK_MS))
    utterance = []
    utterance_frames = 0
    voiced_chunks = 0
    quiet_seconds = 0.0
    capturing = False
    noise_floor = 120.0

    max_level_seen = 0
    start_time = time.monotonic()
    checked_mic_level = False
    was_playing = False
    last_buffer_log = 0.0

    def callback(indata, count, timestamp, status_flags):
        if status_flags:
            print(f"[Mic warning] {status_flags}")
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

    def reset(reason=None):
        nonlocal utterance, utterance_frames, voiced_chunks, quiet_seconds, capturing
        if reason and utterance_frames:
            event("capture_drop", reason=reason, dropped_s=round(utterance_frames / RATE, 2))
        preroll.clear()
        utterance, utterance_frames, voiced_chunks, quiet_seconds, capturing = [], 0, 0, 0.0, False
        if user_recording is not None:
            user_recording.clear()
        while not q.empty():
            try:
                q.get_nowait()
            except queue.Empty:
                break

    def finalize(now):
        """Transcribe the buffered utterance and act on what was said."""
        nonlocal utterance, utterance_frames, voiced_chunks, quiet_seconds, capturing
        raw = b"".join(utterance)
        seconds = utterance_frames / RATE
        utterance, utterance_frames, voiced_chunks, quiet_seconds, capturing = [], 0, 0, 0.0, False
        preroll.clear()
        awake = state.awake

        if seconds < MIN_UTTERANCE_SECONDS or not has_speech_energy(raw):
            event("capture_flush", duration_s=round(seconds, 2), recognized_words=0, reason="no_speech")
            if user_recording is not None:
                user_recording.clear()
            return

        try:
            # Asleep, only English wake phrases matter, and auto-detection on a
            # two-word utterance is unreliable; awake, honour the user's setting.
            language = None if awake else (cfg.wake_language or None)
            text = transcribe_pcm(raw, cfg, language=language).strip()
        except Exception as exc:
            event("transcribe_failed", level="warning", reason=str(exc)[:180])
            print(f"[Voice mode] Transcription failed: {exc}")
            if user_recording is not None:
                user_recording.clear()
            return

        event("capture_flush", duration_s=round(seconds, 2), recognized_words=len(text.split()))
        if not text:
            if user_recording is not None:
                user_recording.clear()
            if awake:
                print("[Voice mode] Dropped quiet or unrecognized audio.")
            return

        action = state.accept(text, now)
        if action == "wake":
            play_sound(SoundEvent.VOICE_WAKE)
            print(f"\n[⚡ Jarvis awake] Listening to your request... ({silence_seconds:g}s of quiet sends audio)")
            request = request_after_wake(text)
            if request:
                # Woken and asked in one breath: send the request rather than
                # making the user repeat it.
                clip = prepare_clip(raw, [request])
                if clip is not None:
                    print(f"[Capturing] \"{request}\"")
                    if user_recording is not None:
                        user_recording.set()
                    on_audio(clip, request)
                    return
        elif action == "sleep_prompt":
            if user_recording is not None:
                user_recording.clear()
            print("\n[Sleep requested] Say 'confirm stand by Jarvis' within 8 seconds; anything else cancels it.")
        elif action == "sleep":
            play_sound(SoundEvent.VOICE_SLEEP)
            if user_recording is not None:
                user_recording.clear()
            print("\n[💤 Jarvis sleeping] Listening for 'Wakeup Jarvis' or 'Hey Jarvis'.")
        elif action == "send":
            print(f"[Capturing] \"{text}\"")
            clip = prepare_clip(raw, [text])
            if clip is None:
                if user_recording is not None:
                    user_recording.clear()
                print("[Voice mode] Dropped quiet or unrecognized audio.")
                return
            if user_recording is not None:
                user_recording.set()
            on_audio(clip, text)
        elif not awake:
            print(f"[Mic heard] \"{text}\"")
            if user_recording is not None:
                user_recording.clear()
        else:
            # Awake, but the utterance was only a wake/confirm echo: dropped on
            # purpose, never silently.
            event("capture_drop", reason="wake_echo", dropped_s=round(seconds, 2))
            print(f"[Voice mode] Ignored wake-word echo ({seconds:.1f}s).")
            if user_recording is not None:
                user_recording.clear()

    print("[Voice mode] Default microphone open. Idle audio is not saved. Press F5 to mute/unmute mic. Say 'Wakeup Jarvis'. Esc quits.")
    with sd.RawInputStream(samplerate=RATE, blocksize=CHUNK_FRAMES, dtype="int16", channels=1, callback=callback):
        while not stop.is_set():
            try:
                data = q.get(timeout=0.3)
            except queue.Empty:
                data = b""  # Still observe playback transitions when the callback drops frames.

            now = time.monotonic()

            # Hardware / software mic mute guard:
            if muted is not None and muted.is_set():
                reset()
                continue

            # Echo cancellation / feedback suppression:
            # If WhatsApp is currently playing a voice note, or during echo-tail cooldown:
            if playing is not None and playing.is_set():
                if not was_playing:
                    event("echo_guard", state="playback_started")
                was_playing = True
                reset()
                continue

            if was_playing:
                event("echo_guard", state="playback_finished_queue_flushed")
                was_playing = False
                reset()
                continue

            if not data:
                if data == b"":
                    continue
                reset("mic_overflow")
                print("[Mic overflow] Dropped partial audio; retry the command.")
                continue

            level = audioop.rms(data, 2)
            if level > max_level_seen:
                max_level_seen = level

            # Diagnostic check for mic input permissions after a few seconds
            if not checked_mic_level and now - start_time > 4.0:
                checked_mic_level = True
                if max_level_seen < 30:
                    print("\n[Mic warning] Audio level near 0. If you are speaking, ensure Terminal has Microphone permission:")
                    print("  → macOS System Settings > Privacy & Security > Microphone > Enable Terminal/Python\n")

            # Thresholds track the room: a quiet office and a noisy cafe both work.
            onset = max(MIN_ONSET_LEVEL, int(noise_floor * 3.0))
            release = max(MIN_RELEASE_LEVEL, int(noise_floor * 2.0))
            chunk_seconds = len(data) / 2 / RATE

            if not capturing:
                if level < onset:
                    noise_floor += (level - noise_floor) * NOISE_FLOOR_ALPHA
                    voiced_chunks = 0
                else:
                    voiced_chunks += 1
                preroll.append(data)
                if voiced_chunks >= ONSET_CHUNKS:
                    capturing = True
                    utterance = list(preroll)
                    utterance_frames = sum(len(chunk) // 2 for chunk in utterance)
                    quiet_seconds = 0.0
                    preroll.clear()
                    if state.awake:
                        play_sound(SoundEvent.RECORDING_START)
                        if user_recording is not None:
                            user_recording.set()
                continue

            utterance.append(data)
            utterance_frames += len(data) // 2
            if level >= release:
                quiet_seconds = 0.0
            else:
                quiet_seconds += chunk_seconds

            if now - last_buffer_log >= 1.0:
                last_buffer_log = now
                event("capture_buffer", phrase_s=round(utterance_frames / RATE, 2),
                      clip_s=round(utterance_frames / RATE, 2), audio_level=level)

            gap = silence_seconds if state.awake else WAKE_GAP_SECONDS
            cap = AWAKE_MAX_SECONDS if state.awake else WAKE_MAX_SECONDS
            if quiet_seconds >= gap or utterance_frames / RATE >= cap:
                event("capture_silence", trailing_s=round(quiet_seconds, 2),
                      clip_s=round(utterance_frames / RATE, 2), final_words=0)
                finalize(now)
