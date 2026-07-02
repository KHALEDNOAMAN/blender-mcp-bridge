from tests.utils.mcp_client import MCPClient


def print_collection_tree(coll, indent=0):
    """Recursively prints the collection hierarchy in a readable tree format."""
    name = coll.get("name", "Unknown")
    objs = coll.get("objects", [])
    prefix = "  " * indent + "∟ " if indent > 0 else ""
    obj_str = f" [{', '.join(objs)}]" if objs else ""
    print(f"{prefix}{name}{obj_str}")
    for child in coll.get("children", []):
        print_collection_tree(child, indent + 1)


def create_collections_row(client: MCPClient, y_offset: float = 20.0):
    """Creates objects within specific collections."""
    print(f"Creating Collections Row at Y={y_offset}...")

    collection_name = "COL_INTEGRATION"
    # Ensure collection exists (handled gracefully by tool if already exists)
    client.call_tool("create_collection", {"name": collection_name})

    # Create cube in collection
    client.call_tool(
        "create_cube",
        {
            "size": 2.0,
            "location": [0.0, y_offset, 0.0],
            "name": "COL_Cube",
            "collection": collection_name,
        },
    )

    # Create sphere and move to collection
    client.call_tool(
        "create_sphere",
        {
            "radius": 1.0,
            "location": [5.0, y_offset, 0.0],
            "name": "COL_Sphere",
        },
    )
    client.call_tool(
        "move_to_collection",
        {"object_names": ["COL_Sphere"], "target_collection": collection_name},
    )

    # Create cylinder OUTSIDE the collection (should not be duplicated)
    client.call_tool(
        "create_cylinder",
        {
            "radius": 0.5,
            "depth": 2.0,
            "location": [10.0, y_offset, 0.0],
            "name": "COL_Cylinder_Outside",
        },
    )

    # Verify collection tree
    coll_info = client.call_tool("get_collections", {})
    print("\nCollection Hierarchy:")
    if isinstance(coll_info, dict):
        print_collection_tree(coll_info)
    else:
        print(coll_info)
    print("")

    # Select objects in the collection using pattern
    client.call_tool("select_by_pattern", {"pattern": "COL_Cube"})
    client.call_tool("select_by_pattern", {"pattern": "COL_Sphere", "extend": True})

    # Set active collection
    client.call_tool("set_active_collection", {"collection_name": collection_name})

    # Duplicate selection - should duplicate only cube and sphere, not cylinder
    client.call_tool(
        "duplicate_selection",
        {
            "location_offset": [0.0, 5.0, 0.0],
        },
    )

    # Test remove_collection
    to_remove_coll = "COL_REMOVAL"
    client.call_tool(
        "move_to_collection",
        {
            "object_names": ["COL_Cylinder_Outside"],
            "target_collection": to_remove_coll,
        },
    )

    print("\nBefore removal:")
    coll_info_before = client.call_tool("get_collections", {})
    print_collection_tree(coll_info_before)

    client.call_tool("remove_collection", {"name": to_remove_coll, "delete_objects": True})

    print(f"\nAfter removal ({to_remove_coll} and its objects should be gone):")
    coll_info_after = client.call_tool("get_collections", {})
    print_collection_tree(coll_info_after)
