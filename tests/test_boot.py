import os
import signal
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest
import boot


def test_setup_path():
    with patch.dict(os.environ, {"PATH": "/usr/bin:/bin"}):
        boot.setup_path()
        assert "/opt/homebrew/bin" in os.environ["PATH"] or "/usr/local/bin" in os.environ["PATH"]


def test_is_in_project_env():
    with patch.dict(os.environ, {"_OPENAGENT_BOOTSTRAPPED": "1"}):
        assert boot.is_in_project_env() is True

    with patch.dict(os.environ, {"_OPENAGENT_BOOTSTRAPPED": ""}):
        with patch.object(boot, "ROOT_DIR", Path("/fake/root")):
            assert boot.is_in_project_env() is False


def test_parse_args_defaults():
    with patch.object(sys, "argv", ["boot.py"]):
        args, extra = boot.parse_args()
        assert args.command == "run"
        assert args.voice is False
        assert args.send_mode is None
        assert args.unlocked is False
        assert args.doctor is False
        assert args.once is False


def test_parse_args_subcommands():
    with patch.object(sys, "argv", ["boot.py", "inspect"]):
        args, extra = boot.parse_args()
        assert args.command == "inspect"

    with patch.object(sys, "argv", ["boot.py", "speak", "--text", "hello world"]):
        args, extra = boot.parse_args()
        assert args.command == "speak"
        assert args.text == "hello world"


def test_parse_args_custom():
    with patch.object(sys, "argv", [
        "boot.py", "--voice", "--send-mode", "text", "--unlocked",
        "--hotkey", "f6", "--doctor", "--once", "--start-firecrawl", "--start-chrome"
    ]):
        args, extra = boot.parse_args()
        assert args.voice is True
        assert args.send_mode == "text"
        assert args.unlocked is True
        assert args.hotkey == "f6"
        assert args.doctor is True
        assert args.once is True
        assert args.start_firecrawl is True
        assert args.start_chrome is True


def test_ensure_config(tmp_path: Path):
    fake_root = tmp_path / "repo"
    fake_root.mkdir()
    env_example = fake_root / ".env.example"
    env_example.write_text("BRIDGE_TEST_KEY=12345\n")

    with patch.object(boot, "ROOT_DIR", fake_root):
        env_file = boot.ensure_config()
        assert env_file.exists()
        assert (fake_root / ".env").exists()
        assert "BRIDGE_TEST_KEY=12345" in (fake_root / ".env").read_text()


def test_ensure_models(tmp_path: Path):
    fake_root = tmp_path / "repo"
    fake_root.mkdir()
    models_dir = fake_root / "models"
    models_dir.mkdir()
    whisper_file = models_dir / "ggml-base.bin"
    whisper_file.write_text("dummy")

    with patch.object(boot, "ROOT_DIR", fake_root):
        ok = boot.ensure_models(send_mode="audio", voice_mode=False)
        assert ok is True


def test_manage_whatsapp_running():
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        assert boot.manage_whatsapp(launch=False, hide=True) is True


def test_manage_whatsapp_not_running_launch_success():
    call_count = 0

    def mock_run_side_effect(cmd, **kwargs):
        nonlocal call_count
        call_count += 1
        if "pgrep" in cmd:
            # First check fails (not running), second check succeeds (running after launch)
            if call_count <= 1:
                return MagicMock(returncode=1)
            return MagicMock(returncode=0)
        return MagicMock(returncode=0)

    with patch("subprocess.run", side_effect=mock_run_side_effect):
        with patch("time.sleep"):
            assert boot.manage_whatsapp(launch=True, hide=True) is True


def test_manage_firecrawl_online():
    with patch("boot.manage_firecrawl") as mock_fc:
        mock_fc.return_value = "online"
        assert boot.manage_firecrawl() == "online"


def test_manage_chrome_cdp():
    with patch("boot.manage_chrome_cdp") as mock_cdp:
        mock_cdp.return_value = "online"
        assert boot.manage_chrome_cdp() == "online"


def test_manage_social_media():
    with patch("boot.manage_social_media") as mock_social:
        mock_social.return_value = {"threads": True, "reddit": True}
        res = boot.manage_social_media()
        assert res.get("threads") is True
        assert res.get("reddit") is True


def test_setup_locoagent_harness(tmp_path: Path):
    fake_root = tmp_path / "repo"
    fake_loco = fake_root / "src" / "tools" / "locoagent"
    fake_loco.mkdir(parents=True)
    pkg = fake_loco / "package.json"
    pkg.write_text('{"name": "locoagent"}')
    node_modules = fake_loco / "node_modules"
    node_modules.mkdir()

    with patch.object(boot, "ROOT_DIR", fake_root):
        with patch("shutil.which", return_value="/opt/homebrew/bin/bun"):
            ok = boot.setup_locoagent_harness()
            assert ok is True


def test_supervisor_signal_handling():
    supervisor = boot.AutonomousSupervisor(["--unlocked"])
    mock_child = MagicMock()
    mock_child.poll.return_value = None
    supervisor.child_proc = mock_child

    with pytest.raises(SystemExit):
        supervisor.handle_signal(signal.SIGINT, None)

    assert supervisor.running is False
    mock_child.send_signal.assert_called_with(signal.SIGINT)

