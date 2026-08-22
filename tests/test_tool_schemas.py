# tests/test_tool_schemas.py
"""Schema hygiene checks over every bridge tool.

These guard machine-readability of the tool catalog, which Studio's
schema-driven forms consume directly (studio/src/lib/demoTools.js is generated
from it). A default documented only in prose is invisible to the UI: the field
renders with no hint of what will happen if left blank, which is how
repair_mesh's merge_distance ended up looking like a required-but-empty box.
"""

import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from blender_mcp_bridge.tools import get_mcp_tools  # noqa: E402

TOOLS = get_mcp_tools()

# A prose default worth flagging states a CONCRETE literal the schema could
# have carried instead: "(default: 0.0001)", "(default: 'STL')", "default: true".
#
# Deliberately NOT matched: defaults that are computed at call time and have no
# static value to express — "Defaults to object location", "Defaults to whatever
# the scene already uses", "Defaults to all visible meshes". Those are real
# documentation, not a missing `default` key, and forcing a literal onto them
# would be worse than the prose.
#
# Case matters here, so the pattern is NOT compiled with re.IGNORECASE: an
# ENUM_STYLE constant must actually be upper-case, otherwise `[A-Z_]{2,}` would
# match any ordinary word and "Defaults to object location" would be flagged.
# Only the "default(s)" keyword itself is allowed to vary in case.
PROSE_DEFAULT = re.compile(
    r"\b[Dd]efaults?\s*(?::|\sto\s)\s*"
    r"""(['"]?)"""  # optional opening quote
    r"(?:-?\d+(?:\.\d+)?"  # a number ...
    r"|[Tt]rue|[Ff]alse"  # ... or a boolean ...
    r"|[A-Z][A-Z_]+"  # ... or an ENUM_STYLE constant ...
    r"|[\w-]+\.[a-z0-9]{2,4})"  # ... or a filename-ish literal
    r"\1"
    r"(?![\w-])"  # must end the token, not a prefix
)


def _properties(tool):
    """Yield (tool_name, prop_name, prop_schema) for every property, nested included."""

    def walk(props, prefix=""):
        for name, schema in (props or {}).items():
            path = f"{prefix}{name}"
            yield tool.name, path, schema
            if schema.get("type") == "object" and schema.get("properties"):
                yield from walk(schema["properties"], f"{path}.")
            items = schema.get("items")
            if isinstance(items, dict) and items.get("properties"):
                yield from walk(items["properties"], f"{path}[].")

    yield from walk(tool.inputSchema.get("properties"))


ALL_PROPS = [p for t in TOOLS for p in _properties(t)]


@pytest.mark.parametrize(
    "description,expected",
    [
        # Concrete literals -> should be a real `default` key.
        ("Threshold distance for merging overlapping vertices (default: 0.0001).", True),
        ("Recalculate face normals to point outwards (default: true).", True),
        ("The unit system to use (default: 'METRIC').", True),
        ("File format to export (default: 'STL').", True),
        ("Resolution grid size (default: 0.1).", True),
        ("Reduces polygon count (default: 0.0).", True),
        ("Export only selected objects (default: true).", True),
        ("Output image size in pixels. Default: 800", True),
        # Computed at call time -> prose is correct, nothing to hoist.
        ("Optional: XYZ center of distribution. Defaults to object location.", False),
        ("Render engine. Defaults to whatever the scene already uses.", False),
        ("Optional: only frame these objects. Defaults to all visible meshes.", False),
        ("Filepath to export to. Defaults to '[object_name].stl' inside assets dir.", False),
        ("True to enable Dyntopo, False to disable", False),
        ("The name of the mesh object to repair.", False),
    ],
)
def test_prose_default_detector(description, expected):
    """The detector must flag hoistable literals without flagging computed ones.

    Guards the test itself: an over-broad pattern would push authors to invent
    literal defaults for values that are genuinely dynamic.
    """
    assert bool(PROSE_DEFAULT.search(description)) is expected, description


def test_tools_are_discovered():
    """Guard against the parametrised tests below silently passing on nothing."""
    assert len(TOOLS) > 50, f"only {len(TOOLS)} tools found — did the import break?"
    assert len(ALL_PROPS) > 200


@pytest.mark.parametrize(
    "tool_name,prop_name,schema", ALL_PROPS, ids=[f"{t}.{p}" for t, p, _ in ALL_PROPS]
)
def test_defaults_are_machine_readable(tool_name, prop_name, schema):
    """A default stated in the description must also exist as a `default` key.

    Prose is for humans; Studio reads `default`. Stating one only in the
    description means the form cannot show it as a ghost placeholder, and the
    user cannot tell an unset field from a required one.
    """
    description = schema.get("description", "") or ""
    if not PROSE_DEFAULT.search(description):
        return
    assert "default" in schema, (
        f"{tool_name}.{prop_name} documents a default in prose "
        f"({description.strip()!r}) but has no JSON-Schema `default` key. "
        f"Add one so Studio can render it as a placeholder."
    )


@pytest.mark.parametrize(
    "tool_name,prop_name,schema", ALL_PROPS, ids=[f"{t}.{p}" for t, p, _ in ALL_PROPS]
)
def test_declared_default_matches_its_type(tool_name, prop_name, schema):
    """A `default` must be the type the property declares.

    A string "0.001" on a number field would be coerced inconsistently — the
    same class of bug as a numeric-string dimension reaching Blender and
    silently no-opping.
    """
    if "default" not in schema:
        return
    declared, value = schema.get("type"), schema["default"]
    expected = {
        "number": (int, float),
        "integer": int,
        "string": str,
        "boolean": bool,
        "array": list,
        "object": dict,
    }.get(declared)
    if expected is None:
        return
    # bool is a subclass of int in Python; a boolean default on a number field
    # is a mistake, so reject it explicitly rather than letting isinstance pass.
    if declared in ("number", "integer") and isinstance(value, bool):
        pytest.fail(f"{tool_name}.{prop_name} declares type {declared} but defaults to a bool")
    assert isinstance(value, expected), (
        f"{tool_name}.{prop_name} declares type {declared!r} "
        f"but its default is {value!r} ({type(value).__name__})"
    )


@pytest.mark.parametrize(
    "tool_name,prop_name,schema", ALL_PROPS, ids=[f"{t}.{p}" for t, p, _ in ALL_PROPS]
)
def test_enum_default_is_a_member(tool_name, prop_name, schema):
    """A default outside its own enum can never be selected in the UI."""
    if "default" not in schema or "enum" not in schema:
        return
    assert schema["default"] in schema["enum"], (
        f"{tool_name}.{prop_name} defaults to {schema['default']!r}, "
        f"which is not in its enum {schema['enum']}"
    )


@pytest.mark.parametrize("tool", TOOLS, ids=[t.name for t in TOOLS])
def test_required_props_have_no_default(tool):
    """A required property with a default is contradictory.

    Studio renders a default as a ghost placeholder for an optional field; on a
    required one the user would see a hint that the value is optional while
    validation blocks confirm.
    """
    props = tool.inputSchema.get("properties", {})
    for name in tool.inputSchema.get("required", []):
        schema = props.get(name)
        if schema is None:
            pytest.fail(f"{tool.name} lists {name!r} as required but declares no such property")
        assert "default" not in schema, (
            f"{tool.name}.{name} is required but also declares a default "
            f"({schema['default']!r}) — it can only be one of the two."
        )
