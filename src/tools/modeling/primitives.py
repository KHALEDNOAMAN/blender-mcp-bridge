from mcp import types


def get_primitive_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="create_cube",
            description="Create a cube mesh object or update an existing one if 'name' matches. TIP: Specify the 'collection' parameter directly here to save a step.",
            inputSchema={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "XYZ position",
                    },
                    "scale": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "XYZ scale multipliers (default [1,1,1])",
                    },
                    "size": {
                        "type": "number",
                        "description": "Optional: Uniform size of the cube (default 1.0).",
                    },
                    "dimensions": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional: Absolute XYZ dimensions in meters.",
                    },
                    "name": {"type": "string", "description": "Object name"},
                    "rotation": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional: Euler rotation in degrees [X, Y, Z]",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Optional: Name of the collection to move the object to.",
                    },
                },
                "required": ["location"],
            },
        ),
        types.Tool(
            name="create_cylinder",
            description="Create a cylinder mesh object or update an existing one if 'name' matches.",
            inputSchema={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "XYZ position",
                    },
                    "radius": {
                        "type": "number",
                        "description": "Radius of the cylinder",
                    },
                    "depth": {
                        "type": "number",
                        "description": "Height/depth of the cylinder",
                    },
                    "dimensions": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional: Absolute XYZ dimensions.",
                    },
                    "vertices": {
                        "type": "integer",
                        "description": "Number of segments (e.g., 32 or 64)",
                    },
                    "name": {"type": "string", "description": "Object name"},
                    "rotation": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional: Euler rotation in degrees [X, Y, Z]",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Optional: Name of the collection to move the object to.",
                    },
                },
                "required": ["location"],
            },
        ),
        types.Tool(
            name="create_icosphere",
            description="Create an Ico Sphere mesh object (Icosphere) or update an existing one if 'name' matches.",
            inputSchema={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "XYZ position",
                    },
                    "radius": {
                        "type": "number",
                        "description": "Radius of the sphere",
                        "default": 1.0,
                    },
                    "subdivisions": {
                        "type": "integer",
                        "description": "Smoothness (default 2)",
                        "default": 2,
                    },
                    "name": {"type": "string", "description": "Object name"},
                    "rotation": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional: Euler rotation in degrees [X, Y, Z]",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Optional: Name of the collection to move the object to.",
                    },
                },
                "required": ["location"],
            },
        ),
        types.Tool(
            name="create_sphere",
            description="Create a UV sphere mesh object or update an existing one if 'name' matches.",
            inputSchema={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "XYZ position",
                    },
                    "radius": {"type": "number", "description": "Radius of the sphere"},
                    "scale": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional: XYZ scale",
                    },
                    "name": {"type": "string", "description": "Object name"},
                    "rotation": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional: Euler rotation in degrees [X, Y, Z]",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Optional: Name of the collection to move the object to.",
                    },
                },
                "required": ["location", "radius"],
            },
        ),
        types.Tool(
            name="create_cone",
            description="Create a cone mesh object or update an existing one if 'name' matches.",
            inputSchema={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "XYZ position",
                    },
                    "radius1": {"type": "number", "description": "Base radius"},
                    "radius2": {"type": "number", "description": "Tip radius"},
                    "depth": {"type": "number", "description": "Depth (height)"},
                    "scale": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional: XYZ scale",
                    },
                    "name": {"type": "string", "description": "Object name"},
                    "rotation": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional: Euler rotation in degrees [X, Y, Z]",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Optional: Name of the collection to move the object to.",
                    },
                },
                "required": ["location"],
            },
        ),
        types.Tool(
            name="create_torus",
            description="Create a torus mesh object or update an existing one if 'name' matches.",
            inputSchema={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "XYZ position",
                    },
                    "major_radius": {
                        "type": "number",
                        "description": "Distance from center to center of tube",
                    },
                    "minor_radius": {
                        "type": "number",
                        "description": "Thickness of the tube (radius)",
                    },
                    "major_segments": {
                        "type": "integer",
                        "description": "Smoothness of the main ring",
                    },
                    "minor_segments": {
                        "type": "integer",
                        "description": "Smoothness of the tube circle",
                    },
                    "name": {"type": "string", "description": "Object name"},
                    "rotation": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional: Euler rotation in degrees [X, Y, Z]",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Optional: Name of the collection to move the object to.",
                    },
                },
                "required": ["location", "major_radius", "minor_radius"],
            },
        ),
        types.Tool(
            name="create_plane",
            description="Create a plane mesh object or update an existing one if 'name' matches.",
            inputSchema={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "XYZ position",
                    },
                    "size": {"type": "number", "description": "Size of the plane"},
                    "dimensions": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional: Absolute XYZ dimensions.",
                    },
                    "name": {"type": "string", "description": "Object name"},
                    "rotation": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Optional: Euler rotation in degrees [X, Y, Z]",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Optional: Name of the collection to move the object to.",
                    },
                },
                "required": ["location"],
            },
        ),
        types.Tool(
            name="create_text",
            description="Create 3D text (FONT object) or update existing one. Used for legends and labels.",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Text content"},
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "XYZ position",
                    },
                    "name": {"type": "string", "description": "Object name"},
                    "size": {
                        "type": "number",
                        "description": "Font size (radius)",
                        "default": 1.0,
                    },
                    "extrude": {
                        "type": "number",
                        "description": "3D thickness",
                        "default": 0.05,
                    },
                    "align_x": {
                        "type": "string",
                        "enum": ["LEFT", "CENTER", "RIGHT", "JUSTIFY", "FLUSH"],
                        "default": "LEFT",
                        "description": "Horizontal alignment",
                    },
                    "rotation": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Euler rotation in degrees [X, Y, Z]",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Optional: Name of the collection to move the object to.",
                    },
                },
                "required": ["text", "location"],
            },
        ),
        types.Tool(
            name="create_empty",
            description="Create an Empty object, often used for instancing collections or as rigging roots.",
            inputSchema={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "XYZ position",
                    },
                    "name": {"type": "string", "description": "Object name"},
                    "empty_display_type": {
                        "type": "string",
                        "enum": [
                            "PLAIN_AXES",
                            "ARROWS",
                            "SINGLE_ARROW",
                            "CIRCLE",
                            "CUBE",
                            "SPHERE",
                            "CONE",
                            "IMAGE",
                        ],
                        "default": "PLAIN_AXES",
                        "description": "Visual representation of the Empty",
                    },
                    "empty_display_size": {
                        "type": "number",
                        "default": 1.0,
                        "description": "Size of the Empty representation",
                    },
                    "instance_collection": {
                        "type": "string",
                        "description": "Optional: Collection to instance on this Empty",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Optional: Name of the collection to move the empty to.",
                    },
                    "hide_viewport": {
                        "type": "boolean",
                        "description": "If true, hides the object in the viewport.",
                        "default": False,
                    },
                    "hide_render": {
                        "type": "boolean",
                        "description": "If true, hides the object in renders.",
                        "default": False,
                    },
                },
                "required": ["location"],
            },
        ),
    ]
