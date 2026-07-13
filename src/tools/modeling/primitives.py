# src/tools/modeling/primitives.py

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
        types.Tool(
            name="create_watertight_plate",
            description=(
                "Build a WATERTIGHT extruded plate from a 2D outline with through-holes and "
                "engraved (recessed) regions - all in one indexed mesh, no boolean operations. "
                "Use this instead of create_polygon + boolean_operation for printable flat parts "
                "with holes or text: boolean cutouts routinely produce non-manifold meshes that "
                "slicers silently repair (deleting the holes/text). Returns is_watertight and "
                "non_manifold_edges in the payload - success is false if the mesh is not watertight."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Object name"},
                    "outline": {
                        "type": "array",
                        "items": {"type": "array", "items": {"type": "number"}},
                        "description": "Outer boundary as [[x,y], ...] in scene units (mm).",
                    },
                    "thickness": {
                        "type": "number",
                        "description": "Plate height; the solid spans z=0..thickness.",
                    },
                    "holes": {
                        "type": "array",
                        "items": {
                            "type": "array",
                            "items": {"type": "array", "items": {"type": "number"}},
                        },
                        "description": "Optional list of [[x,y],...] loops cut fully through.",
                    },
                    "circle_holes": {
                        "type": "array",
                        "items": {"type": "array", "items": {"type": "number"}},
                        "description": "Optional list of [cx, cy, r] circular through-holes.",
                    },
                    "engrave_regions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "outer": {
                                    "type": "array",
                                    "items": {"type": "array", "items": {"type": "number"}},
                                },
                                "holes": {
                                    "type": "array",
                                    "items": {
                                        "type": "array",
                                        "items": {"type": "array", "items": {"type": "number"}},
                                    },
                                },
                            },
                            "required": ["outer"],
                        },
                        "description": (
                            "Optional regions recessed from the TOP face by engrave_depth. "
                            "Each has an outer loop and optional hole loops (e.g. text glyph "
                            "contours + their counters). Use for engraved text: cut-through text "
                            "would drop the enclosed counters of letters like R/8/9."
                        ),
                    },
                    "engrave_depth": {
                        "type": "number",
                        "default": 0.6,
                        "description": "Recess depth from the top face for engrave_regions.",
                    },
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "XYZ world-space origin (default [0,0,0]).",
                    },
                    "collection": {
                        "type": "string",
                        "description": "Optional: collection to place the object in.",
                    },
                },
                "required": ["name", "outline", "thickness"],
            },
        ),
        types.Tool(
            name="create_polygon",
            description="Create a flat polygon mesh from exact vertex coordinates, then optionally extrude for thickness. Perfect for trapezoids, triangles, or any custom flat shape where you need precise control over each corner position.",
            inputSchema={
                "type": "object",
                "properties": {
                    "vertices": {
                        "type": "array",
                        "items": {
                            "type": "array",
                            "items": {"type": "number"},
                        },
                        "description": "List of [x, y] or [x, y, z] vertex positions defining the polygon outline (ordered CW or CCW). Values are in scene units (mm when scene is MILLIMETERS).",
                    },
                    "location": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "XYZ world-space origin for the object",
                    },
                    "extrude": {
                        "type": "number",
                        "description": "If > 0, extrude the polygon upward (+Z) by this amount to create a solid (in scene units).",
                        "default": 0,
                    },
                    "taper": {
                        "type": "number",
                        "description": "Optional: Scale multiplier applied to the extruded top face in X and Y relative to the centroid (e.g. 1.2 to flare outwards, 0.8 to taper inwards). Default is 1.0.",
                        "default": 1.0,
                    },
                    "top_vertices": {
                        "anyOf": [
                            {
                                "type": "array",
                                "items": {"type": "array", "items": {"type": "number"}},
                            },
                            {
                                "type": "array",
                                "items": {
                                    "type": "array",
                                    "items": {"type": "array", "items": {"type": "number"}},
                                },
                            },
                        ],
                        "description": "Optional: Exact coordinates of the top face vertices (2D array for a single layer, or 3D array of layers for multi-layer lofting).",
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
                "required": ["vertices", "location"],
            },
        ),
    ]
