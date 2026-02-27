from mcp import types


def get_collection_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="create_collection",
            description="Create a new collection in the scene",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Collection name"},
                    "parent_collection": {
                        "type": "string",
                        "description": "Optional parent collection name",
                    },
                },
                "required": ["name"],
            },
        ),
        types.Tool(
            name="set_active_collection",
            description="Set the active collection for new objects",
            inputSchema={
                "type": "object",
                "properties": {
                    "collection_name": {
                        "type": "string",
                        "description": "Collection name to make active",
                    }
                },
                "required": ["collection_name"],
            },
        ),
        types.Tool(
            name="move_to_collection",
            description="Move objects to a collection",
            inputSchema={
                "type": "object",
                "properties": {
                    "object_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Specific object names to move",
                    },
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern for bulk moving (e.g. 'Rack_*')",
                    },
                    "collection_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Source collections to move objects from",
                    },
                    "target_collection": {
                        "type": "string",
                        "description": "Destination collection",
                    },
                    "keep_hierarchy": {
                        "type": "boolean",
                        "description": "If true, moves the source collections themselves into the target collection instead of flattening objects. (Only applies to collection_names)",
                        "default": False,
                    },
                    "remove_original_collections": {
                        "type": "boolean",
                        "description": "If true and keep_hierarchy is false, deletes the original collections after moving their objects. (Only applies to collection_names)",
                        "default": False,
                    },
                },
                "required": ["target_collection"],
            },
        ),
        types.Tool(
            name="get_collections",
            description="Get hierarchy of all collections in the scene",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="remove_collection",
            description="Remove a collection and optionally its contents.",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Specific collection to remove",
                    },
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern for bulk removal (e.g. 'Test_*')",
                    },
                    "delete_objects": {
                        "type": "boolean",
                        "description": "Whether to also delete objects inside the collection(s)",
                        "default": True,
                    },
                },
            },
        ),
        types.Tool(
            name="duplicate_collection",
            description="Duplicate an entire collection hierarchy including all nested objects and collections.",
            inputSchema={
                "type": "object",
                "properties": {
                    "collection_name": {
                        "type": "string",
                        "description": "Name of the collection to duplicate",
                    },
                    "new_name": {
                        "type": "string",
                        "description": "Optional: New name for the top-level duplicated collection.",
                    },
                    "target_parent": {
                        "type": "string",
                        "description": "Optional parent collection for the new duplicated hierarchy",
                    },
                    "copy_contents_only": {
                        "type": "boolean",
                        "description": "If true, duplicates only the contents of the source collection into the target_parent, skipping the top-level collection folder.",
                        "default": False,
                    },
                    "location_offset": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Offset to apply to all duplicated objects",
                    },
                    "rotation_offset": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Rotation offset (in degrees) to apply to all duplicated objects",
                    },
                },
                "required": ["collection_name"],
            },
        ),
        types.Tool(
            name="set_collection_visibility",
            description="Toggle visibility of a collection in the viewport and/or render.",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Collection name"},
                    "hide_viewport": {
                        "type": "boolean",
                        "description": "Hide in viewport",
                    },
                    "hide_render": {
                        "type": "boolean",
                        "description": "Hide in render",
                    },
                },
                "required": ["name"],
            },
        ),
    ]
