"""Unit tests for OpenAgent Audit Logger."""
import tempfile
from pathlib import Path
from OpenAgent.audit import log_event, get_recent_events, set_audit_dir


def test_audit_log_and_read():
    with tempfile.TemporaryDirectory() as tmpdir:
        set_audit_dir(Path(tmpdir))
        log_event(
            event_type="tool_execution",
            tool="word_write",
            session_id="test_session",
            arguments_length=120,
            outcome="ok",
            duration_ms=45.2,
            effect="allow",
        )
        log_event(
            event_type="tool_execution",
            tool="bash",
            session_id="test_session",
            arguments_length=50,
            outcome="denied",
            duration_ms=0.0,
            effect="deny",
            rule="deny_root_wipe",
        )

        events = get_recent_events(limit=10)
        assert len(events) == 2
        # Most recent first
        assert events[0]["tool"] == "bash"
        assert events[0]["effect"] == "deny"
        assert events[1]["tool"] == "word_write"
        assert events[1]["outcome"] == "ok"
