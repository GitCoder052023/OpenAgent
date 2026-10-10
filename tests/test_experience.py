"""Unit tests for OpenAgent Experience & Mistake Notebook Engine."""
import tempfile
from pathlib import Path
from OpenAgent.experience import (
    ExperienceEngine,
    CATEGORY_FACT,
    CATEGORY_STYLE,
    CATEGORY_SCOPE,
)


def test_experience_record_and_search():
    with tempfile.TemporaryDirectory() as tmpdir:
        store_path = Path(tmpdir) / "experiences.jsonl"
        engine = ExperienceEngine(store_file=store_path)

        exp = engine.record(
            question="Please deploy the website",
            wrong_action="Ran npm run deploy instead of bun",
            correction="Always use bun to build and deploy",
            rule="Never invoke npm directly; always use bun for project builds",
            category=CATEGORY_FACT,
        )

        assert exp.id.startswith("exp_")
        assert exp.state == "Active"

        # Search matching query
        results = engine.search("bun deploy")
        assert len(results) > 0
        assert results[0].id == exp.id
        assert "bun" in results[0].rule

        # Check active rules
        rules = engine.get_active_rules("deploy website")
        assert len(rules) > 0
        assert "bun" in rules[0]


def test_experience_archive():
    with tempfile.TemporaryDirectory() as tmpdir:
        store_path = Path(tmpdir) / "experiences.jsonl"
        engine = ExperienceEngine(store_file=store_path)

        exp = engine.record(
            question="Tone test",
            wrong_action="Apologized repeatedly",
            correction="Be direct and concise",
            rule="Never apologize, state facts directly",
            category=CATEGORY_STYLE,
        )

        assert len(engine.list_all(only_active=True)) == 1
        assert engine.archive(exp.id) is True
        assert len(engine.list_all(only_active=True)) == 0
        assert len(engine.list_all(only_active=False)) == 1
