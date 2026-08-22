# blender_mcp_bridge/tools/design_rules.py

"""Design rules exported by print-kb, served as MCP tools.

The rules are read from a self-contained JSON snapshot (`data/design-rules.json`)
written directly by the sibling print-kb project. Nothing here imports print-kb
or touches a database -- if the file is present, these tools work.

See docs/design-rules.md for the file's contract.
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any

from mcp import types

logger = logging.getLogger(__name__)

# Two locations, in priority order:
#   1. <repo>/data/design-rules.json -- print-kb's export target, so a checkout
#      picks up a fresh export without reinstalling anything.
#   2. <package>/data/design-rules.json -- the copy shipped inside the wheel, so
#      `uvx blender-mcp-server` works with no repo checked out at all.
_REPO_PATH = Path(__file__).resolve().parents[2] / "data" / "design-rules.json"
_BUNDLED_PATH = Path(__file__).resolve().parents[1] / "data" / "design-rules.json"

# Attested numbers first, then conventional defaults, then rules with no number.
_TRUST_ORDER = {"source": 0, "default": 1, "none": 2}

# Words too generic to narrow a design description down to relevant rules.
_STOPWORDS = frozenset(
    """a an and are as at be by can do for from get has have how if in into is it
    its like make more must need not of on or should so that the then there this
    to use used using want was what when which will with you your part parts
    print printed printing design designed build building""".split()
)

_cache: dict[str, Any] | None = None
_cache_mtime: float | None = None


def _rules_path() -> Path:
    override = os.getenv("DESIGN_RULES_PATH")
    if override:
        return Path(override).expanduser()
    # The repo copy wins when it exists: it is the one print-kb keeps current.
    return _REPO_PATH if _REPO_PATH.exists() else _BUNDLED_PATH


def load_rules(force: bool = False) -> dict[str, Any]:
    """Load and cache the export, reloading when the file changes on disk.

    print-kb rewrites this file in place on every ingest/rebuild/export, so the
    mtime check means a refresh lands without restarting the server.
    """
    global _cache, _cache_mtime

    path = _rules_path()
    if not path.exists():
        return {"rules": [], "missing": str(path)}

    mtime = path.stat().st_mtime
    if force or _cache is None or mtime != _cache_mtime:
        try:
            _cache = json.loads(path.read_text(encoding="utf-8"))
            _cache_mtime = mtime
            logger.info("Loaded %d design rules from %s", len(_cache.get("rules", [])), path)
        except (OSError, json.JSONDecodeError) as exc:
            logger.error("Could not read design rules at %s: %s", path, exc)
            return {"rules": [], "error": str(exc)}
    return _cache


def _format_value(rule: dict[str, Any]) -> str | None:
    """Render a rule's dimension the way a designer would write it."""
    value = rule.get("value")
    if not value:
        return None
    low, high, unit = value.get("low"), value.get("high"), value.get("unit", "")
    if low is None:
        return None

    if value.get("is_range") and high is not None and high != low:
        return f"{low:g}-{high:g} {unit}".strip()
    return f"{low:g} {unit}".strip()


def _present(rule: dict[str, Any]) -> dict[str, Any]:
    """Shape one rule for an agent: the number, its trust, and its citation."""
    source = rule.get("source") or {}
    out: dict[str, Any] = {
        "rule": rule.get("rule"),
        "topic": rule.get("topic"),
        "value": _format_value(rule),
        "value_source": rule.get("value_source"),
    }

    if rule.get("value_source") == "default":
        out["assumption"] = (
            "No number was stated in the source; this is a conventional FDM default "
            f"({rule.get('default_name')}). Apply it knowingly."
        )
    elif rule.get("value_source") == "none":
        out["assumption"] = (
            "The source stated no number. The rule still holds -- choose a dimension "
            "deliberately rather than treating this as inapplicable."
        )

    citation: dict[str, Any] = {
        "title": source.get("title"),
        "url": source.get("url"),
        "timestamp": source.get("timestamp"),
    }
    if source.get("timestamp_unverified"):
        citation["timestamp_unverified"] = True
        citation["note"] = "Citation could not be matched to the captions; the link may be off."
    out["source"] = citation
    return out


