"""Native WhatsApp MCP Extended Protocol Adapter for OpenAgent.

Enables commercial/local intelligence (Jarvis / Instinct) to interact with
WhatsApp natively and headlessly at the protocol level (via Go whatsmeow
and FastMCP in src/tools/whatsapp-mcp).

Capabilities:
- Send messages, documents, media files, and native voice notes
- Read chat history, search past messages, and extract message context
- Search contacts, list chats, and retrieve CRM relationship context
- React to messages, edit sent messages, and revoke/delete messages
- Manage groups (create, add/remove members, promote/demote, change subject)
- Create interactive polls and track results
- Set presence status (online, offline, typing, recording)
- Inspect connection status and QR pairing health
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger("openagent.whatsapp_adapter")


class WhatsAppError(Exception):
    """Raised when a WhatsApp MCP operation fails."""
    pass


class WhatsAppAdapter:
    """High-level native adapter wrapping WhatsApp MCP Extended for OpenAgent."""

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: Optional[float] = None,
        allowlist_jids: Optional[Union[str, List[str]]] = None,
        store_path: Optional[Union[str, Path]] = None,
    ):
        raw_url = (api_url or os.getenv("WHATSAPP_MCP_API_URL") or os.getenv("WHATSAPP_API_URL") or "http://localhost:8180").rstrip("/")
        # Store root base_url without trailing /api (all REST endpoints use /api/ via _request)
        self.base_url = raw_url[:-4] if raw_url.endswith("/api") else raw_url
        self.root_url = self.base_url
        self.api_key = api_key if api_key is not None else os.getenv("WHATSAPP_MCP_API_KEY", os.getenv("API_KEY", ""))
        self.timeout = float(timeout or os.getenv("WHATSAPP_MCP_TIMEOUT", 30.0))

        # Safety allowlist
        raw_allowlist = allowlist_jids or os.getenv("WHATSAPP_ALLOWLIST_JIDS") or os.getenv("WHATSAPP_MCP_ALLOWLIST_JIDS", "")
        if isinstance(raw_allowlist, str):
            self.allowlist: List[str] = [j.strip() for j in raw_allowlist.split(",") if j.strip()]
        else:
            self.allowlist = list(raw_allowlist)

        # Store path resolution (for direct fast SQLite read queries if available)
        self.store_path = self._resolve_store_path(store_path)

    def _resolve_store_path(self, override: Optional[Union[str, Path]] = None) -> Optional[Path]:
        if override:
            p = Path(override)
            if p.exists():
                return p
        env_p = os.getenv("WA_STORE_PATH")
        if env_p and Path(env_p).exists():
            return Path(env_p)

        # Standard repository locations inside src/tools/whatsapp-mcp
        repo_root = Path(__file__).resolve().parents[2]
        candidates = [
            repo_root / "src" / "tools" / "whatsapp-mcp" / "store",
            repo_root / "src" / "tools" / "whatsapp-mcp" / "whatsapp-bridge" / "store",
            Path.home() / ".whatsapp-mcp" / "store",
        ]
        for c in candidates:
            if c.exists():
                return c
        return None

    def _check_allowlist(self, recipient: str) -> None:
        """Enforce safety allowlist if configured."""
        if not self.allowlist:
            return
        cleaned = recipient.strip().lower()
        # Check against raw phone number and full JID
        phone_part = cleaned.split("@")[0]
        for allowed in self.allowlist:
            a_clean = allowed.strip().lower()
            a_phone = a_clean.split("@")[0]
            if cleaned == a_clean or phone_part == a_phone or cleaned.startswith(a_clean):
                return
        raise WhatsAppError(
            f"Safety Gate: Recipient '{recipient}' is not in the WHATSAPP_ALLOWLIST_JIDS allowlist."
        )

    def _normalize_jid(self, recipient: str) -> str:
        """Format phone number or username into standard WhatsApp JID."""
        cleaned = recipient.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if cleaned.endswith("@s.whatsapp.net") or cleaned.endswith("@g.us") or cleaned.endswith("@newsletter"):
            return cleaned
        if cleaned.startswith("+"):
            cleaned = cleaned[1:]
        # Default to individual user JID
        return f"{cleaned}@s.whatsapp.net"

    def _request(
        self,
        endpoint: str,
        method: str = "GET",
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        clean_ep = endpoint.lstrip("/")
        if not clean_ep.startswith("api/"):
            clean_ep = f"api/{clean_ep}"
        url = f"{self.base_url.rstrip('/')}/{clean_ep}"
        if params:
            query_str = urllib.parse.urlencode({k: str(v) for k, v in params.items() if v is not None})
            url = f"{url}?{query_str}"

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key
            headers["Authorization"] = f"Bearer {self.api_key}"

        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)

        t = timeout or self.timeout
        try:
            with urllib.request.urlopen(req, timeout=t) as resp:
                raw_bytes = resp.read()
                if not raw_bytes:
                    return {"success": True, "status": "ok"}
                try:
                    return json.loads(raw_bytes.decode("utf-8"))
                except json.JSONDecodeError:
                    return {"success": True, "data": raw_bytes.decode("utf-8")}
        except urllib.error.HTTPError as exc:
            # Special handling: /api/health returns HTTP 503 when daemon is alive but awaiting QR/phone pairing
            if clean_ep == "api/health":
                try:
                    err_data = json.loads(exc.read().decode("utf-8"))
                    if isinstance(err_data, dict) and ("needs_pairing" in err_data or "connected" in err_data):
                        return err_data
                except Exception:
                    pass
            err_msg = f"HTTP {exc.code} on {method} {url}"
            try:
                err_data = json.loads(exc.read().decode("utf-8"))
                err_msg = err_data.get("error") or err_data.get("message") or str(err_data)
            except Exception:
                pass
            raise WhatsAppError(f"WhatsApp Bridge error: {err_msg}") from exc
        except urllib.error.URLError as exc:
            raise WhatsAppError(
                f"Could not connect to WhatsApp Bridge at {self.base_url}. "
                f"Ensure the bridge container or daemon is running. Error: {exc.reason}"
            ) from exc
        except Exception as exc:
            raise WhatsAppError(f"Unexpected error communicating with WhatsApp Bridge: {exc}") from exc

    # --------------------------------------------------------------------------
    # Health & Diagnostics
    # --------------------------------------------------------------------------
    def status(self) -> Dict[str, Any]:
        """Probes the bridge health and connection status."""
        try:
            res = self._request("health", method="GET", timeout=4.0)
            is_online = bool(
                res.get("status") in ("ok", "healthy")
                or res.get("success", False)
                or "connected" in res
                or "needs_pairing" in res
            )
            needs_pairing = bool(res.get("needs_pairing", False))
            connected = bool(res.get("connected", False))
            return {
                "status": "ok" if (is_online and not needs_pairing) else ("needs_pairing" if needs_pairing else "degraded"),
                "bridge_url": self.base_url,
                "online": is_online,
                "connected": connected,
                "needs_pairing": needs_pairing,
                "health": res,
                "store_available": bool(self.store_path and (self.store_path / "messages.db").exists()),
            }
        except Exception as exc:
            return {
                "status": "error",
                "bridge_url": self.base_url,
                "online": False,
                "connected": False,
                "needs_pairing": False,
                "error": str(exc),
                "store_available": bool(self.store_path and (self.store_path / "messages.db").exists()),
            }

    # --------------------------------------------------------------------------
    # Messaging
    # --------------------------------------------------------------------------
    def send_message(
        self,
        recipient: str,
        message: str,
        quoted_message_id: Optional[str] = None,
        mentioned_jids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Send a standard text message to a contact or group."""
        jid = self._normalize_jid(recipient)
        self._check_allowlist(jid)

        payload: Dict[str, Any] = {
            "recipient": jid,
            "message": message,
        }
        if quoted_message_id:
            payload["quoted_message_id"] = quoted_message_id
        if mentioned_jids:
            payload["mentioned_jids"] = mentioned_jids

        res = self._request("send", method="POST", data=payload)
        return {
            "status": "ok" if res.get("success", True) else "error",
            "recipient": jid,
            "message_id": res.get("message_id"),
            "timestamp": res.get("timestamp"),
            "result": res,
        }

    def send_file(
        self,
        recipient: str,
        file_path: Union[str, Path],
        caption: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a document, image, or video file to a contact or group."""
        jid = self._normalize_jid(recipient)
        self._check_allowlist(jid)

        p = Path(file_path).resolve()
        if not p.exists():
            raise FileNotFoundError(f"File to send not found: {p}")

        payload: Dict[str, Any] = {
            "recipient": jid,
            "media_path": str(p),
            "message": caption or "",
        }

        res = self._request("send", method="POST", data=payload)
        return {
            "status": "ok" if res.get("success", True) else "error",
            "recipient": jid,
            "file": str(p),
            "message_id": res.get("message_id"),
            "result": res,
        }

    def send_audio(
        self,
        recipient: str,
        audio_path: Union[str, Path],
    ) -> Dict[str, Any]:
        """Send an audio recording or native voice note to a contact or group."""
        return self.send_file(recipient=recipient, file_path=audio_path, caption=None)

    def send_reaction(
        self,
        chat_jid: str,
        message_id: str,
        emoji: str,
    ) -> Dict[str, Any]:
        """Send an emoji reaction to a specific message."""
        jid = self._normalize_jid(chat_jid)
        payload = {
            "chat_jid": jid,
            "message_id": message_id,
            "reaction": emoji,
        }
        res = self._request("reaction", method="POST", data=payload)
        return {"status": "ok" if res.get("success", True) else "error", "result": res}

    def edit_message(
        self,
        chat_jid: str,
        message_id: str,
        new_text: str,
    ) -> Dict[str, Any]:
        """Edit a previously sent message."""
        jid = self._normalize_jid(chat_jid)
        payload = {
            "chat_jid": jid,
            "message_id": message_id,
            "new_message": new_text,
        }
        res = self._request("edit", method="POST", data=payload)
        return {"status": "ok" if res.get("success", True) else "error", "result": res}

    def delete_message(
        self,
        chat_jid: str,
        message_id: str,
        sender_jid: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Revoke / delete a message for everyone in the chat."""
        jid = self._normalize_jid(chat_jid)
        payload = {
            "chat_jid": jid,
            "message_id": message_id,
        }
        if sender_jid:
            payload["sender_jid"] = self._normalize_jid(sender_jid)
        res = self._request("delete", method="POST", data=payload)
        return {"status": "ok" if res.get("success", True) else "error", "result": res}

    def mark_read(
        self,
        chat_jid: str,
        message_ids: List[str],
        receipt_type: str = "read",
    ) -> Dict[str, Any]:
        """Mark messages as read (blue ticks) or played for voice notes."""
        jid = self._normalize_jid(chat_jid)
        payload = {
            "chat_jid": jid,
            "message_ids": message_ids,
            "receipt_type": receipt_type,
        }
        res = self._request("read", method="POST", data=payload)
        return {"status": "ok" if res.get("success", True) else "error", "result": res}

    # --------------------------------------------------------------------------
    # Chats & Message History
    # --------------------------------------------------------------------------
    def list_chats(self, limit: int = 40) -> Dict[str, Any]:
        """List active WhatsApp chats."""
        # 1. Try SQLite direct read if store is present (instantaneous)
        chats = self._sqlite_list_chats(limit=limit)
        if chats is not None:
            return {"status": "ok", "chats": chats, "total": len(chats)}

        # 2. Fall back to HTTP
        res = self._request("chats", method="GET", params={"limit": limit})
        chats_data = res.get("data") if isinstance(res, dict) and "data" in res else res
        return {"status": "ok", "chats": chats_data, "total": len(chats_data) if isinstance(chats_data, list) else 0}

    def list_messages(
        self,
        chat_jid: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 25,
        sender: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search or retrieve messages from a chat or across all chats."""
        target_jid = self._normalize_jid(chat_jid) if chat_jid else None

        # 1. Try SQLite direct search (supports fast full-text match across all chats)
        local_res = self._sqlite_list_messages(chat_jid=target_jid, query=query, limit=limit, sender=sender)
        if local_res is not None:
            return {"status": "ok", "messages": local_res, "total": len(local_res)}

        # 2. Fall back to HTTP bridge
        params: Dict[str, Any] = {"limit": limit}
        if target_jid:
            params["chat_jid"] = target_jid
        if query:
            params["query"] = query

        res = self._request("messages", method="GET", params=params)
        messages_data = res.get("data") if isinstance(res, dict) and "data" in res else res
        return {"status": "ok", "messages": messages_data, "total": len(messages_data) if isinstance(messages_data, list) else 0}

    def get_message_context(
        self,
        chat_jid: str,
        message_id: str,
        before: int = 5,
        after: int = 5,
    ) -> Dict[str, Any]:
        """Get surrounding messages around a specific message ID."""
        jid = self._normalize_jid(chat_jid)
        all_msgs = self.list_messages(chat_jid=jid, limit=100).get("messages", [])
        if not isinstance(all_msgs, list):
            return {"status": "ok", "messages": []}

        target_idx = None
        for i, m in enumerate(all_msgs):
            if str(m.get("id")) == str(message_id):
                target_idx = i
                break

        if target_idx is None:
            return {"status": "ok", "target_found": False, "messages": all_msgs[:before + after + 1]}

        start_idx = max(0, target_idx - before)
        end_idx = min(len(all_msgs), target_idx + after + 1)
        return {
            "status": "ok",
            "target_found": True,
            "target_id": message_id,
            "messages": all_msgs[start_idx:end_idx],
        }

    # --------------------------------------------------------------------------
    # Contacts
    # --------------------------------------------------------------------------
    def search_contacts(self, query: str) -> Dict[str, Any]:
        """Search address book by name or phone number."""
        q = query.strip().lower()
        # Direct SQLite contact search
        contacts = self._sqlite_search_contacts(q)
        if contacts is not None:
            return {"status": "ok", "contacts": contacts, "total": len(contacts)}

        # Or search chats
        chats = self.list_chats(limit=100).get("chats", [])
        matched = []
        if isinstance(chats, list):
            for c in chats:
                name = str(c.get("name") or c.get("chat_name") or "").lower()
                jid = str(c.get("jid") or c.get("chat_jid") or "").lower()
                if q in name or q in jid:
                    matched.append(c)
        return {"status": "ok", "contacts": matched, "total": len(matched)}

    def get_contact_context(self, contact_jid_or_phone: str) -> Dict[str, Any]:
        """Retrieve complete historical context and recent interactions with a contact."""
        jid = self._normalize_jid(contact_jid_or_phone)
        recent_messages = self.list_messages(chat_jid=jid, limit=15).get("messages", [])
        return {
            "status": "ok",
            "contact_jid": jid,
            "recent_messages": recent_messages,
            "message_count": len(recent_messages),
        }

    # --------------------------------------------------------------------------
    # Groups & Polls
    # --------------------------------------------------------------------------
    def get_group_info(self, group_jid: str) -> Dict[str, Any]:
        """Get group metadata, subject, topic, and participant list."""
        jid = self._normalize_jid(group_jid)
        res = self._request(f"group/{jid}", method="GET")
        return {"status": "ok" if res.get("success", True) else "error", "group": res}

    def manage_group(
        self,
        action: str,
        group_jid: Optional[str] = None,
        participants: Optional[List[str]] = None,
        name: Optional[str] = None,
        topic: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Perform administrative group operations."""
        action = action.strip().lower()
        data: Dict[str, Any] = {}

        if group_jid:
            data["group_jid"] = self._normalize_jid(group_jid)
        if participants:
            data["participants"] = [self._normalize_jid(p) for p in participants]
        if name:
            data["name"] = name
        if topic:
            data["topic"] = topic

        endpoint_map = {
            "create": "group/create",
            "add_members": "group/add-members",
            "remove_members": "group/remove-members",
            "promote_admin": "group/promote",
            "demote_admin": "group/demote",
            "leave": "group/leave",
            "update": "group/update",
        }
        endpoint = endpoint_map.get(action)
        if not endpoint:
            raise ValueError(f"Unknown group action '{action}'. Valid actions: {list(endpoint_map.keys())}")

        res = self._request(endpoint, method="POST", data=data)
        return {"status": "ok" if res.get("success", True) else "error", "action": action, "result": res}

    def create_poll(
        self,
        chat_jid: str,
        question: str,
        options: List[str],
        max_answers: int = 1,
    ) -> Dict[str, Any]:
        """Create an interactive poll in a chat or group."""
        jid = self._normalize_jid(chat_jid)
        payload = {
            "chat_jid": jid,
            "question": question,
            "options": options,
            "max_answers": max_answers,
        }
        res = self._request("poll/create", method="POST", data=payload)
        return {"status": "ok" if res.get("success", True) else "error", "result": res}

    def set_presence(self, status: str = "available") -> Dict[str, Any]:
        """Set WhatsApp presence (available, unavailable, typing, recording)."""
        payload = {"status": status}
        res = self._request("presence/set", method="POST", data=payload)
        return {"status": "ok" if res.get("success", True) else "error", "result": res}

    # --------------------------------------------------------------------------
    # Direct SQLite Accelerated Helpers
    # --------------------------------------------------------------------------
    def _sqlite_list_chats(self, limit: int = 50) -> Optional[List[Dict[str, Any]]]:
        if not self.store_path:
            return None
        db_path = self.store_path / "messages.db"
        if not db_path.exists():
            return None

        try:
            conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            query = """
                SELECT jid, name, last_message_timestamp, unread_count
                FROM chats
                ORDER BY last_message_timestamp DESC
                LIMIT ?
            """
            cur.execute(query, (limit,))
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return rows
        except Exception as exc:
            logger.debug("SQLite chat query bypass: %s", exc)
            return None

    def _sqlite_list_messages(
        self,
        chat_jid: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 25,
        sender: Optional[str] = None,
    ) -> Optional[List[Dict[str, Any]]]:
        if not self.store_path:
            return None
        db_path = self.store_path / "messages.db"
        if not db_path.exists():
            return None

        try:
            conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()

            clauses = []
            params: List[Any] = []
            if chat_jid:
                clauses.append("chat_jid = ?")
                params.append(chat_jid)
            if query:
                clauses.append("content LIKE ?")
                params.append(f"%{query}%")
            if sender:
                clauses.append("sender = ?")
                params.append(sender)

            where_str = f"WHERE {' AND '.join(clauses)}" if clauses else ""
            sql = f"""
                SELECT id, chat_jid, sender, content, timestamp, is_from_me, media_type
                FROM messages
                {where_str}
                ORDER BY timestamp DESC
                LIMIT ?
            """
            params.append(limit)
            cur.execute(sql, tuple(params))
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return rows
        except Exception as exc:
            logger.debug("SQLite message query bypass: %s", exc)
            return None

    def _sqlite_search_contacts(self, query: str) -> Optional[List[Dict[str, Any]]]:
        if not self.store_path:
            return None
        db_path = self.store_path / "messages.db"
        if not db_path.exists():
            return None

        try:
            conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute(
                """
                SELECT jid, name, phone_number
                FROM contacts
                WHERE name LIKE ? OR phone_number LIKE ? OR jid LIKE ?
                LIMIT 20
                """,
                (f"%{query}%", f"%{query}%", f"%{query}%"),
            )
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return rows
        except Exception:
            return None


_DEFAULT_WHATSAPP_ADAPTER: Optional[WhatsAppAdapter] = None


def get_default_whatsapp_adapter() -> WhatsAppAdapter:
    """Singleton getter for default WhatsAppAdapter."""
    global _DEFAULT_WHATSAPP_ADAPTER
    if _DEFAULT_WHATSAPP_ADAPTER is None:
        _DEFAULT_WHATSAPP_ADAPTER = WhatsAppAdapter()
    return _DEFAULT_WHATSAPP_ADAPTER
