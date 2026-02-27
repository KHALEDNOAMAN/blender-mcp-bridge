from tests.utils.mcp_client import MCPClient


def create_modifiers_row(client: MCPClient, y_offset: float = 10.0):
    print(f"Creating Modifiers Row at Y={y_offset}...")

    # 1. Apply Modifiers (Static Props)
    test_apply_modifiers(client, y_offset, "MOD_APPLY")

    # 2. Copy/Remove Modifiers
    test_copy_remove_modifiers(client, y_offset, "MOD_BATCH")

    # 3. Boolean Operations (High-level)
    test_boolean_ops(client, y_offset, "MOD_BOOLEAN")


def test_apply_modifiers(client: MCPClient, y_offset: float, collection: str):
    print(f"Running Apply Modifiers tests into {collection}...")
    client.call_tool("create_collection", {"name": collection})

    # Array (x=0)
    client.call_tool(
        "create_cube",
        {
            "size": 0.5,
            "location": [0.0, y_offset, 0.0],
            "name": "MOD_Array",
            "collection": collection,
        },
    )
    client.call_tool(
        "apply_modifier",
        {
            "modifier_type": "ARRAY",
            "name": "TestArray",
            "object_name": "MOD_Array",
            "count": 3,
            "use_relative_offset": True,
            "relative_offset_displace": [1.5, 0.0, 0.0],
        },
    )

    # Solidify (x=5)
    client.call_tool(
        "create_plane",
        {
            "size": 2.0,
            "location": [5.0, y_offset, 0.0],
            "name": "MOD_Solidify",
            "collection": collection,
        },
    )
    client.call_tool(
        "apply_modifier",
        {
            "modifier_type": "SOLIDIFY",
            "name": "TestSolidify",
            "object_name": "MOD_Solidify",
            "thickness": 0.3,
        },
    )

    # Bevel (x=10)
    client.call_tool(
        "create_cube",
        {
            "size": 2.0,
            "location": [10.0, y_offset, 0.0],
            "name": "MOD_Bevel",
            "collection": collection,
        },
    )
    client.call_tool(
        "apply_modifier",
        {
            "modifier_type": "BEVEL",
            "name": "TestBevel",
            "object_name": "MOD_Bevel",
            "width": 0.2,
            "segments": 3,
        },
    )

    # Mirror (x=15)
    client.call_tool(
        "create_cube",
        {
            "size": 0.1,
            "location": [15.0, y_offset + 2.5, 0.0],
            "name": "MOD_MirrorCenter_Y",
            "collection": collection,
        },
    )
    client.call_tool(
        "create_cube",
        {
            "size": 0.5,
            "location": [15.0, y_offset, 0.0],
            "name": "MOD_Mirror",
            "collection": collection,
        },
    )
    client.call_tool(
        "apply_modifier",
        {
            "modifier_type": "MIRROR",
            "name": "TestMirror",
            "object_name": "MOD_Mirror",
            "use_axis": [False, True, False],
            "mirror_object": "MOD_MirrorCenter_Y",
        },
    )

    # Subdiv (x=20)
    client.call_tool(
        "create_cube",
        {
            "size": 2.0,
            "location": [20.0, y_offset, 0.0],
            "name": "MOD_Subdiv",
            "collection": collection,
        },
    )
    client.call_tool(
        "apply_modifier",
        {
            "modifier_type": "SUBSURF",
            "name": "TestSubsurf",
            "object_name": "MOD_Subdiv",
            "levels": 2,
        },
    )

    # Wireframe (x=25)
    client.call_tool(
        "create_cube",
        {
            "size": 2.0,
            "location": [25.0, y_offset, 0.0],
            "name": "MOD_Wire",
            "collection": collection,
        },
    )
    client.call_tool(
        "apply_modifier",
        {
            "modifier_type": "WIREFRAME",
            "name": "TestWire",
            "object_name": "MOD_Wire",
            "thickness": 0.05,
        },
    )

    # Smooth (x=30)
    client.call_tool(
        "create_sphere",
        {
            "radius": 1.0,
            "location": [30.0, y_offset, 0.0],
            "name": "MOD_Smooth",
            "collection": collection,
        },
    )
    client.call_tool(
        "apply_modifier",
        {
            "modifier_type": "SMOOTH",
            "name": "TestSmooth",
            "object_name": "MOD_Smooth",
            "factor": 1.0,
            "iterations": 10,
        },
    )

    # Basic Boolean Modifier (x=35) - To distinguish from high-level tool
    # Use a Cylinder as cutter for a distinct visual difference
    client.call_tool(
        "create_cube",
        {
            "size": 2.0,
            "location": [35.0, y_offset, 0.0],
            "name": "MOD_BoolBasic_Base",
            "collection": collection,
        },
    )
    client.call_tool(
        "create_cylinder",
        {
            "radius": 0.7,
            "depth": 3.0,
            "location": [35.0, y_offset, 0.0],
            "name": "MOD_BoolBasic_Cutter",
            "collection": collection,
        },
    )
    client.call_tool(
        "apply_modifier",
        {
            "modifier_type": "BOOLEAN",
            "name": "TestBoolBasic",
            "object_name": "MOD_BoolBasic_Base",
            "object_b": "MOD_BoolBasic_Cutter",
            "operation": "DIFFERENCE",
            "hide_cutter": True,
        },
    )