def _by_trust(rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(rules, key=lambda r: _TRUST_ORDER.get(r.get("value_source", "none"), 3))


def _unavailable(data: dict[str, Any]) -> dict[str, Any] | None:
    """Uniform error when the export is absent or unreadable."""
    if data.get("missing"):
        return {
            "status": "error",
            "error": (
                f"No design rules file at {data['missing']}. Run `print-kb export` in the "
                "print-kb project, or point DESIGN_RULES_PATH at the file."
            ),
        }
    if data.get("error"):
        return {"status": "error", "error": f"Design rules file unreadable: {data['error']}"}
    return None


def query_rules(
    keyword: str = "",
    topic: str = "",
    unit: str = "",
    measured_only: bool = False,
    limit: int = 20,
) -> dict[str, Any]:
    """Filter the rules, attested values first."""
    data = load_rules()
    if problem := _unavailable(data):
        return problem

    needle = keyword.lower().strip()
    hits = [
        rule
        for rule in data.get("rules", [])
        if (not topic or rule.get("topic") == topic)
        and (not needle or needle in (rule.get("rule") or "").lower())
        and (not unit or ((rule.get("value") or {}).get("unit") == unit))
        and (not measured_only or rule.get("value_source") == "source")
    ]

    ordered = _by_trust(hits)[: max(0, limit)]
    return {
        "status": "success",
        "generated": data.get("generated"),
        "matched": len(hits),
        "returned": len(ordered),
        "rules": [_present(r) for r in ordered],
    }


def list_topics() -> dict[str, Any]:
    """Topics with rule counts and how many carry a usable number."""
    data = load_rules()
    if problem := _unavailable(data):
        return problem

    topics: dict[str, dict[str, int]] = {}
    for rule in data.get("rules", []):
        entry = topics.setdefault(
            rule.get("topic", "unknown"), {"rules": 0, "measured": 0, "defaulted": 0}
        )
        entry["rules"] += 1
        if rule.get("value_source") == "source":
            entry["measured"] += 1
        elif rule.get("value_source") == "default":
            entry["defaulted"] += 1

    return {
        "status": "success",
        "generated": data.get("generated"),
        "sources": (data.get("counts") or {}).get("sources"),
        "topics": [
            {"topic": name, **counts}
            for name, counts in sorted(topics.items(), key=lambda kv: -kv[1]["rules"])
        ],
    }


def check_design(description: str, limit: int = 15) -> dict[str, Any]:
    """Rules bearing on a described part.

    The description is split into terms and the matches unioned, so "a snap-fit
    lid with 2mm walls and pin joints" pulls wall minimums, hole tolerance and
    snap-fit advice from one call.
    """
    data = load_rules()
    if problem := _unavailable(data):
        return problem

    terms = {
        word
        for word in re.findall(r"[a-z]+", description.lower())
        if len(word) > 2 and word not in _STOPWORDS
    }
    if not terms:
        return {
            "status": "error",
            "error": (
                "No usable terms in the description; name the features, joints, "
                "materials or dimensions of the part."
            ),
        }

    scored: list[tuple[int, dict[str, Any]]] = []
    for rule in data.get("rules", []):
        text = f"{rule.get('rule', '')} {rule.get('topic', '')}".lower()
        # Substring rather than whole-token matching, so "walls" still finds "wall".
        matched = {t for t in terms if t in text or t.rstrip("s") in text}
        if matched:
            scored.append((len(matched), rule))

    # Most terms matched first, then attested values ahead of conventional defaults.
    scored.sort(
        key=lambda pair: (-pair[0], _TRUST_ORDER.get(pair[1].get("value_source", "none"), 3))
    )
    chosen = [rule for _, rule in scored[: max(0, limit)]]

    return {
        "status": "success",
        "generated": data.get("generated"),
        "terms": sorted(terms),
        "matched": len(scored),
        "returned": len(chosen),
        "rules": [_present(r) for r in chosen],
    }


# Dispatched locally in server.py: these answer from the JSON file and must never
# be forwarded to Blender, which has no idea what a design rule is.
DESIGN_RULE_HANDLERS = {
    "get_design_rules": lambda args: query_rules(
        keyword=args.get("keyword", ""),
        topic=args.get("topic", ""),
        unit=args.get("unit", ""),
        measured_only=bool(args.get("measured_only", False)),
        limit=int(args.get("limit", 20)),
    ),
    "list_design_topics": lambda args: list_topics(),
    "check_design": lambda args: check_design(
        description=args.get("description", ""),
        limit=int(args.get("limit", 15)),
    ),
}

_CONSULT_FIRST = (
    "Consult this BEFORE generating geometry, not after -- these constraints are cheap "
    "to honour while modelling and expensive to discover after a failed print. A null "
    "value means the source stated no number, so choose a dimension knowingly rather "
    "than treating the rule as inapplicable."
)


def get_design_rule_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="check_design",
            description=(
                "Look up 3D-printing design rules bearing on a part you are about to model, "
                "described in plain language (e.g. 'a snap-fit enclosure lid with 2mm walls "
                "and pin joints'). Returns wall minimums, clearances, overhang limits and "
                "similar constraints, each cited to the video that stated it. " + _CONSULT_FIRST
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "description": {
                        "type": "string",
                        "description": (
                            "What you are modelling: features, joints, materials, dimensions."
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum rules to return.",
                        "default": 15,
                    },
                },
                "required": ["description"],
            },
        ),
        types.Tool(
            name="get_design_rules",
            description=(
                "Filter the 3D-printing design rules by keyword, topic or unit. Prefer "
                "check_design when you can describe the part in prose. " + _CONSULT_FIRST
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": (
                            "Substring to match in the rule text, e.g. 'overhang', 'wall', "
                            "'clearance'."
                        ),
                    },
                    "topic": {
                        "type": "string",
                        "enum": [
                            "modeling",
                            "tolerances",
                            "orientation",
                            "supports",
                            "slicer",
                            "materials",
                        ],
                        "description": "Restrict to one topic.",
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["mm", "deg", "xnozzle"],
                        "description": "Only rules whose value carries this unit.",
                    },
                    "measured_only": {
                        "type": "boolean",
                        "description": (
                            "Only rules whose number was actually stated in the video, "
                            "excluding conventional defaults."
                        ),
                        "default": False,
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum rules to return.",
                        "default": 20,
                    },
                },
            },
        ),
        types.Tool(
            name="list_design_topics",
            description=(
                "List the design-rule topics with how many rules each holds and how many "
                "carry a stated dimension. Useful for judging whether the knowledge base "
                "can answer a question before asking it."
            ),
            inputSchema={"type": "object", "properties": {}},
        ),
    ]
