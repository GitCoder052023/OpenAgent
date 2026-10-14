"""Tests for send_file's base64 input.

The path-only interface could not send a file the *client* holds: MCP clients
generally run on a different machine from this server, so a locally produced
file (a screenshot, say) has no way onto this filesystem. Accepting the bytes
inline fixes that.
"""

import base64
import os

import pytest

import whatsapp

# A real 1x1 PNG, so the magic bytes can be asserted on.
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


@pytest.fixture
def captured_send(monkeypatch, tmp_path):
    """Captures the media_path the bridge would have been asked to send."""
    seen: dict[str, object] = {}

    class FakeResponse:
        status_code = 200

        @staticmethod
        def json():
            return {"success": True, "message_id": "MSG1", "recipient": "123"}

    def fake_post(url, json=None, headers=None, timeout=None):
        seen["media_path"] = json["media_path"]
        # Read it here: the real bridge reads during this call, so this is the
        # only point at which the temp file is guaranteed to still exist.
        with open(json["media_path"], "rb") as f:
            seen["content"] = f.read()
        return FakeResponse()

    monkeypatch.setattr(whatsapp.requests, "post", fake_post)
    return seen


# Mirrors allowedMediaDirs in whatsapp-bridge/internal/whatsapp/messages.go.
# The bridge rejects a media_path outside these, so writing somewhere it will
# not read from fails only at runtime — which is exactly what happened when the
# temp file was first put under the per-user store.
BRIDGE_ALLOWED_DIRS = ("/app/media", "/app/store", "/app/whatsapp-bridge/store", "/tmp")


def test_sends_a_file_given_as_base64(captured_send):
    result = whatsapp.send_file(
        recipient="123",
        file_content_base64=base64.b64encode(PNG_BYTES).decode(),
        filename="screenshot.png",
    )

    assert result["success"] is True
    assert result["message_id"] == "MSG1"
    # The bridge received the real bytes, not a re-encoding.
    assert captured_send["content"] == PNG_BYTES
    # And the name is preserved, since the extension drives how WhatsApp renders it.
    assert str(captured_send["media_path"]).endswith("-screenshot.png")


def test_removes_the_temp_file_afterwards(captured_send):
    whatsapp.send_file(
        recipient="123",
        file_content_base64=base64.b64encode(PNG_BYTES).decode(),
        filename="screenshot.png",
    )

    # Otherwise every send leaks a copy into the media volume.
    assert not os.path.exists(str(captured_send["media_path"]))


def test_rejects_base64_without_a_filename(captured_send):
    result = whatsapp.send_file(
        recipient="123",
        file_content_base64=base64.b64encode(PNG_BYTES).decode(),
    )

    assert result["success"] is False
    assert "filename" in result["error"]


def test_rejects_invalid_base64(captured_send):
    result = whatsapp.send_file(
        recipient="123",
        file_content_base64="not!valid!base64",
        filename="x.png",
    )

    assert result["success"] is False
    assert "base64" in result["error"].lower()


def test_rejects_both_inputs_at_once(captured_send):
    result = whatsapp.send_file(
        recipient="123",
        media_path="/some/path.png",
        file_content_base64=base64.b64encode(PNG_BYTES).decode(),
        filename="x.png",
    )

    assert result["success"] is False
    assert "not both" in result["error"]


def test_rejects_neither_input(captured_send):
    result = whatsapp.send_file(recipient="123")

    assert result["success"] is False
    assert "media_path" in result["error"]


def test_writes_somewhere_the_bridge_will_read_from(captured_send):
    """The bridge validates media_path against an allowlist before reading it."""
    whatsapp.send_file(
        recipient="123",
        file_content_base64=base64.b64encode(PNG_BYTES).decode(),
        filename="screenshot.png",
    )

    written = os.path.realpath(str(captured_send["media_path"]))
    assert any(written.startswith(os.path.realpath(allowed)) for allowed in BRIDGE_ALLOWED_DIRS), (
        f"{written} is outside the bridge's allowed media directories"
    )


def test_a_filename_cannot_escape_the_temp_directory(captured_send):
    whatsapp.send_file(
        recipient="123",
        file_content_base64=base64.b64encode(PNG_BYTES).decode(),
        filename="../../etc/passwd",
    )

    # Only the basename is used, so the write stays put. The bridge separately
    # rejects any path containing "..", so this must not produce one.
    written = str(captured_send["media_path"])
    assert ".." not in written
    assert os.path.dirname(written) == os.path.join(whatsapp.MEDIA_TEMP_DIR, "whatsapp-outgoing")


def test_still_accepts_a_server_side_path(captured_send, tmp_path):
    existing = tmp_path / "already-here.png"
    existing.write_bytes(PNG_BYTES)

    result = whatsapp.send_file(recipient="123", media_path=str(existing))

    assert result["success"] is True
    assert captured_send["media_path"] == str(existing)
    # A caller-owned file must survive the send.
    assert existing.exists()