def test_copy_remove_modifiers(
    client: MCPClient, y_offset: float, collection_name: str
):
    print(f"Running Modifier Removal tests in {collection_name}...")

    # 1. Create a Collection for the targets
    client.call_tool("create_collection", {"name": collection_name})

    # 2. Create Target cubes at x=40
    # Cube 1 at x=40, y_offset
    client.call_tool(
        "create_cube",
        {
            "size": 1.0,
            "location": [40.0, y_offset, 0.0],
            "name": "MOD_RemoveVerify_1",
            "collection": collection_name,
        },
    )
    # Cube 2 at x=40, y_offset+5
    client.call_tool(
        "create_cube",
        {
            "size": 1.0,
            "location": [40.0, y_offset + 5.0, 0.0],
            "name": "MOD_RemoveVerify_2",
            "collection": collection_name,
        },
    )

    # 3. Copy 'TestWire' from Source (x=25) to Target Collection
    client.call_tool(
        "copy_modifier",
        {
            "source_object": "MOD_Wire",
            "target_collection": collection_name,
            "modifier_name": "TestWire",
        },
    )

    # 4. Remove from Target 2 specifically
    # Result: Cube 1 (y_offset) still has Wireframe, Cube 2 (y_offset+5) is now Solid
    client.call_tool(
        "remove_modifier",
        {"object_name": "MOD_RemoveVerify_2", "modifier_name": "TestWire"},
    )


def test_boolean_ops(client: MCPClient, y_offset: float, collection: str):
    print(f"Running Boolean Operations tests into {collection}...")
    client.call_tool("create_collection", {"name": collection})

    # helper to create pair
    def create_pair(x, name):
        client.call_tool(
            "create_cube",
            {
                "size": 2.0,
                "location": [x, y_offset, 0.0],
                "name": f"{name}_Base",
                "collection": collection,
            },
        )
        client.call_tool(
            "create_sphere",
            {
                "radius": 1.2,
                "location": [x, y_offset, 1.0],
                "name": f"{name}_Cutter",
                "collection": collection,
            },
        )
        return f"{name}_Base", f"{name}_Cutter"

    # Intersect (x=45)
    b, c = create_pair(45, "Test_BoolOp_Intersect")
    client.call_tool(
        "boolean_operation", {"object_a": b, "object_b": c, "operation": "INTERSECT"}
    )

    # Union (x=50)
    b, c = create_pair(50, "Test_BoolOp_Union")
    client.call_tool(
        "boolean_operation", {"object_a": b, "object_b": c, "operation": "UNION"}
    )

    # Difference (x=55)
    b, c = create_pair(55, "Test_BoolOp_Diff")
    client.call_tool(
        "boolean_operation", {"object_a": b, "object_b": c, "operation": "DIFFERENCE"}
    )

    # Slice (x=60)
    # We'll slice a Sphere with an elongated Cube for a clear result
    client.call_tool(
        "create_sphere",
        {
            "radius": 1.5,
            "location": [60.0, y_offset, 0.0],
            "name": "MOD_BoolOp_Slice_Base",
            "collection": collection,
        },
    )
    client.call_tool(
        "create_cube",
        {
            "size": 1.0,
            "scale": [3.0, 0.2, 3.0],  # Elongated sheet
            "location": [60.0, y_offset, 0.0],
            "name": "MOD_BoolOp_Slice_Cutter",
            "collection": collection,
        },
    )

    client.call_tool(
        "boolean_operation",
        {
            "object_a": "MOD_BoolOp_Slice_Base",
            "object_b": "MOD_BoolOp_Slice_Cutter",
            "operation": "SLICE",
            "hide_cutter": True,
        },
    )

    # Resulting slice piece is 'MOD_BoolOp_Slice_Base_slice'
    client.call_tool(
        "transform_object",
        {
            "object_name": "MOD_BoolOp_Slice_Base_slice",
            "location": [60.0, y_offset, 2.5],  # Offset to see both pieces
            "hide_viewport": False,
        },
    )
