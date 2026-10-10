"""Fine-grained tool authorization and safety guard engine for OpenAgent.

Modeled after openagent/guard and openagent/object/tool_policy.go.
Protects the local Mac from risky or destructive tool calls initiated by
Commercial Instinct over WhatsApp or local agents.

Supports:
- Three effects: ALLOW, ASK, DENY
- Capability categories: read, write, exec, network, sensitive
- Glob-style pattern matching on tools and security-relevant resources
- WhatsApp/Voice approval workflow: generates short confirmation tokens
"""

import fnmatch
import json
import logging
import os
import random
import re
import string
import threading
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("openagent.guard")

EFFECT_ALLOW = "allow"
EFFECT_ASK = "ask"
EFFECT_DENY = "deny"

CATEGORY_READ = "read"
CATEGORY_WRITE = "write"
CATEGORY_EXEC = "exec"
CATEGORY_NETWORK = "network"
CATEGORY_SENSITIVE = "sensitive"
CATEGORY_UNKNOWN = "unknown"

TOOL_CATEGORIES = {
    # Exec
    "bash": CATEGORY_EXEC,
    "mac_python": CATEGORY_EXEC,
    "mac_script": CATEGORY_EXEC,
    "browser_eval": CATEGORY_EXEC,
    "browser_js": CATEGORY_EXEC,
    "browser_python": CATEGORY_EXEC,
    "applescript": CATEGORY_EXEC,
    "tmux": CATEGORY_EXEC,
    # Read
    "read": CATEGORY_READ,
    "grep": CATEGORY_READ,
    "glob": CATEGORY_READ,
    "browser_info": CATEGORY_READ,
    "browser_see": CATEGORY_READ,
    "browser_screenshot": CATEGORY_READ,
    "mac_see": CATEGORY_READ,
    "mac_apps": CATEGORY_READ,
    "mac_windows": CATEGORY_READ,
    "mac_ax": CATEGORY_READ,
    "system_info": CATEGORY_READ,
    "word_read": CATEGORY_READ,
    "excel_read": CATEGORY_READ,
    "pptx_read": CATEGORY_READ,
    # Write
    "write": CATEGORY_WRITE,
    "edit": CATEGORY_WRITE,
    "word_write": CATEGORY_WRITE,
    "excel_write": CATEGORY_WRITE,
    "pptx_write": CATEGORY_WRITE,
    "pptx_template_fill": CATEGORY_WRITE,
    # Sensitive
    "1password": CATEGORY_SENSITIVE,
    "op": CATEGORY_SENSITIVE,
    # Network / messaging
    "firecrawl_scrape": CATEGORY_NETWORK,
    "firecrawl_search": CATEGORY_NETWORK,
    "firecrawl_crawl": CATEGORY_NETWORK,
    "browser_open": CATEGORY_NETWORK,
    "browser_goto": CATEGORY_NETWORK,
    "social_post": CATEGORY_NETWORK,
    "social_reply": CATEGORY_NETWORK,
    "wacli_send": CATEGORY_NETWORK,
    "imsg": CATEGORY_NETWORK,
}


@dataclass
class PolicyRule:
    name: str
    tool: str = "*"
    resource: str = "*"
    category: str = "*"
    subject: str = "*"
    effect: str = EFFECT_ALLOW  # "allow", "ask", "deny"
    priority: int = 100
    state: str = "Active"
    reason: str = ""


@dataclass
class EvaluationResult:
    effect: str
    rule_name: str
    resource: str
    category: str
    reason: str = ""
    token: Optional[str] = None
    message: str = ""


@dataclass
class PendingAction:
    token: str
    tool: str
    args: Dict[str, Any]
    subject: str
    resource: str
    rule_name: str
    created_at: float
    expires_at: float


