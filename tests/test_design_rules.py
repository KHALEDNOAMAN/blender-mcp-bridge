# tests/test_design_rules.py
"""Behaviour of the design-rule tools served from print-kb's JSON export.

These tools are the odd ones out in this server: every other tool is forwarded
to Blender, while these are answered locally from a file. The dispatch test
below is the one that matters most -- forwarding them would reach a bridge that
has no handler for them.
"""

import asyncio
import json
import sys
from pathlib import Path
from unittest import mock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from blender_mcp_bridge.tools import get_mcp_tools  # noqa: E402
from blender_mcp_bridge.tools.design_rules import (  # noqa: E402
    DESIGN_RULE_HANDLERS,
    _format_value,
    _present,
    check_design,
    list_topics,
    query_rules,
)

RULES_FILE = Path(__file__).resolve().parents[1] / "data" / "design-rules.json"
needs_export = pytest.mark.skipif(
    not RULES_FILE.exists(), reason="data/design-rules.json not present"
)


class TestValueFormatting:
    def test_single_value(self):
        assert _format_value({"value": {"low": 1.0, "high": 1.0, "unit": "mm"}}) == "1 mm"

    def test_range(self):
        rule = {"value": {"low": 45.0, "high": 50.0, "unit": "deg", "is_range": True}}
        assert _format_value(rule) == "45-50 deg"

    def test_range_flag_with_equal_bounds_reads_as_one_number(self):
        rule = {"value": {"low": 2.0, "high": 2.0, "unit": "mm", "is_range": True}}
        assert _format_value(rule) == "2 mm"

    def test_no_value(self):
        assert _format_value({"value": None}) is None


class TestPresentation:
    """A default must never read as something a video actually claimed."""

    def test_default_is_flagged_as_an_assumption(self):
        out = _present(
            {
                "rule": "r",
                "value": {"low": 0.2, "high": 0.2, "unit": "mm"},
                "value_source": "default",
                "default_name": "clearance",
                "source": {},
            }
        )
        assert "assumption" in out
        assert "clearance" in out["assumption"]

    def test_attested_value_carries_no_assumption(self):
        out = _present(
            {
                "rule": "r",
                "value": {"low": 1.0, "high": 1.0, "unit": "mm"},
                "value_source": "source",
                "source": {},
            }
        )
        assert "assumption" not in out

    def test_valueless_rule_tells_the_agent_to_choose(self):
        out = _present({"rule": "r", "value": None, "value_source": "none", "source": {}})
        assert out["value"] is None
        assert "deliberately" in out["assumption"]

    def test_unverified_timestamp_is_surfaced(self):
        out = _present(
            {
                "rule": "r",
                "value": None,
                "value_source": "none",
                "source": {"timestamp": "01:00", "timestamp_unverified": True},
            }
        )
        assert out["source"]["timestamp_unverified"] is True
        assert "may be off" in out["source"]["note"]


@needs_export
class TestQueries:
    def test_attested_values_sort_ahead_of_defaults(self):
        sources = [r["value_source"] for r in query_rules(keyword="wall", limit=10)["rules"]]
        ranks = [{"source": 0, "default": 1, "none": 2}[s] for s in sources]
        assert ranks == sorted(ranks)

    def test_measured_only_excludes_defaults(self):
        out = query_rules(measured_only=True, limit=50)
        assert out["rules"]
        assert all(r["value_source"] == "source" for r in out["rules"])

    def test_unit_filter(self):
        out = query_rules(unit="deg", limit=50)
        assert out["rules"]
        assert all(r["value"] and r["value"].endswith("deg") for r in out["rules"])

    def test_limit_is_respected(self):
        assert len(query_rules(limit=3)["rules"]) == 3

    def test_topics_report_measured_counts(self):
        out = list_topics()
        assert out["status"] == "success"
        assert {t["topic"] for t in out["topics"]} >= {"modeling", "tolerances"}
        assert all(t["measured"] <= t["rules"] for t in out["topics"])


@needs_export
class TestCheckDesign:
    def test_prose_description_finds_rules_across_features(self):
        out = check_design("a snap-fit enclosure lid with a 2mm wall and pin joints")
        assert out["status"] == "success"
        assert out["returned"] > 0
        text = " ".join(r["rule"].lower() for r in out["rules"])
        # The doc claims this surfaces wall and fit advice from a single call.
        assert "wall" in text or "fit" in text

    def test_generic_words_alone_are_rejected(self):
        # Everything here is a stopword, so there is nothing to match on.
        out = check_design("make a part for printing")
        assert out["status"] == "error"

    def test_plural_matches_singular_rule_text(self):
        assert check_design("walls")["returned"] > 0


class TestRegistrationAndDispatch:
    def test_tools_are_registered_once(self):
        names = [t.name for t in get_mcp_tools()]
        for name in DESIGN_RULE_HANDLERS:
            assert names.count(name) == 1

    @needs_export
    def test_calls_never_reach_blender(self):
        """The whole point of the local branch in server.py."""
        import blender_mcp_bridge.server as server

        def explode(*args, **kwargs):
            raise AssertionError("design-rule call was forwarded to Blender")

        call_tool = getattr(server.call_tool, "__wrapped__", server.call_tool)
        with mock.patch.object(server.blender, "send_command", explode):
            for name in DESIGN_RULE_HANDLERS:
                args = {"description": "2mm wall"} if name == "check_design" else {}
                result = asyncio.run(call_tool(name, args))
                assert json.loads(result[0].text)["status"] == "success"

    @needs_export
    def test_blender_tools_still_forward(self):
        import blender_mcp_bridge.server as server

        seen = {}

        def capture(name, args, rid):
            seen["name"] = name
            return {"status": "success"}

        call_tool = getattr(server.call_tool, "__wrapped__", server.call_tool)
        with mock.patch.object(server.blender, "send_command", capture):
            asyncio.run(call_tool("create_cube", {"name": "Box"}))
        assert seen["name"] == "create_cube"


class TestMissingExport:
    def test_absent_file_explains_how_to_produce_it(self, monkeypatch):
        import blender_mcp_bridge.tools.design_rules as design_rules

        monkeypatch.setenv("DESIGN_RULES_PATH", str(Path("no") / "such" / "file.json"))
        monkeypatch.setattr(design_rules, "_cache", None)
        monkeypatch.setattr(design_rules, "_cache_mtime", None)

        out = design_rules.query_rules(keyword="wall")
        assert out["status"] == "error"
        assert "print-kb export" in out["error"]


class TestBundledExport:
    """The wheel ships its own copy of the rules; it must not drift."""

    def test_bundled_copy_matches_the_export(self):
        root = Path(__file__).resolve().parents[1]
        source = root / "data" / "design-rules.json"
        bundled = root / "blender_mcp_bridge" / "data" / "design-rules.json"
        if not source.exists():
            pytest.skip("no export present")
        assert bundled.exists(), "run scripts/sync_design_rules.py"
        assert bundled.read_bytes() == source.read_bytes(), (
            "bundled design rules are stale; run scripts/sync_design_rules.py"
        )
