import pytest
from pathlib import Path
from bridge.harness import OpenCodeHarness, HarnessError


def test_harness_system_info():
    with OpenCodeHarness() as h:
        info = h.system_info()
        assert info["platform"] == "darwin"
        assert "user" in info
        assert "cwd" in info


def test_harness_bash_command():
    with OpenCodeHarness() as h:
        res = h.bash("echo 'harness_ok'")
        assert res["exit_code"] == 0
        assert "harness_ok" in res["output"]
        assert not res["timed_out"]


def test_harness_read_file():
    with OpenCodeHarness() as h:
        res = h.read("pyproject.toml", offset=1, limit=2)
        assert res["type"] == "file"
        assert res["offset"] == 1
        assert res["limit"] == 2
        assert "[project]" in res["content"]


def test_harness_write_and_edit_cycle(tmp_path: Path):
    test_file = tmp_path / "test_cycle.txt"
    with OpenCodeHarness() as h:
        # 1. Write
        w_res = h.write(str(test_file), "Alpha Beta Gamma\nLine 2")
        assert w_res["status"] == "written"
        assert test_file.exists()

        # 2. Edit
        e_res = h.edit(str(test_file), "Beta", "Jarvis")
        assert e_res["replacements"] == 1
        assert "diff" in e_res

        # 3. Read back
        r_res = h.read(str(test_file))
        assert "Alpha Jarvis Gamma" in r_res["content"]


def test_harness_edit_missing_target_fails(tmp_path: Path):
    test_file = tmp_path / "test_fail.txt"
    test_file.write_text("Hello World")
    with OpenCodeHarness() as h:
        with pytest.raises(HarnessError, match="not found in file"):
            h.edit(str(test_file), "NonExistentString", "Replacement")


def test_harness_grep():
    with OpenCodeHarness() as h:
        res = h.grep("OpenCodeHarness", path="bridge/harness.py")
        assert res["total_matches"] >= 1
        assert any("class OpenCodeHarness" in m["text"] for m in res["matches"])