# Default built-in security policies protecting Mac user space
DEFAULT_RULES: List[PolicyRule] = [
    # Deny direct access to SSH private keys & sensitive credentials
    PolicyRule(
        name="deny_ssh_keys",
        tool="*",
        resource="*id_rsa*|*id_ed25519*|*id_ecdsa*|*/.ssh/*",
        category="*",
        effect=EFFECT_DENY,
        priority=1000,
        reason="Access to SSH private keys or credentials is strictly prohibited by security guard.",
    ),
    PolicyRule(
        name="deny_etc_shadow",
        tool="*",
        resource="*/etc/shadow*|*/etc/master.passwd*",
        category="*",
        effect=EFFECT_DENY,
        priority=1000,
        reason="System shadow password files are protected.",
    ),
    # Deny catastrophic file wipe commands (root / home)
    PolicyRule(
        name="deny_root_wipe",
        tool="bash",
        resource="rm -rf /|rm -rf / *|rm -fr /|rm -fr / *|*rm -rf / --*|rm -rf ~|rm -rf ~/*",
        category=CATEGORY_EXEC,
        effect=EFFECT_DENY,
        priority=990,
        reason="Catastrophic recursive deletion commands are blocked.",
    ),
    # Ask confirmation for git destructive actions
    PolicyRule(
        name="ask_git_force_push",
        tool="bash",
        resource="*git push*--force*|*git push*-f *",
        category=CATEGORY_EXEC,
        effect=EFFECT_ASK,
        priority=800,
        reason="Force-pushing git branches can overwrite remote work. Confirmation required.",
    ),
    # Ask confirmation for deleting entire directories
    PolicyRule(
        name="ask_rm_rf",
        tool="bash",
        resource="*rm -rf *|*rm -r *|*rmdir *",
        category=CATEGORY_EXEC,
        effect=EFFECT_ASK,
        priority=750,
        reason="Recursive deletion requires user confirmation.",
    ),
    # Ask confirmation for system power / kernel actions
    PolicyRule(
        name="ask_system_power",
        tool="bash",
        resource="*shutdown *|*reboot*|*halt*|*sudo *",
        category=CATEGORY_EXEC,
        effect=EFFECT_ASK,
        priority=850,
        reason="Privileged or system power actions require explicit confirmation.",
    ),
    # Ask confirmation for broadcasting mass messages
    PolicyRule(
        name="ask_social_post",
        tool="social_post",
        resource="*",
        category=CATEGORY_NETWORK,
        effect=EFFECT_ALLOW,  # Allowed by default for OpenAgent social autonomy, but can be set to ask
        priority=100,
        reason="Social media post",
    ),
]


