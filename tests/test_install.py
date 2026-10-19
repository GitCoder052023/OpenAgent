import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest
import install


def test_setup_path():
    with patch.dict(os.environ, {"PATH": "/usr/bin:/bin"}):
        install.setup_path()
        assert "/opt/homebrew/bin" in os.environ["PATH"] or "/usr/local/bin" in os.environ["PATH"]


def test_setup_config_file(tmp_path: Path):
    fake_root = tmp_path / "repo"
    fake_root.mkdir()
    fake_example = fake_root / ".env.example"
    fake_example.write_text("FOO=BAR\n")

    with patch.object(install, "ROOT_DIR", fake_root):
        env_file = install.setup_config_file()
        assert env_file.exists()
        assert "FOO=BAR" in env_file.read_text()


def test_download_models_existing(tmp_path: Path):
    fake_root = tmp_path / "repo"
    fake_root.mkdir()
    models_dir = fake_root / "models"
    models_dir.mkdir()
    (models_dir / install.GGML_TURBO_MODEL).write_text("mock")

    with patch.object(install, "ROOT_DIR", fake_root), \
            patch.object(install, "mlx_whisper_available", return_value=False):
        ok = install.download_models()
        assert ok is True


def test_download_whisper_turbo_prefetches_mlx_weights(tmp_path: Path):
    fake_root = tmp_path / "repo"
    fake_root.mkdir()
    with patch.object(install, "ROOT_DIR", fake_root), \
            patch.object(install, "mlx_whisper_available", return_value=True), \
            patch("subprocess.run", return_value=MagicMock(returncode=0)) as run:
        assert install.download_whisper_turbo() is True
    assert install.WHISPER_REPO in run.call_args[0][0][-1]
    # mlx weights live in the Hugging Face cache; no ggml file is fetched.
    assert not (fake_root / "models" / install.GGML_TURBO_MODEL).exists()


def test_download_whisper_turbo_falls_back_to_ggml(tmp_path: Path):
    fake_root = tmp_path / "repo"
    (fake_root / "models").mkdir(parents=True)
    (fake_root / "scripts").mkdir()
    (fake_root / "scripts" / "download-model.sh").write_text("#!/bin/sh\n")

    def fake_download(cmd, **kwargs):
        assert cmd[-1] == "large-v3-turbo"
        (fake_root / "models" / install.GGML_TURBO_MODEL).write_text("mock")
        return MagicMock(returncode=0)

    with patch.object(install, "ROOT_DIR", fake_root), \
            patch.object(install, "mlx_whisper_available", return_value=False), \
            patch("urllib.request.urlretrieve", side_effect=AssertionError("must not hit the network")), \
            patch("subprocess.run", side_effect=fake_download):
        assert install.download_whisper_turbo() is True


def test_download_models_can_skip_whisper(tmp_path: Path):
    fake_root = tmp_path / "repo"
    (fake_root / "models").mkdir(parents=True)
    with patch.object(install, "ROOT_DIR", fake_root), \
            patch.object(install, "download_whisper_turbo") as fetch:
        install.download_models(whisper=False)
    fetch.assert_not_called()
