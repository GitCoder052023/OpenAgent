import subprocess
from pathlib import Path


def transcribe(path, cfg):
    model_path = Path(cfg.model).expanduser()
    if not model_path.is_absolute():
        here = Path(__file__).resolve()
        repo_root = here.parents[2] if len(here.parents) > 2 and here.parents[1].name == "src" else here.parents[1]
        model_path = repo_root / model_path
    cmd = [cfg.whisper_cli, "-m", str(model_path), "-f", str(path), "-nt"]
    if cfg.language != "auto": cmd += ["-l", cfg.language]
    out = subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=90).stdout
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