class GuardEngine:
    """Manages policy rules, evaluates tool requests, and maintains confirmation queues."""

    def __init__(self, policy_file: Optional[Path] = None):
        self._lock = threading.Lock()
        self._rules: List[PolicyRule] = list(DEFAULT_RULES)
        self._pending_approvals: Dict[str, PendingAction] = {}
        self._policy_file = policy_file or self._resolve_policy_file()
        self._load_custom_policies()

    def _resolve_policy_file(self) -> Path:
        local_path = Path.cwd() / ".openagent" / "policies.json"
        if local_path.parent.exists():
            return local_path
        user_path = Path.home() / ".openagent" / "policies.json"
        user_path.parent.mkdir(parents=True, exist_ok=True)
        return user_path

    def _load_custom_policies(self) -> None:
        if not self._policy_file.exists():
            return
        try:
            with open(self._policy_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("name"):
                        rule = PolicyRule(
                            name=str(item.get("name")),
                            tool=str(item.get("tool", "*")),
                            resource=str(item.get("resource", "*")),
                            category=str(item.get("category", "*")),
                            subject=str(item.get("subject", "*")),
                            effect=str(item.get("effect", EFFECT_ALLOW)).lower(),
                            priority=int(item.get("priority", 100)),
                            state=str(item.get("state", "Active")),
                            reason=str(item.get("reason", "")),
                        )
                        self._rules.append(rule)
            # Sort descending by priority
            self._rules.sort(key=lambda r: r.priority, reverse=True)
        except Exception as exc:
            logger.warning("Failed to load custom policies from %s: %s", self._policy_file, exc)

    def extract_resource(self, tool: str, args: Dict[str, Any]) -> str:
        """Extract the most security-critical argument as the resource representation."""
        tool = tool.lower()
        if tool == "bash":
            return str(args.get("command") or "").strip()
        elif tool in ("read", "write", "edit", "grep", "glob"):
            return str(args.get("path") or args.get("file") or "").strip()
        elif tool in ("word_read", "word_write", "excel_read", "excel_write", "pptx_read", "pptx_write"):
            return str(args.get("path") or args.get("file_path") or "").strip()
        elif tool in ("browser_open", "browser_goto", "firecrawl_scrape", "firecrawl_crawl"):
            return str(args.get("url") or args.get("link") or "").strip()
        elif tool in ("social_post", "social_reply"):
            return f"{args.get('platform', 'unknown')}: {args.get('text', '')[:40]}"
        elif tool in ("wacli_send", "imsg"):
            return f"to:{args.get('to', '')}"
        elif tool in ("mac_python", "mac_script"):
            return str(args.get("code") or args.get("script") or "")[:120].strip()
        return str(args.get("target") or args.get("name") or "")

    def get_category(self, tool: str) -> str:
        return TOOL_CATEGORIES.get(tool.lower(), CATEGORY_UNKNOWN)

    def _matches_pattern(self, pattern: str, value: str) -> bool:
        if pattern in ("*", ""):
            return True
        sub_patterns = pattern.split("|")
        for sub in sub_patterns:
            sub = sub.strip()
            if fnmatch.fnmatch(value.lower(), sub.lower()):
                return True
        return False

    def evaluate(self, tool: str, args: Dict[str, Any], subject: str = "instinct") -> EvaluationResult:
        """Evaluate a tool invocation against active policies."""
        tool = tool.strip().lower()
        resource = self.extract_resource(tool, args)
        category = self.get_category(tool)

        with self._lock:
            for rule in self._rules:
                if rule.state != "Active":
                    continue
                if not self._matches_pattern(rule.subject, subject):
                    continue
                if not self._matches_pattern(rule.tool, tool):
                    continue
                if not self._matches_pattern(rule.category, category):
                    continue
                if not self._matches_pattern(rule.resource, resource):
                    continue

                # Match found!
                effect = rule.effect.lower()
                if effect == EFFECT_DENY:
                    msg = (
                        f"⛔ [SAFETY GUARD BLOCKED] Action blocked by rule '{rule.name}'. "
                        f"Resource '{resource}' is restricted. Reason: {rule.reason or 'Security policy violation'}"
                    )
                    return EvaluationResult(
                        effect=EFFECT_DENY,
                        rule_name=rule.name,
                        resource=resource,
                        category=category,
                        reason=rule.reason,
                        message=msg,
                    )

                elif effect == EFFECT_ASK:
                    token = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
                    pending = PendingAction(
                        token=token,
                        tool=tool,
                        args=args,
                        subject=subject,
                        resource=resource,
                        rule_name=rule.name,
                        created_at=time.time(),
                        expires_at=time.time() + 300.0,  # 5 minutes validity
                    )
                    self._pending_approvals[token] = pending
                    msg = (
                        f"⚠️ [SAFETY GUARD CONFIRMATION NEEDED]\n"
                        f"Instinct requested high-impact action: [{tool}]\n"
                        f"Resource: {resource}\n"
                        f"Reason: {rule.reason or 'Rule requires user approval'}\n"
                        f"To execute, reply 'CONFIRM {token}' (or 'CONFIRM'). To abort, reply 'CANCEL'."
                    )
                    return EvaluationResult(
                        effect=EFFECT_ASK,
                        rule_name=rule.name,
                        resource=resource,
                        category=category,
                        reason=rule.reason,
                        token=token,
                        message=msg,
                    )

                elif effect == EFFECT_ALLOW:
                    return EvaluationResult(
                        effect=EFFECT_ALLOW,
                        rule_name=rule.name,
                        resource=resource,
                        category=category,
                        reason=rule.reason,
                        message="Approved",
                    )

        # Default fallback is allow
        return EvaluationResult(
            effect=EFFECT_ALLOW,
            rule_name="default_allow",
            resource=resource,
            category=category,
            message="Approved by default",
        )

    def approve_pending(self, token_or_keyword: str) -> Optional[PendingAction]:
        """Approve a pending action by its 4-character token or accept the most recent if bare 'confirm'."""
        with self._lock:
            # Clean expired actions
            now = time.time()
            self._pending_approvals = {k: v for k, v in self._pending_approvals.items() if v.expires_at > now}

            token_cleaned = token_or_keyword.strip().upper()
            if token_cleaned in self._pending_approvals:
                return self._pending_approvals.pop(token_cleaned)

            # If user sent bare 'confirm' or 'yes', grab the latest pending action if there's only one
            if token_cleaned in ("CONFIRM", "YES", "APPROVE", "OK") and len(self._pending_approvals) == 1:
                single_key = next(iter(self._pending_approvals))
                return self._pending_approvals.pop(single_key)

        return None

    def cancel_pending(self, token_or_keyword: Optional[str]) -> bool:
        """Cancel a pending action."""
        if not token_or_keyword:
            return False
        with self._lock:
            token_cleaned = str(token_or_keyword).strip().upper()
            if token_cleaned in self._pending_approvals:
                del self._pending_approvals[token_cleaned]
                return True
            if token_cleaned in ("CANCEL", "ABORT", "DENY", "NO"):
                self._pending_approvals.clear()
                return True
        return False

    def list_rules(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [asdict(r) for r in self._rules]


_GLOBAL_GUARD: Optional[GuardEngine] = None


def get_default_guard() -> GuardEngine:
    global _GLOBAL_GUARD
    if _GLOBAL_GUARD is None:
        _GLOBAL_GUARD = GuardEngine()
    return _GLOBAL_GUARD
