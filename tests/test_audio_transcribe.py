"""On-device Whisper Large V3 Turbo transcription: engine choice and dispatch."""
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from OpenAgent import audio
from OpenAgent.config import Config


def test_defaults_are_large_v3_turbo():
    cfg = Config()
    assert cfg.whisper_repo == "mlx-community/whisper-large-v3-turbo"
    assert cfg.model == "models/ggml-large-v3-turbo.bin"
    assert cfg.stt_engine == "auto"


def test_auto_prefers_mlx_when_available():
    cfg = Config(stt_engine="auto")
    with patch.object(audio, "mlx_available", return_value=True):
        assert audio.select_engine(cfg) == "mlx"
    with patch.object(audio, "mlx_available", return_value=False):
        assert audio.select_engine(cfg) == "whisper.cpp"


@pytest.mark.parametrize("value,expected", [
    ("mlx", "mlx"),
    ("mlx-whisper", "mlx"),
    ("whisper.cpp", "whisper.cpp"),
    ("whisper-cpp", "whisper.cpp"),
    ("ggml", "whisper.cpp"),
])
def test_explicit_engine_overrides_detection(value, expected):
    # An explicit choice is honoured even when the other engine is present.
    with patch.object(audio, "mlx_available", return_value=expected != "mlx"):
        assert audio.select_engine(Config(stt_engine=value)) == expected


def test_config_normalizes_engine_aliases(monkeypatch):
    monkeypatch.setenv("BRIDGE_STT_ENGINE", "WHISPER-CPP")
    assert Config.from_env().stt_engine == "whisper.cpp"
    monkeypatch.setenv("BRIDGE_STT_ENGINE", "nonsense")
    assert Config.from_env().stt_engine == "auto"


def test_mlx_unavailable_off_apple_silicon():
    with patch.object(audio.platform, "machine", return_value="x86_64"):
        assert audio.mlx_available() is False


def test_transcribe_uses_mlx_with_configured_repo(monkeypatch):
    fake = types.ModuleType("mlx_whisper")
    fake.transcribe = MagicMock(return_value={"text": "  run the test suite  ", "language": "en"})
    monkeypatch.setitem(sys.modules, "mlx_whisper", fake)

    cfg = Config(stt_engine="mlx", whisper_repo="mlx-community/whisper-large-v3-turbo", language="auto")
    assert audio.transcribe("/tmp/clip.wav", cfg) == "run the test suite"
    fake.transcribe.assert_called_once_with(
        "/tmp/clip.wav", path_or_hf_repo="mlx-community/whisper-large-v3-turbo", language=None
    )


def test_mlx_passes_explicit_language(monkeypatch):
    fake = types.ModuleType("mlx_whisper")
    fake.transcribe = MagicMock(return_value={"text": "hola"})
    monkeypatch.setitem(sys.modules, "mlx_whisper", fake)

    audio.transcribe("/tmp/clip.wav", Config(stt_engine="mlx", language="es"))
    assert fake.transcribe.call_args.kwargs["language"] == "es"


def test_whisper_cpp_builds_command_and_strips_banner(tmp_path: Path):
    model = tmp_path / "ggml-large-v3-turbo.bin"
    model.write_text("dummy")
    cfg = Config(stt_engine="whisper.cpp", model=str(model), language="en")
    completed = MagicMock(stdout="whisper_init: loading model\nsystem_info: METAL = 1\nrun the test suite\n")

    with patch("subprocess.run", return_value=completed) as run:
        assert audio.transcribe(tmp_path / "clip.wav", cfg) == "run the test suite"
    cmd = run.call_args[0][0]
    assert cmd[:3] == ["whisper-cli", "-m", str(model)]
    assert cmd[-3:] == ["-nt", "-l", "en"]


def test_whisper_cpp_reports_missing_model(tmp_path: Path):
    cfg = Config(stt_engine="whisper.cpp", model=str(tmp_path / "absent.bin"))
    with pytest.raises(RuntimeError, match="download-model.sh large-v3-turbo"):
        audio.transcribe(tmp_path / "clip.wav", cfg)


def test_relative_model_path_resolves_against_repo():
    resolved = audio.resolve_model_path("models/ggml-large-v3-turbo.bin")
    assert resolved.is_absolute()
    assert resolved.parent.name == "models"


def test_engine_status_mlx_ready():
    cfg = Config(stt_engine="mlx")
    with patch.object(audio, "mlx_available", return_value=True):
        status = audio.engine_status(cfg)
    assert status["ready"] is True
    assert status["engine"] == "mlx"
    assert status["model"] == "mlx-community/whisper-large-v3-turbo"


def test_engine_status_mlx_missing_package_is_not_ready():
    with patch.object(audio, "mlx_available", return_value=False):
        status = audio.engine_status(Config(stt_engine="mlx"))
    assert status["ready"] is False
    assert "mlx-whisper is not installed" in status["detail"]


def test_engine_status_whisper_cpp_flags_missing_model(tmp_path: Path):
    cfg = Config(stt_engine="whisper.cpp", model=str(tmp_path / "absent.bin"))
    with patch.object(audio, "_which", return_value="/opt/homebrew/bin/whisper-cli"):
        status = audio.engine_status(cfg)
    assert status["ready"] is False
    assert "model file missing" in status["detail"]


def test_engine_status_whisper_cpp_flags_missing_binary(tmp_path: Path):
    model = tmp_path / "ggml-large-v3-turbo.bin"
    model.write_text("dummy")
    cfg = Config(stt_engine="whisper.cpp", model=str(model))
    with patch.object(audio, "_which", return_value=None):
        status = audio.engine_status(cfg)
    assert status["ready"] is False
    assert "not found on PATH" in status["detail"]


def test_prewarm_is_a_noop_for_whisper_cpp():
    assert audio.prewarm(Config(stt_engine="whisper.cpp")) is False


def test_prewarm_swallows_load_failures(monkeypatch):
    fake = types.ModuleType("mlx_whisper.load_models")
    fake.load_model = MagicMock(side_effect=OSError("no weights"))
    monkeypatch.setitem(sys.modules, "mlx_whisper.load_models", fake)
    with patch.object(audio, "mlx_available", return_value=True):
        assert audio.prewarm(Config(stt_engine="mlx")) is False
