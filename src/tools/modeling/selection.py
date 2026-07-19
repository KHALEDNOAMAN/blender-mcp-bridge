# src/tools/modeling/selection.py

from mcp import types


def get_selection_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="select_objects",
            description="Select objects by name. AVOID select-then-assign workflows: most tools (e.g. create_material) accept object names directly in one call.",
            inputSchema={
                "type": "object",
                "properties": {
                    "object_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of object names to select",
                    },
                    "active_object": {
                        "type": "string",
                        "description": "Optional name of the object to set as active",
                    },
                },
                "required": ["object_names"],
            },
        ),
        types.Tool(
            name="select_by_pattern",
            description="Select objects by name pattern. AVOID select-then-assign workflows: pass 'pattern' directly to create_material / assign_material / batch_transform instead, in one call.",
            inputSchema={
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern (e.g., 'Facade_Fin*' to select all objects starting with that name)",
                    },
                    "extend": {
                        "type": "boolean",
                        "default": False,
                        "description": "If true, add to current selection instead of replacing it.",
                    },
                },
                "required": ["pattern"],
            },
        ),
        types.Tool(
            name="select_by_collection",
            description="Select all objects within a specific collection.",
            inputSchema={
                "type": "object",
                "properties": {
                    "collection_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Exact names of the collections to select objects from",
                    },
                    "extend": {
                        "type": "boolean",
                        "default": False,
                        "description": "If true, add to current selection instead of replacing it.",
                    },
                },
                "required": ["collection_names"],
            },
        ),
        types.Tool(
            name="invert_mesh_selection",
            description="Invert selection of mesh components (verts/edges/faces) inside an object.",
            inputSchema={
                "type": "object",
                "properties": {
                    "object_name": {
                        "type": "string",
                        "description": "Object to invert selection in",
                    },
                },
                "required": ["object_name"],
            },
        ),
    ]
