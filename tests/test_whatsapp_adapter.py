"""Unit tests for the native WhatsApp MCP Extended Adapter and Dispatcher integration."""

import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path

from OpenAgent.whatsapp_adapter import WhatsAppAdapter, WhatsAppError
from OpenAgent.dispatcher import execute_tool_call, parse_tool_calls


class TestWhatsAppAdapter(unittest.TestCase):
    def setUp(self):
        self.adapter = WhatsAppAdapter(
            api_url="http://127.0.0.1:8180",
            allowlist_jids="1234567890@s.whatsapp.net,0987654321@s.whatsapp.net",
        )

    def test_jid_normalization(self):
        self.assertEqual(self.adapter._normalize_jid("+16508702892"), "16508702892@s.whatsapp.net")
        self.assertEqual(self.adapter._normalize_jid("1203630123456789@g.us"), "1203630123456789@g.us")
        self.assertEqual(self.adapter._normalize_jid("919876543210@s.whatsapp.net"), "919876543210@s.whatsapp.net")

    def test_allowlist_enforcement(self):
        # Allowed recipient
        self.adapter._check_allowlist("1234567890@s.whatsapp.net")

        # Disallowed recipient should raise WhatsAppError
        with self.assertRaises(WhatsAppError):
            self.adapter._check_allowlist("5555555555@s.whatsapp.net")

    @patch.object(WhatsAppAdapter, "_request")
    def test_send_message(self, mock_request):
        mock_request.return_value = {
            "success": True,
            "message_id": "MSG123",
            "timestamp": 1700000000,
        }
        res = self.adapter.send_message(recipient="1234567890", message="Hello from Jarvis!")
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["message_id"], "MSG123")
        mock_request.assert_called_once()

    @patch.object(WhatsAppAdapter, "_request")
    def test_send_reaction(self, mock_request):
        mock_request.return_value = {"success": True}
        res = self.adapter.send_reaction(
            chat_jid="1234567890@s.whatsapp.net",
            message_id="MSG123",
            emoji="🚀",
        )
        self.assertEqual(res["status"], "ok")
        mock_request.assert_called_with(
            "reaction",
            method="POST",
            data={"chat_jid": "1234567890@s.whatsapp.net", "message_id": "MSG123", "reaction": "🚀"},
        )

    @patch.object(WhatsAppAdapter, "_request")
    def test_create_poll(self, mock_request):
        mock_request.return_value = {"success": True}
        res = self.adapter.create_poll(
            chat_jid="1234567890@s.whatsapp.net",
            question="Deploy now?",
            options=["Yes", "No"],
        )
        self.assertEqual(res["status"], "ok")
        mock_request.assert_called_once()

    def test_status_when_offline(self):
        # Pointing to an inactive port should return error gracefully without raising
        bad_adapter = WhatsAppAdapter(api_url="http://127.0.0.1:59999")
        st = bad_adapter.status()
        self.assertEqual(st["status"], "error")
        self.assertFalse(st["online"])


class TestWhatsAppDispatcher(unittest.TestCase):
    def test_parse_tool_call_whatsapp(self):
        call_json = '```json\n{"tool": "whatsapp_send", "args": {"recipient": "+16508702892", "message": "Test"}}\n```'
        calls = parse_tool_calls(call_json)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["tool"], "whatsapp_send")

    def test_dispatch_whatsapp_send(self):
        mock_adapter = MagicMock()
        mock_adapter.send_message.return_value = {"status": "ok", "message_id": "M1"}

        call = {
            "tool": "whatsapp_send",
            "args": {"recipient": "+16508702892", "message": "Hello Jarvis"},
        }
        res = execute_tool_call(None, call, whatsapp_adapter=mock_adapter)
        self.assertEqual(res["status"], "ok")
        mock_adapter.send_message.assert_called_once_with(
            recipient="+16508702892",
            message="Hello Jarvis",
            quoted_message_id=None,
            mentioned_jids=None,
        )

    def test_dispatch_whatsapp_read(self):
        mock_adapter = MagicMock()
        mock_adapter.list_messages.return_value = {"status": "ok", "messages": [{"id": "1", "content": "hi"}]}

        call = {
            "tool": "whatsapp_read",
            "args": {"query": "deployment", "limit": 10},
        }
        res = execute_tool_call(None, call, whatsapp_adapter=mock_adapter)
        self.assertEqual(res["status"], "ok")
        mock_adapter.list_messages.assert_called_once_with(
            chat_jid=None,
            query="deployment",
            limit=10,
            sender=None,
        )


if __name__ == "__main__":
    unittest.main()
