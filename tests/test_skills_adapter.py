"""Unit tests for OpenAgent Skills Adapter."""
from OpenAgent.skills_adapter import SkillsAdapter, SKILL_CATALOG


def test_skills_catalog_listing():
    adapter = SkillsAdapter()
    skills = adapter.list_skills()
    assert len(skills) >= 10
    names = [s["skill"] for s in skills]
    assert "apple_reminders" in names
    assert "imsg" in names
    assert "things_mac" in names
    assert "spotify" in names
    assert "1password" in names
    assert "apple_notes" in names


def test_missing_skill_cli_graceful_install_hint():
    adapter = SkillsAdapter()
    # Call reminders with a guaranteed non-existent binary fallback check
    res = adapter.reminders(action="list")
    assert "status" in res
    if res["status"] == "error":
        assert "remindctl" in res["error"] or "install" in res.get("install_hint", "").lower()


def test_apple_notes_interface():
    adapter = SkillsAdapter()
    # Ensure apple_notes returns a valid response dictionary
    res = adapter.apple_notes(action="list")
    assert "status" in res
    assert "error" in res or "output" in res or "stdout" in res
