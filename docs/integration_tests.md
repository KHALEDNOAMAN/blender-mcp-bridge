# Integration Tests

This guide explains how to run the integration test suite for the Blender MCP addon. The test suite uses a CLI tool to automate the creation of test scenes and verify the results against a benchmark.

These tests drive a **live Blender instance** and are run by hand. For the pure-Python
suites that need no Blender and run under pytest, see [Unit Tests](unit_tests.md).
Neither set runs in CI.

## Prerequisites

1.  **Blender MCP Addon**: Ensure Blender is open and the addon server is started (N-Panel > Blender MCP > Start Server).
2.  **MCP Bridge Server**: Ensure the Python bridge is running — the subcommand is
    required, since bare `python -m blender_mcp_bridge.main` only prints help and starts nothing:
    ```bash
    uv run python -m blender_mcp_bridge.main serve
    ```
3.  **Dependencies**: Install the required Python packages:
    ```bash
    uv sync
    ```

## Running Tests

The test runner is a CLI tool located at `tests/run_integration.py`.

### 1. Run Scenario

The runner supports multiple scenarios via the `--scenario` (or `-s`) flag. Run all scenarios or a specific one:

```bash
# Run all scenarios (default)
python tests/run_integration.py run

# Run specific scenario
python tests/run_integration.py run --scenario grid
python tests/run_integration.py run --scenario arch
python tests/run_integration.py run --scenario print
python tests/run_integration.py run --scenario filament_tag
```

**What each scenario validates:**

#### Grid Scenario
![Grid Scenario Result](images/grid_scenario_result.png)
1.  **Connects** to the MCP server.
2.  **Generates a grid of objects** in Blender to verify tool categories:
    -   **Row 1 (Primitives)**: Cube, Sphere, Cylinder, Torus, Plane, IcoSphere.
    -   **Row 2 (Modifiers)**: Bevel, Array, Subdivision Surface.
    -   **Row 3 (Collections)**: Collection hierarchies and visibility.
    -   **Row 4 (Operators)**: Boolean operations (Union, Difference, Intersect).
    -   **Row 5 (Transforms)**: Move, Rotate, Scale, Duplicate, Batch operations.
    -   **Row 6 (Systems)**: MEP component runs (pipes, cable trays) with system-type
        color coding, fittings, and support spacing.
3.  **Captures** the scene state to `tests/benchmarks/grid_last_run.json`.

#### Arch Scenario
![Arch Scenario Result](images/arch_scenario_result.png)
1.  **Connects** to the MCP server.
2.  **Constructs a complete 3D floor plan** based on architectural layout dimensions:
    -   **Outer Shell**: Floor slab, walls (0.2m), and hidden ceiling.
    -   **Architectural Features**: Structural columns merged with walls via Boolean Union.
    -   **Sub-divisions**: Bedroom partitions with door and window cutouts.
    -   **Annotation**: 3D labels for rooms (Bedroom, Bath, Kitchen, etc.) with rotation support.
3.  **Captures** the scene state to `tests/benchmarks/arch_last_run.json`.

#### Print Scenario
Replicates a 3D-printing preparation pipeline (a "calibration Jack"): sets scene units
to millimetres, builds intersecting sphere/cylinder primitives, fuses them with
`join_objects` + `apply_voxel_remesh`, then gates on `check_mesh_for_printing` before
`export_model`.

#### Filament Tag Scenario
Generates a 4-piece filament name-tag & clip system (NameTagCard, AMSClip,
StickonHolder, DeskStand) — raised `create_text` labels, `boolean_operation` cutouts
with `apply_all_modifiers`, and STL export. Exercises text-to-mesh
(`convert_to_mesh`) and boolean-heavy printable geometry rather than materials.

### Advanced Run Options

```bash
# Run specific module (Grid scenario only)
python tests/run_integration.py run -s grid --module modifiers

# Verify against benchmark
python tests/run_integration.py verify -s arch
```

`--module` accepts one of `primitives`, `modifiers`, `collections`, `operators`,
`transforms`, `systems` — one per grid row. It is grid-only: passing it with
`-s arch` raises a usage error, and passing it without `-s` auto-selects `grid`
rather than running everything.

If the scene matches the expected state, you will see verification output. If not, it will report missing or unexpected objects and property mismatches.

