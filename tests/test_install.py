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
    (models_dir / "ggml-base.bin").write_text("mock")
    (models_dir / "vosk-model-small-en-us-0.15").mkdir()

    with patch.object(install, "ROOT_DIR", fake_root):
        ok = install.download_models(all_models=True)
        assert ok is True
