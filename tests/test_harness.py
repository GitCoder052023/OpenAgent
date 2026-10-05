import pytest
from pathlib import Path
from OpenAgent.harness import Harness, OpenCodeHarness, HarnessError


def test_harness_system_info():
    with Harness() as h:
        info = h.system_info()
        assert info["platform"] == "darwin"
        assert "user" in info
        assert "cwd" in info


def test_harness_bash_command():
    with Harness() as h:
        res = h.bash("echo 'harness_ok'")
        assert res["exit_code"] == 0
        assert "harness_ok" in res["output"]
        assert not res["timed_out"]


def test_harness_read_file():
    with Harness() as h:
        res = h.read("pyproject.toml", offset=1, limit=2)
        assert res["type"] == "file"
        assert res["offset"] == 1
        assert res["limit"] == 2
        assert "[build-system]" in res["content"]


def test_harness_write_and_edit_cycle(tmp_path: Path):
    test_file = tmp_path / "test_cycle.txt"
    with Harness() as h:
        # 1. Write
        w_res = h.write(str(test_file), "Alpha Beta Gamma\nLine 2")
        assert w_res["status"] == "written"
        assert test_file.exists()

        # 2. Edit
        e_res = h.edit(str(test_file), "Beta", "OpenAgent")
        assert e_res["replacements"] == 1
        assert "diff" in e_res

        # 3. Read back
        r_res = h.read(str(test_file))
        assert "Alpha OpenAgent Gamma" in r_res["content"]


def test_harness_edit_missing_target_fails(tmp_path: Path):
    test_file = tmp_path / "test_fail.txt"
    test_file.write_text("Hello World")
    with Harness() as h:
        with pytest.raises(HarnessError, match="not found in file"):
            h.edit(str(test_file), "NonExistentString", "Replacement")


def test_harness_grep():
    with Harness() as h:
        res = h.grep("class Harness", path="src/OpenAgent/harness.py")
        assert res["total_matches"] >= 1
        assert any("class Harness" in m["text"] for m in res["matches"])


def test_harness_grep_invalid_regex_raises():
    with Harness() as h:
        with pytest.raises(HarnessError, match="Invalid regex pattern"):
            h.grep("[unclosed_bracket", path="src/OpenAgent/harness.py")


def test_harness_glob_matches():
    with Harness() as h:
        res = h.glob("*.toml")
        assert "matches" in res
        assert any("pyproject.toml" in m for m in res["matches"])


def test_harness_glob_empty_regression():
    # Regression test for bug where non-matching glob returned ['.']
    with Harness() as h:
        res = h.glob("non_existent_file_pattern_12345_*")
        assert res["matches"] == []


def test_harness_read_fuzzy_suggestion():
    with Harness() as h:
        with pytest.raises(HarnessError, match="Did you mean one of these"):
            # pyproject.tom typo
            h.read("pyproject.tom")


def test_harness_instructions():
    with Harness() as h:
        res = h.instructions()
        assert "instructions" in res
        assert "count" in res


def test_harness_system_prompt():
    with Harness() as h:
        res = h.system_prompt(model="claude-3-5-sonnet", agent="build")
        assert "system_prompt" in res
        assert len(res["system_prompt"]) > 100
        assert "agent" in res
        assert res["agent"]["name"] == "build"
        assert "build" in res["available_agents"]


def test_harness_applescript_multiline():
    multiline = """
    set a to 15
    set b to 27
    return a + b
    """
    with Harness() as h:
        res = h.applescript(multiline)
        assert res == "42"


def test_harness_read_binary_rejected(tmp_path: Path):
    bin_file = tmp_path / "audio.m4a"
    bin_file.write_bytes(b"\x00\x00\x00\x20ftypM4A ")
    with Harness() as h:
        with pytest.raises(HarnessError, match="Cannot read binary file"):
            h.read(str(bin_file))


def test_harness_edit_empty_old_string_rejected(tmp_path: Path):
    test_file = tmp_path / "empty_old.txt"
    test_file.write_text("sample content")
    with Harness() as h:
        with pytest.raises(HarnessError, match="oldString cannot be empty"):
            h.edit(str(test_file), "", "replacement")


def test_harness_grep_nonexistent_path_rejected():
    with Harness() as h:
        with pytest.raises(HarnessError, match="Path does not exist"):
            h.grep("pattern", path="non_existent_folder_xyz123")


def test_harness_glob_nonexistent_path_rejected():
    with Harness() as h:
        with pytest.raises(HarnessError, match="Path must be an existing directory"):
            h.glob("*.py", path="non_existent_folder_xyz123")


def test_opencode_harness_backward_compatibility():
    assert OpenCodeHarness is Harness
    with OpenCodeHarness() as h:
        info = h.system_info()
        assert info["platform"] == "darwin"