> [!IMPORTANT]
> **Only `grid` and `arch` ship a committed baseline.** `tests/benchmarks/` holds
> `grid_expected.json` and `arch_expected.json`; every `*_last_run.json` is
> git-ignored, and there is no `print_expected.json` or `filament_tag_expected.json`.
>
> So `verify -s print` and `verify -s filament_tag` cannot pass on a fresh clone —
> they print `No benchmark file found ...` and exit **1**. That also means
> `verify -s all` (the default) exits 1 even when grid and arch both pass:
>
> ```text
> ✅ Verification Passed!          <- grid
> ✅ Verification Passed!          <- arch
> No benchmark file found at ...print_expected.json. Run 'approve' to bless.
> No benchmark file found at ...filament_tag_expected.json. Run 'approve' to bless.
> $ echo $?
> 1
> ```
>
> For those two scenarios, `run` is a smoke test (it fails on a tool error, but
> nothing is diffed). To start diffing them, bless a known-good run with
> `approve -s print` — but review the snapshot before committing it, since
> `approve` blesses whatever last ran, correct or not.

### 2. Run and Verify in One Step

You can run and verify in a single command:

```bash
python tests/run_integration.py run -s grid --verify
```

## Updating Baselines

If you make intentional changes to the test scenario or addon logic that affect the output, you can update the benchmark to reflect the new expected state:

```bash
python tests/run_integration.py approve -s arch
```

This copies `tests/benchmarks/<scenario>_last_run.json` to `tests/benchmarks/<scenario>_expected.json`.

### Transport Modes

The test runner supports two transport modes for communicating with the MCP server:

-   **Stateless**: Uses simple HTTP POST requests with a session ID. This emulates how n8n and other stateless clients interact with the server.
-   **Stateful (Default)**: Uses the official MCP SDK to perform a standard HTTP Streamable handshake and long-running session.

```bash
# Run in stateful mode (default)
python tests/run_integration.py run --transport stateful

# Run in stateless mode
python tests/run_integration.py run --transport stateless
```

## Extending the Test Suite

### Adding New Test Modules

The test suite uses a modular "row" based approach where each category of tests is a separate module that generates a row of objects in the Blender grid.

To add a new test module (e.g., `physics`):

1.  **Create a Module File**:
    Create `tests/scenarios/modules/row_physics.py`:
    ```python
    from tests.utils.mcp_client import MCPClient

    def create_physics_row(client: MCPClient, y_offset: float):
        print(f"Creating Physics Row at Y={y_offset}...")
        # Add tool calls here...
    ```

2.  **Register in Scenario**:
    Update `tests/scenarios/grid_layout.py`:
    - Import your function: `from tests.scenarios.modules.row_physics import create_physics_row`
    - Add it to the `run()` method with a text label:
      ```python
      if not module or module == "physics":
          self.client.call_tool("create_text", {"text": "Physics", "location": [-5.0, 50.0, 0.0], ...})
          create_physics_row(self.client, y_offset=50.0)
      ```

3.  **Update CLI Runner**:
    Update `tests/run_integration.py`:
    - Add "physics" to the `type=click.Choice([...])` list for the `--module` option.

### Structure

-   `tests/run_integration.py`: CLI entry point; the `SCENARIOS` dict maps each
    `--scenario` key to its class.
-   `tests/scenarios/grid_layout.py`: Main scenario orchestrator (the only one with
    `--module` rows).
-   `tests/scenarios/arch_layout.py`, `print_layout.py`, `filament_tag_layout.py`:
    the other three scenarios, each a single self-contained class.
-   `tests/scenarios/modules/`: Individual test logic files (one per grid row) —
    `row_primitives`, `row_modifiers`, `row_collections`, `row_operators`,
    `row_transforms`, `row_systems`.
-   `tests/utils/`: shared utilities (`MCPClient`, `stateful_mcp_client`).
-   `tests/benchmarks/`: JSON snapshots of scene state. `*_expected.json` are the
    committed baselines (grid and arch only); `*_last_run.json` are git-ignored
    working output.

> [!NOTE]
> Registering a new scenario also means adding its key to the `type=click.Choice([...])`
> list on **all three** commands (`run`, `verify`, `approve`) — they each declare
> `--scenario` separately.
