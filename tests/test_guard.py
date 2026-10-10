"""Unit tests for OpenAgent Safety Guard Engine."""
import tempfile
from pathlib import Path
from OpenAgent.guard import (
    GuardEngine,
    PolicyRule,
    EFFECT_ALLOW,
    EFFECT_ASK,
    EFFECT_DENY,
    CATEGORY_EXEC,
    CATEGORY_READ,
    CATEGORY_SENSITIVE,
)


def test_guard_default_rules_block_ssh():
    guard = GuardEngine(policy_file=Path("/nonexistent/policies.json"))
    res = guard.evaluate("read", {"path": "/Users/user/.ssh/id_rsa"})
    assert res.effect == EFFECT_DENY
    assert "restricted" in res.message.lower() or "blocked" in res.message.lower()


def test_guard_blocks_root_wipe():
    guard = GuardEngine(policy_file=Path("/nonexistent/policies.json"))
    res = guard.evaluate("bash", {"command": "rm -rf /"})
    assert res.effect == EFFECT_DENY
    assert res.rule_name == "deny_root_wipe"


def test_guard_ask_force_push():
    guard = GuardEngine(policy_file=Path("/nonexistent/policies.json"))
    res = guard.evaluate("bash", {"command": "git push origin main --force"})
    assert res.effect == EFFECT_ASK
    assert res.token is not None
    assert len(res.token) == 4
    assert "confirm" in res.message.lower()


def test_guard_approval_flow():
    guard = GuardEngine(policy_file=Path("/nonexistent/policies.json"))
    res = guard.evaluate("bash", {"command": "git push origin main --force"})
    assert res.effect == EFFECT_ASK
    token = res.token

    # Approve with exact token
    pending = guard.approve_pending(token)
    assert pending is not None
    assert pending.tool == "bash"
    assert pending.args["command"] == "git push origin main --force"

    # Subsequent approval with same token should return None
    assert guard.approve_pending(token) is None


def test_guard_bare_confirm_single_action():
    guard = GuardEngine(policy_file=Path("/nonexistent/policies.json"))
    res = guard.evaluate("bash", {"command": "rm -rf /tmp/testdir"})
    assert res.effect == EFFECT_ASK

    pending = guard.approve_pending("confirm")
    assert pending is not None
    assert pending.tool == "bash"


def test_guard_cancel_action():
    guard = GuardEngine(policy_file=Path("/nonexistent/policies.json"))
    res = guard.evaluate("bash", {"command": "rm -rf /tmp/testdir"})
    token = res.token

    assert guard.cancel_pending(token) is True
    assert guard.approve_pending(token) is None


def test_guard_custom_rule():
    guard = GuardEngine(policy_file=Path("/nonexistent/policies.json"))
    custom = PolicyRule(
        name="deny_secret_vault",
        tool="*",
        resource="*secret_vault*",
        effect=EFFECT_DENY,
        priority=2000,
    )
    guard._rules.insert(0, custom)
    res = guard.evaluate("read", {"path": "/tmp/secret_vault/keys.txt"})
    assert res.effect == EFFECT_DENY
    assert res.rule_name == "deny_secret_vault"
