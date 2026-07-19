# tests/scenarios/modules/row_systems.py

from tests.utils.mcp_client import MCPClient


def create_systems_row(client: MCPClient, y_offset: float = 0.0):
    """
    Gallery of MEP components: Systems (x=0-10, z=0), Contextual Fittings (x=15), Sizing (x=20), Context (x=25).
    """
    collection = "SYS_MEP"
    client.call_tool("create_collection", {"name": collection})

    # ── [X=0-10] SYSTEM RUNS AT Z=0 ───────────────────────────────────────────

    # Fire Water (Red) - Straight run
    client.call_tool(
        "build_pipe_run",
        {
            "points": [[0, y_offset, 0], [10, y_offset, 0]],
            "radius": 0.08,
            "system_type": "FIRE",
            "name": "SYS_Run_Fire",
            "collection": collection,
        },
    )

    # Gas (Yellow) - Simple run
    client.call_tool(
        "build_pipe_run",
        {
            "points": [[0, y_offset + 1, 0], [10, y_offset + 1, 0]],
            "radius": 0.04,
            "system_type": "GAS",
            "name": "SYS_Run_Gas",
            "collection": collection,
        },
    )

    # Chilled Water (Cyan) - Complex run with AUTO-FITTINGS
    client.call_tool(
        "build_pipe_run",
        {
            "points": [
                [0, y_offset + 2, 0],
                [5, y_offset + 2, 0],
                [5, y_offset + 3, 0],
            ],
            "radius": 0.06,
            "system_type": "CHILLER",
            "name": "SYS_Run_Chiller",
            "add_fittings": True,
            "collection": collection,
        },
    )

    # Drainage (Green) - VERTICAL STACK (4 -> 0)
    client.call_tool(
        "build_pipe_run",
        {
            "points": [[0, y_offset + 3, 4.0], [0, y_offset + 3, 0]],
            "radius": 0.1,
            "system_type": "DRAINAGE",
            "name": "SYS_Run_Drainage_Stack",
            "add_fittings": True,
            "collection": collection,
        },
    )

    # ── [X=15] UNIFIED ROUTING DEMO ───────────────────────────────────────────

    # 1. Unified 90 Deg Bend: Floor to Wall (X to Z) in ONE call
    client.call_tool(
        "build_pipe_run",
        {
            "points": [[13, y_offset, 0], [15, y_offset, 0], [15, y_offset, 2]],
            "radius": 0.05,
            "system_type": "WATER",
            "name": "SYS_Routing_90",
            "add_fittings": True,
            "collection": collection,
        },
    )

    # 2. Unified Elevation Skip: (X: 13->19, Z: 0 -> 2)
    # This creates the "Z" shape automatically with internal joint spheres
    client.call_tool(
        "build_pipe_run",
        {
            "points": [
                [13, y_offset + 2, 0],
                [15, y_offset + 2, 0],
                [17, y_offset + 2, 2],
                [19, y_offset + 2, 2],
            ],
            "radius": 0.05,
            "system_type": "WATER",
            "name": "SYS_Routing_Z_Skip",
            "add_fittings": True,
            "collection": collection,
        },
    )

    # 3. Dedicated Tee Header with auto joints
    client.call_tool(
        "build_pipe_run",
        {
            "points": [
                [13, y_offset + 4, 0],
                [15, y_offset + 4, 0],
                [15, y_offset + 4, 1.5],
                [15, y_offset + 4, 0],
                [17, y_offset + 4, 0],
            ],
            "radius": 0.08,
            "system_type": "WATER",
            "name": "SYS_Routing_Header_Tee",
            "add_fittings": True,
            "collection": collection,
        },
    )

    # ── [X=20] TRAY SIZING (mm units) ─────────────────────────────────────────

    sizes = [(0.02, 0.04, "20x40"), (0.05, 0.1, "50x100"), (0.1, 0.2, "100x200")]
    for i, (d, w, label) in enumerate(sizes):
        client.call_tool(
            "build_cable_tray",
            {
                "points": [[20, y_offset + (i * 2), 0], [22, y_offset + (i * 2), 0]],
                "width": w,
                "depth": d,
                "name": f"SYS_Tray_{label}",
                "collection": collection,
            },
        )

    # ── [X=25] MOUNTING CONTEXT ───────────────────────────────────────────────

    # 1. Ceiling Context (Trapeze) with INTEGRATED SUPPORTS
    client.call_tool(
        "create_cube",
        {
            "location": [25, y_offset, 4.0],
            "scale": [2.0, 0.5, 0.05],
            "name": "SYS_Mock_Ceiling",
            "collection": collection,
        },
    )

    client.call_tool(
        "build_cable_tray",
        {
            "points": [[24, y_offset, 3.5], [26, y_offset, 3.5]],
            "width": 0.3,
            "name": "SYS_Ceiling_Run",
            "supports": [
                {
                    "location": [25, y_offset, 3.5],
                    "support_type": "TRAPEZE_HANGER",
                    "height_to_ceiling": 0.5,
                }
            ],
            "system_type": "DATA",
            "collection": collection,
        },
    )

    # 1.5 Standalone Support (Testing add_tray_support)
    client.call_tool(
        "add_tray_support",
        {
            "location": [24.5, y_offset, 3.5],
            "support_type": "TRAPEZE_HANGER",
            "height_to_ceiling": 0.5,
            "name": "SYS_Standalone_Supp",
            "collection": collection,
        },
    )

    # 2. Wall Context (Cantilever/Wall Brackets) with AUTOMATED SUPPORTS
    client.call_tool(
        "create_cube",
        {
            "location": [24, y_offset + 6, 2.0],
            "scale": [6.0, 0.15, 4.0],
            "name": "SYS_Mock_Wall",
            "collection": collection,
        },
    )

    # BIG tray with Auto-Cantilever
    client.call_tool(
        "build_cable_tray",
        {
            "points": [[21.5, y_offset + 5.65, 4.0], [26.5, y_offset + 5.65, 4.0]],
            "width": 0.45,
            "name": "SYS_Big_Cantilever_Run",
            "auto_support_spacing": 1.5,
            "auto_support_type": "CANTILEVER_BRACKET",
            "support_start_offset": 0.5,
            "side_direction": [0, 1, 0],
            "collection": collection,
            "system_type": "FIRE_ALARM",
        },
    )

    # BIGGER tray with Auto-Wall-Bracket
    client.call_tool(
        "build_cable_tray",
        {
            "points": [[21.5, y_offset + 5.65, 3.0], [26.5, y_offset + 5.65, 3.0]],
            "width": 0.6,
            "name": "SYS_Bigger_Wall_Bracket_Run",
            "auto_support_spacing": 1.2,
            "auto_support_type": "WALL_BRACKET",
            "support_start_offset": 0.3,
            "side_direction": [0, 1, 0],
            "collection": collection,
            "system_type": "FIBER",
        },
    )

    # ── [X=30] UNIFIED TRAY ROUTING (Bulkhead Z-Bend) ─────────────────────────

    # 3. Realistic Z-Bend Tray with Bulkhead Context
    # Drop from 4m ceiling to 3.5m ceiling with a 45-degree tray offset

    # Context: High Ceiling (4m) - Thin Cube
    client.call_tool(
        "create_cube",
        {
            "location": [30.5, y_offset + 2, 4.0],
            "scale": [3.0, 0.5, 0.05],
            "name": "SYS_Bulkhead_High",
            "collection": collection,
        },
    )

    # Context: Low Ceiling (3.5m) - Thin Cube
    client.call_tool(
        "create_cube",
        {
            "location": [33.5, y_offset + 2, 3.5],
            "scale": [3.0, 0.5, 0.05],
            "name": "SYS_Bulkhead_Low",
            "collection": collection,
        },
    )

    # Context: Bulkhead Face (Vertical drop at X=32) - Thin Cube
    client.call_tool(
        "create_cube",
        {
            "location": [32, y_offset + 2, 3.75],
            "scale": [0.05, 0.5, 0.5],
            "name": "SYS_Bulkhead_Face",
            "collection": collection,
        },
    )

    client.call_tool(
        "build_cable_tray",
        {
            "points": [
                [29.0, y_offset + 2, 3.5],  # High level (0.5m below 4m ceiling)
                [31.8, y_offset + 2, 3.5],  # Near bulkhead
                [32.3, y_offset + 2, 3.0],  # 45-deg drop (0.5m offset)
                [35.0, y_offset + 2, 3.0],  # Low level (0.5m below 3.5m ceiling)
            ],
            "width": 0.2,
            "name": "SYS_Refined_Tray_Bulkhead",
            "auto_support_spacing": 1.0,
            "support_start_offset": 0.2,
            "collection": collection,
        },
    )
