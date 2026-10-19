"""Local recording, encoding and on-device Whisper Large V3 Turbo transcription.

Transcription never leaves the Mac. Two engines serve the same model:

* ``mlx``         - mlx-whisper running ``mlx-community/whisper-large-v3-turbo``
                    on the Apple Silicon GPU. Default when importable.
* ``whisper.cpp`` - ``whisper-cli`` with a ``ggml-large-v3-turbo`` model file.
                    Portable fallback, no Python ML stack required.

``BRIDGE_STT_ENGINE`` (auto|mlx|whisper.cpp) picks one; ``auto`` prefers mlx.
"""
import importlib.util
import os
import platform
import subprocess
import sys
import threading
from pathlib import Path

RATE = 16000
DEFAULT_REPO = "mlx-community/whisper-large-v3-turbo"
DEFAULT_GGML_MODEL = "models/ggml-large-v3-turbo.bin"

MLX_INSTALL_HINT = (
    "mlx-whisper is not installed. Run `uv sync --all-extras` "
    "(Apple Silicon only; the dependency is platform-gated)."
)

_prewarm_lock = threading.Lock()


def repo_root():
    here = Path(__file__).resolve()
    return here.parents[2] if len(here.parents) > 2 and here.parents[1].name == "src" else here.parents[1]


def resolve_model_path(value):
    """Absolute path for a ggml model, resolved against the repo when relative."""
    model_path = Path(value).expanduser()
    if not model_path.is_absolute():
        model_path = repo_root() / model_path
    return model_path


def mlx_available():
    """True when mlx-whisper can run here (Apple Silicon with the package present)."""
    if sys.platform != "darwin" or platform.machine() != "arm64":
        return False
    return importlib.util.find_spec("mlx_whisper") is not None


def whisper_repo(cfg):
    return (getattr(cfg, "whisper_repo", "") or DEFAULT_REPO).strip()


def select_engine(cfg):
    """Resolve the configured engine to the one that will actually run."""
    engine = (getattr(cfg, "stt_engine", "auto") or "auto").strip().lower()
    if engine in ("mlx", "mlx-whisper"):
        return "mlx"
    if engine in ("whisper.cpp", "whisper-cpp", "cpp", "ggml", "cli"):
        return "whisper.cpp"
    return "mlx" if mlx_available() else "whisper.cpp"


def engine_status(cfg):
    """Describe the active speech-to-text engine for banners and `--doctor`."""
    engine = select_engine(cfg)
    if engine == "mlx":
        ready = mlx_available()
        return {
            "engine": "mlx",
            "model": whisper_repo(cfg),
            "ready": ready,
            "detail": "Whisper Large V3 Turbo on Apple Silicon GPU (mlx-whisper)"
            if ready else MLX_INSTALL_HINT,
        }
    model_path = resolve_model_path(cfg.model)
    cli = _which(cfg.whisper_cli)
    ready = bool(cli) and model_path.is_file()
    if not cli:
        detail = f"{cfg.whisper_cli} not found on PATH (brew install whisper-cpp)"
    elif not model_path.is_file():
        detail = f"model file missing: {model_path} (bash scripts/download-model.sh large-v3-turbo)"
    else:
        detail = f"Whisper Large V3 Turbo via whisper.cpp ({model_path.name})"
    return {"engine": "whisper.cpp", "model": str(model_path), "ready": ready, "detail": detail}


def _which(binary):
    from shutil import which
    return which(binary) if binary else None


def prewarm(cfg):
    """Load Whisper weights ahead of the first request so transcription is instant.

    Safe to call from a daemon thread; failures are reported, never raised.
    """
    if select_engine(cfg) != "mlx":
        return False
    with _prewarm_lock:
        try:
            from mlx_whisper.load_models import load_model
            load_model(whisper_repo(cfg))
            return True
        except Exception:
            return False


def transcribe(path, cfg):
    """Transcribe a local audio file to text with Whisper Large V3 Turbo."""
    if select_engine(cfg) == "mlx":
        return _transcribe_mlx(str(path), cfg)
    return _transcribe_whisper_cpp(path, cfg)


def transcribe_pcm(pcm, cfg, language=None):
    """Transcribe raw 16 kHz mono 16-bit PCM without touching the disk.

    The live microphone path uses this for every utterance, including the
    wake phrase, so recorded speech is never written out before it is needed.
    `language` overrides the configured one — the wake listener pins English,
    because auto-detection on a two-word phrase picks the wrong language often
    enough to swallow wake words.
    """
    if not pcm:
        return ""
    if select_engine(cfg) == "mlx":
        import numpy as np
        samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
        return _transcribe_mlx(samples, cfg, language=language)

    import tempfile
    import wave
    fd, name = tempfile.mkstemp(suffix=".wav", prefix="openagent-stt-")
    os.close(fd)
    clip = Path(name)
    try:
        with wave.open(str(clip), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(RATE)
            wav.writeframes(pcm)
        return _transcribe_whisper_cpp(clip, cfg, language=language)
    finally:
        clip.unlink(missing_ok=True)


def _transcribe_mlx(source, cfg, language=None):
    """`source` is a file path or a float32 waveform at 16 kHz."""
    try:
        import mlx_whisper
    except ImportError as exc:
        raise RuntimeError(MLX_INSTALL_HINT) from exc
    language = _language(cfg, language)
    result = mlx_whisper.transcribe(source, path_or_hf_repo=whisper_repo(cfg), language=language)
    return (result.get("text") or "").strip()


def _language(cfg, override=None):
    """Resolve the language to decode in; None means let Whisper detect it."""
    language = (override or cfg.language or "auto").strip().lower()
    return None if language == "auto" else language


def _transcribe_whisper_cpp(path, cfg, language=None):
    model_path = resolve_model_path(cfg.model)
    if not model_path.is_file():
        raise RuntimeError(
            f"Whisper model missing: {model_path}. Run `bash scripts/download-model.sh large-v3-turbo`."
        )
    cmd = [cfg.whisper_cli, "-m", str(model_path), "-f", str(path), "-nt"]
    language = _language(cfg, language)
    if language: cmd += ["-l", language]
    out = subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=300).stdout
    # whisper-cli often prefixes timestamps; -nt requests no timestamps.
    lines = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        if any(line.startswith(p) for p in ("whisper_", "system_info:", "main:", "[BLAS]", "AVX", "NEON", "metal :")):
            continue
        lines.append(line)
    return " ".join(lines).strip()


def speak(text, voice=None):
    if not text.strip(): return
    cmd = ["say"] + (["-v", voice] if voice else []) + [text[:1200]]
    subprocess.run(cmd, check=True, timeout=90)


def start_recording(path, cfg):
    # SoX rec from default mic. No background streaming; kill on key release.
    return subprocess.Popen([cfg.recorder, "-q", "-c", "1", "-r", "16000", "-b", "16", str(path), "trim", "0", str(cfg.max_record_seconds)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)



def encode_attachment(wav_path):
    """Encode recorded WAV as small AAC/M4A; caller removes both temp files."""
    target = Path(wav_path).with_suffix(".m4a")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path),
                    "-ac", "1", "-c:a", "aac", "-b:a", "64k", str(target)],
                   check=True)
    if not target.is_file() or target.stat().st_size < 1000:
        raise RuntimeError("Audio encoding failed")
    return target
