"""Experience & Mistake Notebook ('错题本') Engine for OpenAgent.

Modeled after openagent/object/experience.go.
Captures human corrections, user feedback, and derived positive/negative rules.
Injected into tool execution environments and WhatsApp prompts so Commercial Instinct
never repeats previously corrected mistakes.

Categories:
- Fact: Factual corrections (answers or outputs that were incorrect)
- Style: Tone, wording, or response format preferences
- Format: Tables, layout, document structures
- Scope: Boundaries of what the agent should or should not touch
"""

import json
import logging
import os
import re
import threading
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("openagent.experience")

CATEGORY_FACT = "Fact"
CATEGORY_STYLE = "Style"
CATEGORY_FORMAT = "Format"
CATEGORY_SCOPE = "Scope"


@dataclass
class Experience:
    id: str
    question: str
    wrong_action: str
    correction: str
    rule: str
    category: str = CATEGORY_FACT
    created_at: str = ""
    state: str = "Active"


class ExperienceEngine:
    """Stores, searches, and injects user corrections and learned rules."""

    def __init__(self, store_file: Optional[Path] = None):
        self._lock = threading.Lock()
        self._store_file = store_file or self._resolve_store_file()
        self._experiences: Dict[str, Experience] = {}
        self._load()

    def _resolve_store_file(self) -> Path:
        local_dir = Path.cwd() / ".openagent" / "experience"
        if local_dir.parent.exists():
            path = local_dir / "experiences.jsonl"
        else:
            path = Path.home() / ".openagent" / "experience" / "experiences.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def _load(self) -> None:
        if not self._store_file.exists():
            return
        try:
            with open(self._store_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        exp = Experience(**data)
                        self._experiences[exp.id] = exp
                    except Exception:
                        continue
        except Exception as exc:
            logger.warning("Could not load experiences from %s: %s", self._store_file, exc)

    def _save_append(self, exp: Experience) -> None:
        try:
            with open(self._store_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(asdict(exp), ensure_ascii=False) + "\n")
        except Exception as exc:
            logger.warning("Failed to append experience: %s", exc)

    def _rewrite_all(self) -> None:
        try:
            with open(self._store_file, "w", encoding="utf-8") as f:
                for exp in self._experiences.values():
                    f.write(json.dumps(asdict(exp), ensure_ascii=False) + "\n")
        except Exception as exc:
            logger.warning("Failed to rewrite experiences: %s", exc)

    def record(
        self,
        question: str,
        wrong_action: str,
        correction: str,
        rule: str,
        category: str = CATEGORY_FACT,
    ) -> Experience:
        """Record a human correction and derived rule."""
        with self._lock:
            exp_id = f"exp_{int(time.time() * 1000)}"
            ts = datetime.now(timezone.utc).isoformat()
            exp = Experience(
                id=exp_id,
                question=question.strip(),
                wrong_action=wrong_action.strip(),
                correction=correction.strip(),
                rule=rule.strip(),
                category=category,
                created_at=ts,
                state="Active",
            )
            self._experiences[exp_id] = exp
            self._save_append(exp)
            return exp

    def list_all(self, category: Optional[str] = None, only_active: bool = True) -> List[Experience]:
        with self._lock:
            res = list(self._experiences.values())
            if only_active:
                res = [e for e in res if e.state == "Active"]
            if category:
                res = [e for e in res if e.category.lower() == category.lower()]
            return res

    def search(self, query: str, limit: int = 5) -> List[Experience]:
        """Search experiences based on keyword overlap with question, wrong_action, or rule."""
        if not query:
            return self.list_all()[:limit]

        tokens = set(re.findall(r"\w+", query.lower()))
        if not tokens:
            return self.list_all()[:limit]

        scored: List[Tuple[int, Experience]] = []
        with self._lock:
            for exp in self._experiences.values():
                if exp.state != "Active":
                    continue
                corpus = f"{exp.question} {exp.wrong_action} {exp.correction} {exp.rule}".lower()
                corpus_tokens = set(re.findall(r"\w+", corpus))
                overlap = len(tokens.intersection(corpus_tokens))
                if overlap > 0:
                    scored.append((overlap, exp))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:limit]]

    def get_active_rules(self, context_query: str = "") -> List[str]:
        """Return active derived rules, prioritizing those matching the current context query."""
        if context_query:
            matched = self.search(context_query, limit=5)
            if matched:
                return [m.rule for m in matched if m.rule]

        # Fallback to the latest active rules
        all_active = self.list_all(only_active=True)
        return [e.rule for e in all_active[-5:] if e.rule]

    def archive(self, exp_id: str) -> bool:
        with self._lock:
            if exp_id in self._experiences:
                self._experiences[exp_id].state = "Archived"
                self._rewrite_all()
                return True
        return False


_GLOBAL_EXPERIENCE: Optional[ExperienceEngine] = None


def get_default_experience() -> ExperienceEngine:
    global _GLOBAL_EXPERIENCE
    if _GLOBAL_EXPERIENCE is None:
        _GLOBAL_EXPERIENCE = ExperienceEngine()
    return _GLOBAL_EXPERIENCE
