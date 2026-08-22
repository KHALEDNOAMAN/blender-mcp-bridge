# Unit Tests

This document describes the unit tests for the Blender MCP project, focusing on core
logic that can be tested without a running Blender instance.

There are two suites, both under `tests/`:

| File | Tests | What it guards |
|---|---|---|
| `tests/test_sessions.py` | 1 | Session record/save/reload round-trip |
| `tests/test_tool_schemas.py` | 1600 | Schema hygiene across every bridge tool |

## Running the Tests

Both suites are pytest files. Note that **pytest is not currently declared in any
dependency group** in `pyproject.toml` (`[dependency-groups] dev` holds only `ruff`
and `mypy`), so pass it in explicitly:

```bash
# Everything
uv run --with pytest python -m pytest tests/ -q

# One suite
uv run --with pytest python -m pytest tests/test_tool_schemas.py -q
```

Expected result: `1601 passed`.

`tests/test_sessions.py` also keeps a `__main__` guard, so the legacy invocation
still works and prints its own step-by-step trace:

```bash
python -m tests.test_sessions
```

> [!NOTE]
> These unit tests are **not run by CI**. [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
> runs only ruff (lint + format), ruff C90 complexity, and mypy — there is no pytest
> job. Run them locally before pushing.

## Session Lifecycle Tests

`tests/test_sessions.py` verifies the core recording and playback logic of the
`BridgeSession` system. The `test_session_lifecycle` suite performs the following
validations:

1.  **Initializing Recorder**: Creates a new `SessionRecorder` with a target JSON path and metadata.
2.  **Recording Commands**: Records mock tool calls (e.g., `create_cube`, `create_cylinder`) to ensure they are correctly captured in memory.
3.  **Verifying File Existence**: Confirms that the session is automatically saved to the filesystem after each command.
4.  **Validating JSON Structure**: Reads the generated `.json` file and verifies that the schema, metadata, and command arguments match the recorded data.
5.  **Round-trip Loading**: Tests `BridgeSession.load()` to ensure a saved session can be reloaded into a Python object without data loss.
6.  **Cleanup**: Automatically removes the temporary test file upon success.

### Example Output

Upon a successful run of `python -m tests.test_sessions`, you should see:

```text
1. Initializing Recorder with path: test_unit_session.json
2. Recording mock commands: 'create_cube', 'create_cylinder'...
3. Verifying file existence: test_unit_session.json
4. Validating JSON structure and data integrity...
5. Testing BridgeSession.load() round-trip...
6. Cleaning up temporary test file...
[PASS] Session Lifecycle Unit Test Passed!
```

## Tool Schema Hygiene Tests

`tests/test_tool_schemas.py` checks every property of every bridge tool returned by
`blender_mcp_bridge.tools.get_mcp_tools()`. These guard the **machine-readability** of the tool
catalog, which Studio's schema-driven forms consume directly (`studio/src/lib/demoTools.js`
is generated from it).

The motivating bug: a default documented only in prose is invisible to the UI. The
field renders with no hint of what happens if left blank — which is how
`repair_mesh`'s `merge_distance` ended up looking like a required-but-empty box.

The suite walks nested properties too (object sub-properties and array `items`),
so a `holes[].radius` deep inside `create_watertight_plate` is checked like any
top-level field.

| Test | Cases | Rule enforced |
|---|---|---|
| `test_defaults_are_machine_readable` | 497 | A default stated in the description must also exist as a JSON-Schema `default` key |
| `test_declared_default_matches_its_type` | 497 | A `default` must match the property's declared `type` |
| `test_enum_default_is_a_member` | 497 | A `default` on an enum field must be one of that enum's values |
| `test_required_props_have_no_default` | 94 | A property cannot be both required and defaulted |
| `test_prose_default_detector` | 14 | Guards the regex above against over/under-matching |
| `test_tools_are_discovered` | 1 | Fails if the import breaks and the parametrised tests silently run on nothing |

The per-property counts (497) and per-tool count (94) are derived at collection time,
so they grow automatically as tools are added — no fixture to update.

### The prose-default detector

`test_defaults_are_machine_readable` relies on a regex (`PROSE_DEFAULT`) that
deliberately distinguishes two kinds of documented default:

- **Hoistable** — a concrete literal the schema could have carried instead:
  `(default: 0.0001)`, `(default: 'STL')`, `default: true`. These are flagged.
- **Computed** — resolved at call time with no static value to express:
  "Defaults to object location", "Defaults to whatever the scene already uses".
  These are *not* flagged; forcing a literal onto them would be worse than the prose.

The pattern is intentionally **not** compiled with `re.IGNORECASE`: the `[A-Z][A-Z_]+`
branch must match only genuine `ENUM_STYLE` constants, otherwise it would match any
ordinary word and flag "Defaults to object location". `test_prose_default_detector`
pins this behaviour with 14 worked examples so a future loosening of the regex fails
loudly.

### Type-check strictness

`test_declared_default_matches_its_type` rejects a boolean default on a `number` or
`integer` field explicitly, rather than letting `isinstance` pass it — `bool` is a
subclass of `int` in Python. This is the same class of bug as a numeric-string
dimension reaching Blender and silently no-opping.

---

> [!NOTE]
> These tests are "pure Python" and do not require the Blender Addon to be active.
> They test the Bridge logic specifically. For testing actual Blender tool execution,
> see [Integration Tests](integration_tests.md).
