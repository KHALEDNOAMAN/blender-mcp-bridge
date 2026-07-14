/**
 * Static snapshot of the bridge's tools/list response, extracted from a
 * live bridge for demo mode (docs/studio_design_v1.md section 9), where no
 * real Blender is reachable to ask for a live list (e.g. Studio deployed
 * standalone on GitHub Pages). Powers the Add/Edit Command schema-driven
 * forms so they work identically in demo mode as they do live; only the
 * actual dispatch (lib/demoApi.js) is simulated, not the tool catalog.
 *
 * Not auto-generated on build -- refresh manually by running the bridge
 * locally and re-fetching POST /mcp/ tools/list if tool schemas change.
 */
export const DEMO_TOOLS = [
    {
        "name": "get_scene_info",
        "description": "Get information about the current Blender scene",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "get_object_info",
        "description": "Get detailed information about a specific object",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Object name"
                }
            },
            "required": [
                "name"
            ]
        }
    },
    {
        "name": "get_distance",
        "description": "Measure the distance between two objects.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_a": {
                    "type": "string"
                },
                "object_b": {
                    "type": "string"
                },
                "mode": {
                    "type": "string",
                    "enum": [
                        "CENTER",
                        "VERTICAL",
                        "HORIZONTAL"
                    ],
                    "default": "CENTER"
                }
            },
            "required": [
                "object_a",
                "object_b"
            ]
        }
    },
    {
        "name": "get_viewport_screenshot",
        "description": "Capture a screenshot of the 3D viewport.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "max_size": {
                    "type": "integer",
                    "default": 800
                }
            }
        }
    },
    {
        "name": "get_debug_info",
        "description": "Get diagnostic information about the server.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "create_collection",
        "description": "Create a new collection in the scene",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Collection name"
                },
                "parent_collection": {
                    "type": "string",
                    "description": "Optional parent collection name"
                }
            },
            "required": [
                "name"
            ]
        }
    },
    {
        "name": "set_active_collection",
        "description": "Set the active collection for new objects",
        "inputSchema": {
            "type": "object",
            "properties": {
                "collection_name": {
                    "type": "string",
                    "description": "Collection name to make active"
                }
            },
            "required": [
                "collection_name"
            ]
        }
    },
    {
        "name": "move_to_collection",
        "description": "Move objects to a collection",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_names": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Specific object names to move"
                },
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern for bulk moving (e.g. 'Rack_*')"
                },
                "collection_names": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Source collections to move objects from"
                },
                "target_collection": {
                    "type": "string",
                    "description": "Destination collection"
                },
                "keep_hierarchy": {
                    "type": "boolean",
                    "description": "If true, moves the source collections themselves into the target collection instead of flattening objects. (Only applies to collection_names)",
                    "default": false
                },
                "remove_original_collections": {
                    "type": "boolean",
                    "description": "If true and keep_hierarchy is false, deletes the original collections after moving their objects. (Only applies to collection_names)",
                    "default": false
                }
            },
            "required": [
                "target_collection"
            ]
        }
    },
    {
        "name": "get_collections",
        "description": "Get hierarchy of all collections in the scene",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "remove_collection",
        "description": "Remove a collection and optionally its contents.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Specific collection to remove"
                },
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern for bulk removal (e.g. 'Test_*')"
                },
                "delete_objects": {
                    "type": "boolean",
                    "description": "Whether to also delete objects inside the collection(s)",
                    "default": true
                }
            }
        }
    },
    {
        "name": "duplicate_collection",
        "description": "Duplicate an entire collection hierarchy including all nested objects and collections.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "collection_name": {
                    "type": "string",
                    "description": "Name of the collection to duplicate"
                },
                "new_name": {
                    "type": "string",
                    "description": "Optional: New name for the top-level duplicated collection."
                },
                "target_parent": {
                    "type": "string",
                    "description": "Optional parent collection for the new duplicated hierarchy"
                },
                "copy_contents_only": {
                    "type": "boolean",
                    "description": "If true, duplicates only the contents of the source collection into the target_parent, skipping the top-level collection folder.",
                    "default": false
                },
                "location_offset": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Offset to apply to all duplicated objects"
                },
                "rotation_offset": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Rotation offset (in degrees) to apply to all duplicated objects"
                }
            },
            "required": [
                "collection_name"
            ]
        }
    },
    {
        "name": "set_collection_visibility",
        "description": "Toggle visibility of a collection in the viewport and/or render.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Collection name"
                },
                "hide_viewport": {
                    "type": "boolean",
                    "description": "Hide in viewport"
                },
                "hide_render": {
                    "type": "boolean",
                    "description": "Hide in render"
                }
            },
            "required": [
                "name"
            ]
        }
    },
    {
        "name": "create_cube",
        "description": "Create a cube mesh object or update an existing one if 'name' matches. TIP: Specify the 'collection' parameter directly here to save a step.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ position"
                },
                "scale": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ scale multipliers (default [1,1,1])"
                },
                "size": {
                    "type": "number",
                    "description": "Optional: Uniform size of the cube (default 1.0)."
                },
                "dimensions": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Absolute XYZ dimensions in meters."
                },
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Euler rotation in degrees [X, Y, Z]"
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Name of the collection to move the object to."
                }
            },
            "required": [
                "location"
            ]
        }
    },
    {
        "name": "create_cylinder",
        "description": "Create a cylinder mesh object or update an existing one if 'name' matches.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ position"
                },
                "radius": {
                    "type": "number",
                    "description": "Radius of the cylinder"
                },
                "depth": {
                    "type": "number",
                    "description": "Height/depth of the cylinder"
                },
                "dimensions": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Absolute XYZ dimensions."
                },
                "vertices": {
                    "type": "integer",
                    "description": "Number of segments (e.g., 32 or 64)"
                },
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Euler rotation in degrees [X, Y, Z]"
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Name of the collection to move the object to."
                }
            },
            "required": [
                "location"
            ]
        }
    },
    {
        "name": "create_icosphere",
        "description": "Create an Ico Sphere mesh object (Icosphere) or update an existing one if 'name' matches.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ position"
                },
                "radius": {
                    "type": "number",
                    "description": "Radius of the sphere",
                    "default": 1.0
                },
                "subdivisions": {
                    "type": "integer",
                    "description": "Smoothness (default 2)",
                    "default": 2
                },
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Euler rotation in degrees [X, Y, Z]"
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Name of the collection to move the object to."
                }
            },
            "required": [
                "location"
            ]
        }
    },
    {
        "name": "create_sphere",
        "description": "Create a UV sphere mesh object or update an existing one if 'name' matches.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ position"
                },
                "radius": {
                    "type": "number",
                    "description": "Radius of the sphere"
                },
                "scale": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: XYZ scale"
                },
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Euler rotation in degrees [X, Y, Z]"
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Name of the collection to move the object to."
                }
            },
            "required": [
                "location",
                "radius"
            ]
        }
    },
    {
        "name": "create_cone",
        "description": "Create a cone mesh object or update an existing one if 'name' matches.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ position"
                },
                "radius1": {
                    "type": "number",
                    "description": "Base radius"
                },
                "radius2": {
                    "type": "number",
                    "description": "Tip radius"
                },
                "depth": {
                    "type": "number",
                    "description": "Depth (height)"
                },
                "scale": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: XYZ scale"
                },
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Euler rotation in degrees [X, Y, Z]"
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Name of the collection to move the object to."
                }
            },
            "required": [
                "location"
            ]
        }
    },
    {
        "name": "create_torus",
        "description": "Create a torus mesh object or update an existing one if 'name' matches.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ position"
                },
                "major_radius": {
                    "type": "number",
                    "description": "Distance from center to center of tube"
                },
                "minor_radius": {
                    "type": "number",
                    "description": "Thickness of the tube (radius)"
                },
                "major_segments": {
                    "type": "integer",
                    "description": "Smoothness of the main ring"
                },
                "minor_segments": {
                    "type": "integer",
                    "description": "Smoothness of the tube circle"
                },
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Euler rotation in degrees [X, Y, Z]"
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Name of the collection to move the object to."
                }
            },
            "required": [
                "location",
                "major_radius",
                "minor_radius"
            ]
        }
    },
    {
        "name": "create_plane",
        "description": "Create a plane mesh object or update an existing one if 'name' matches.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ position"
                },
                "size": {
                    "type": "number",
                    "description": "Size of the plane"
                },
                "dimensions": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Absolute XYZ dimensions."
                },
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Euler rotation in degrees [X, Y, Z]"
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Name of the collection to move the object to."
                }
            },
            "required": [
                "location"
            ]
        }
    },
    {
        "name": "create_text",
        "description": "Create 3D text (FONT object) or update existing one. Used for legends and labels.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "Text content"
                },
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ position"
                },
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
                "size": {
                    "type": "number",
                    "description": "Font size (radius)",
                    "default": 1.0
                },
                "extrude": {
                    "type": "number",
                    "description": "3D thickness",
                    "default": 0.05
                },
                "align_x": {
                    "type": "string",
                    "enum": [
                        "LEFT",
                        "CENTER",
                        "RIGHT",
                        "JUSTIFY",
                        "FLUSH"
                    ],
                    "default": "LEFT",
                    "description": "Horizontal alignment"
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Euler rotation in degrees [X, Y, Z]"
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Name of the collection to move the object to."
                }
            },
            "required": [
                "text",
                "location"
            ]
        }
    },
    {
        "name": "create_empty",
        "description": "Create an Empty object, often used for instancing collections or as rigging roots.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ position"
                },
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
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
                        "IMAGE"
                    ],
                    "default": "PLAIN_AXES",
                    "description": "Visual representation of the Empty"
                },
                "empty_display_size": {
                    "type": "number",
                    "default": 1.0,
                    "description": "Size of the Empty representation"
                },
                "instance_collection": {
                    "type": "string",
                    "description": "Optional: Collection to instance on this Empty"
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Name of the collection to move the empty to."
                },
                "hide_viewport": {
                    "type": "boolean",
                    "description": "If true, hides the object in the viewport.",
                    "default": false
                },
                "hide_render": {
                    "type": "boolean",
                    "description": "If true, hides the object in renders.",
                    "default": false
                }
            },
            "required": [
                "location"
            ]
        }
    },
    {
        "name": "create_watertight_plate",
        "description": "Build a WATERTIGHT extruded plate from a 2D outline with through-holes and engraved (recessed) regions - all in one indexed mesh, no boolean operations. Use this instead of create_polygon + boolean_operation for printable flat parts with holes or text: boolean cutouts routinely produce non-manifold meshes that slicers silently repair (deleting the holes/text). Returns is_watertight and non_manifold_edges in the payload - success is false if the mesh is not watertight.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
                "outline": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "number"
                        }
                    },
                    "description": "Outer boundary as [[x,y], ...] in scene units (mm)."
                },
                "thickness": {
                    "type": "number",
                    "description": "Plate height; the solid spans z=0..thickness."
                },
                "holes": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "number"
                            }
                        }
                    },
                    "description": "Optional list of [[x,y],...] loops cut fully through."
                },
                "circle_holes": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "number"
                        }
                    },
                    "description": "Optional list of [cx, cy, r] circular through-holes."
                },
                "engrave_regions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "outer": {
                                "type": "array",
                                "items": {
                                    "type": "array",
                                    "items": {
                                        "type": "number"
                                    }
                                }
                            },
                            "holes": {
                                "type": "array",
                                "items": {
                                    "type": "array",
                                    "items": {
                                        "type": "array",
                                        "items": {
                                            "type": "number"
                                        }
                                    }
                                }
                            }
                        },
                        "required": [
                            "outer"
                        ]
                    },
                    "description": "Optional regions recessed from the TOP face by engrave_depth. Each has an outer loop and optional hole loops (e.g. text glyph contours + their counters). Use for engraved text: cut-through text would drop the enclosed counters of letters like R/8/9."
                },
                "engrave_depth": {
                    "type": "number",
                    "default": 0.6,
                    "description": "Recess depth from the top face for engrave_regions."
                },
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ world-space origin (default [0,0,0])."
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: collection to place the object in."
                }
            },
            "required": [
                "name",
                "outline",
                "thickness"
            ]
        }
    },
    {
        "name": "create_polygon",
        "description": "Create a flat polygon mesh from exact vertex coordinates, then optionally extrude for thickness. Perfect for trapezoids, triangles, or any custom flat shape where you need precise control over each corner position.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vertices": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "number"
                        }
                    },
                    "description": "List of [x, y] or [x, y, z] vertex positions defining the polygon outline (ordered CW or CCW). Values are in scene units (mm when scene is MILLIMETERS)."
                },
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ world-space origin for the object"
                },
                "extrude": {
                    "type": "number",
                    "description": "If > 0, extrude the polygon upward (+Z) by this amount to create a solid (in scene units).",
                    "default": 0
                },
                "taper": {
                    "type": "number",
                    "description": "Optional: Scale multiplier applied to the extruded top face in X and Y relative to the centroid (e.g. 1.2 to flare outwards, 0.8 to taper inwards). Default is 1.0.",
                    "default": 1.0
                },
                "top_vertices": {
                    "anyOf": [
                        {
                            "type": "array",
                            "items": {
                                "type": "array",
                                "items": {
                                    "type": "number"
                                }
                            }
                        },
                        {
                            "type": "array",
                            "items": {
                                "type": "array",
                                "items": {
                                    "type": "array",
                                    "items": {
                                        "type": "number"
                                    }
                                }
                            }
                        }
                    ],
                    "description": "Optional: Exact coordinates of the top face vertices (2D array for a single layer, or 3D array of layers for multi-layer lofting)."
                },
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Euler rotation in degrees [X, Y, Z]"
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Name of the collection to move the object to."
                }
            },
            "required": [
                "vertices",
                "location"
            ]
        }
    },
    {
        "name": "apply_modifier",
        "description": "POWER TIP: Use 'target_objects' to add AND sync this modifier to multiple objects in ONE call! This is much faster than adding modifiers one-by-one or using copy_modifier.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Primary object to add modifier to"
                },
                "modifier_type": {
                    "type": "string",
                    "description": "ARRAY, SOLIDIFY, BEVEL, MIRROR, SUBSURF, WIREFRAME, SMOOTH, BOOLEAN, etc."
                },
                "name": {
                    "type": "string",
                    "description": "Optional custom name for the modifier"
                },
                "target_objects": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "List of additional object names to sync this modifier to."
                },
                "count": {
                    "type": "integer",
                    "description": "For ARRAY: number of copies"
                },
                "use_relative_offset": {
                    "type": "boolean",
                    "description": "For ARRAY"
                },
                "use_constant_offset": {
                    "type": "boolean",
                    "description": "For ARRAY"
                },
                "constant_offset_displace": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "For ARRAY: XYZ offset"
                },
                "relative_offset_displace": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "For ARRAY: Relative XYZ offset"
                },
                "thickness": {
                    "type": "number",
                    "description": "For SOLIDIFY, WIREFRAME"
                },
                "offset": {
                    "type": "number",
                    "description": "For SOLIDIFY"
                },
                "width": {
                    "type": "number",
                    "description": "For BEVEL"
                },
                "segments": {
                    "type": "integer",
                    "description": "For BEVEL"
                },
                "use_clamp_overlap": {
                    "type": "boolean",
                    "description": "For BEVEL"
                },
                "levels": {
                    "type": "integer",
                    "description": "For SUBSURF"
                },
                "render_levels": {
                    "type": "integer",
                    "description": "For SUBSURF"
                },
                "use_axis": {
                    "type": "array",
                    "items": {
                        "type": "boolean"
                    },
                    "description": "For MIRROR: List of 3 booleans [X, Y, Z]"
                },
                "mirror_object": {
                    "type": "string",
                    "description": "For MIRROR: Object to use as mirror center"
                },
                "use_replace_original": {
                    "type": "boolean",
                    "description": "For WIREFRAME"
                },
                "factor": {
                    "type": "number",
                    "description": "For SMOOTH"
                },
                "iterations": {
                    "type": "integer",
                    "description": "For SMOOTH"
                },
                "object_b": {
                    "type": "string",
                    "description": "For BOOLEAN: Cutter object"
                },
                "operation": {
                    "type": "string",
                    "enum": [
                        "INTERSECT",
                        "UNION",
                        "DIFFERENCE",
                        "N.A"
                    ],
                    "default": "N.A",
                    "description": "For BOOLEAN"
                },
                "solver": {
                    "type": "string",
                    "enum": [
                        "FLOAT",
                        "EXACT",
                        "N.A"
                    ],
                    "default": "N.A",
                    "description": "For BOOLEAN"
                },
                "hide_cutter": {
                    "type": "boolean",
                    "default": true,
                    "description": "For BOOLEAN: Hide the cutter object"
                }
            },
            "required": [
                "object_name",
                "modifier_type"
            ]
        }
    },
    {
        "name": "remove_modifier",
        "description": "Remove a modifier from an object",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Name of the object to remove modifier from"
                },
                "modifier_name": {
                    "type": "string",
                    "description": "Name of the modifier to remove"
                }
            },
            "required": [
                "object_name",
                "modifier_name"
            ]
        }
    },
    {
        "name": "copy_modifier",
        "description": "Copy a modifier from a source object to target objects.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "source_object": {
                    "type": "string",
                    "description": "Name of the object that has the modifier"
                },
                "target_objects": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "List of object names to copy to"
                },
                "target_collection": {
                    "type": "string",
                    "description": "Name of collection. All objects in it will be targets."
                },
                "modifier_name": {
                    "type": "string",
                    "description": "Exact name of the modifier to copy."
                }
            },
            "required": [
                "source_object",
                "modifier_name"
            ]
        }
    },
    {
        "name": "boolean_operation",
        "description": "Perform a boolean operation between objects or collections.\nGUIDANCE:\n- Use 'SLICE' to cut a hole AND keep the resulting piece as a new object.\n- Use operand_type='COLLECTION' to use all objects in a collection as cutters at once.\n- CRITICAL: object_a must NOT be in collection object_b. Submitting an object's own collection as a cutter will result in self-subtraction (object disappearing).\n- 'EXACT' solver is recommended for most operations.\n- The cutter is automatically hidden from viewport and render by default.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_a": {
                    "type": "string",
                    "description": "Base object name"
                },
                "object_b": {
                    "type": "string",
                    "description": "Operand name (Object or Collection name)"
                },
                "operation": {
                    "type": "string",
                    "enum": [
                        "INTERSECT",
                        "UNION",
                        "DIFFERENCE",
                        "SLICE"
                    ],
                    "description": "Operation type. SLICE is custom: Difference + Intersection result."
                },
                "operand_type": {
                    "type": "string",
                    "enum": [
                        "OBJECT",
                        "COLLECTION"
                    ],
                    "default": "OBJECT",
                    "description": "Whether object_b is a single object or a collection of objects."
                },
                "solver": {
                    "type": "string",
                    "enum": [
                        "FLOAT",
                        "EXACT",
                        "MANIFOLD",
                        "N.A"
                    ],
                    "default": "EXACT",
                    "description": "Solver algorithm: FLOAT (legacy/fast), EXACT (reliable), MANIFOLD (mesh-safe)"
                },
                "hide_cutter": {
                    "type": "boolean",
                    "default": true,
                    "description": "Hide the cutter object after operation"
                }
            },
            "required": [
                "object_a",
                "object_b",
                "operation"
            ]
        }
    },
    {
        "name": "duplicate_object",
        "description": "POWER TIP: Use this tool to rename, move, and remove modifiers in ONE call! This is much faster than using multiple tools. Best for duplicating floors, slabs, or windows that need immediate placement and cleanup.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Object to duplicate"
                },
                "new_name": {
                    "type": "string",
                    "description": "New name for the duplicate"
                },
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: New XYZ location"
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: New XYZ rotation in degrees"
                },
                "scale": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: New XYZ scale"
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Move the duplicate to this collection"
                },
                "remove_modifiers": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Optional: List of modifier names to remove"
                },
                "linked": {
                    "type": "boolean",
                    "description": "Create linked duplicate (shares data)"
                },
                "hide_viewport": {
                    "type": "boolean",
                    "description": "Hide from viewport"
                },
                "hide_render": {
                    "type": "boolean",
                    "description": "Hide from render"
                }
            },
            "required": [
                "object_name"
            ]
        }
    },
    {
        "name": "duplicate_selection",
        "description": "Duplicate all currently selected objects with optional transformations. Useful for testing set_active_collection or batch duplication workflows.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location_offset": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: XYZ offset to apply to all duplicates"
                },
                "count": {
                    "type": "integer",
                    "description": "Optional: Number of duplicates to create in a linear array. Offsets are multiplied by the count step."
                },
                "rotation_offset": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: XYZ rotation offset in degrees"
                },
                "scale": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: XYZ scale for duplicates"
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Move duplicates to this collection"
                },
                "remove_modifiers": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Optional: List of modifier names to remove from duplicates"
                }
            }
        }
    },
    {
        "name": "transform_object",
        "description": "Transform an existing object's position, rotation, or scale. Supports bulk transformation via pattern.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Name of the object to transform"
                },
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern for bulk transformation (e.g. 'Rack_*')"
                },
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Absolute XYZ position"
                },
                "location_offset": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Relative XYZ translation amount"
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ rotation in degrees"
                },
                "rotation_offset": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Relative XYZ rotation amount in degrees"
                },
                "scale": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Absolute XYZ scale."
                },
                "hide_viewport": {
                    "type": "boolean",
                    "description": "Hide from viewport"
                },
                "hide_render": {
                    "type": "boolean",
                    "description": "Hide from render"
                }
            }
        }
    },
    {
        "name": "set_object_dimensions",
        "description": "Set exact world-space bounding box dimensions for an object, in meters. Rotation-safe: works correctly regardless of the object's current rotation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string"
                },
                "x": {
                    "type": "number"
                },
                "y": {
                    "type": "number"
                },
                "z": {
                    "type": "number"
                }
            },
            "required": [
                "object_name",
                "x",
                "y",
                "z"
            ]
        }
    },
    {
        "name": "apply_all_modifiers",
        "description": "Permanently apply all modifiers (like Booleans) on an object, baking their effects into the mesh data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Name of the object to apply modifiers on"
                }
            },
            "required": [
                "object_name"
            ]
        }
    },
    {
        "name": "batch_transform",
        "description": "Transform multiple existing objects with different positions/rotations/scales.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "transforms": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "object_name": {
                                "type": "string"
                            },
                            "location": {
                                "type": "array",
                                "items": {
                                    "type": "number"
                                }
                            },
                            "rotation": {
                                "type": "array",
                                "items": {
                                    "type": "number"
                                }
                            },
                            "scale": {
                                "type": "array",
                                "items": {
                                    "type": "number"
                                }
                            }
                        },
                        "required": [
                            "object_name"
                        ]
                    }
                }
            },
            "required": [
                "transforms"
            ]
        }
    },
    {
        "name": "apply_transforms",
        "description": "Bake scale, rotation, and/or location transforms into mesh vertex data. Crucial before boolean operations or joining objects with non-unit scale.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_names": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "List of object names to apply transforms on"
                },
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern to select objects (e.g. 'Frame*')"
                },
                "location": {
                    "type": "boolean",
                    "default": false,
                    "description": "Bake location transform"
                },
                "rotation": {
                    "type": "boolean",
                    "default": true,
                    "description": "Bake rotation transform"
                },
                "scale": {
                    "type": "boolean",
                    "default": true,
                    "description": "Bake scale transform"
                }
            }
        }
    },
    {
        "name": "select_objects",
        "description": "[WORKFLOW WARNING] Avoid using this for sequential 'Select -> Assign' workflows as it increases API turns and hits rate limits. Many tools (like 'create_material') now accept object names directly.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_names": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "List of object names to select"
                },
                "active_object": {
                    "type": "string",
                    "description": "Optional name of the object to set as active"
                }
            },
            "required": [
                "object_names"
            ]
        }
    },
    {
        "name": "select_by_pattern",
        "description": "[WORKFLOW WARNING] Avoid using this for sequential 'Select -> Assign' workflows. Instead, use the 'pattern' parameter directly in tools like 'create_material', 'assign_material', or 'batch_transform' to complete the task in ONE TURN and avoid rate limits.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern (e.g., 'Facade_Fin*' to select all objects starting with that name)"
                },
                "extend": {
                    "type": "boolean",
                    "default": false,
                    "description": "If true, add to current selection instead of replacing it."
                }
            },
            "required": [
                "pattern"
            ]
        }
    },
    {
        "name": "select_by_collection",
        "description": "Select all objects within a specific collection.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "collection_names": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Exact names of the collections to select objects from"
                },
                "extend": {
                    "type": "boolean",
                    "default": false,
                    "description": "If true, add to current selection instead of replacing it."
                }
            },
            "required": [
                "collection_names"
            ]
        }
    },
    {
        "name": "invert_mesh_selection",
        "description": "Invert selection of mesh components (verts/edges/faces) inside an object.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Object to invert selection in"
                }
            },
            "required": [
                "object_name"
            ]
        }
    },
    {
        "name": "circular_array",
        "description": "Create objects arranged in a circular/radial pattern (ring, circle, around a point).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Name of the object to duplicate"
                },
                "count": {
                    "type": "integer",
                    "description": "Total number of objects in the final array"
                },
                "radius": {
                    "type": "number",
                    "description": "Radius of the circle"
                },
                "center": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ center of the circle"
                },
                "start_angle": {
                    "type": "number",
                    "description": "Starting angle in degrees"
                },
                "axis": {
                    "type": "string",
                    "description": "Axis of rotation (X, Y, or Z)",
                    "enum": [
                        "X",
                        "Y",
                        "Z"
                    ]
                },
                "use_radial_rotation": {
                    "type": "boolean",
                    "description": "Face the center of the ring",
                    "default": true
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Place copies in this collection"
                },
                "join_immediately": {
                    "type": "boolean",
                    "default": false,
                    "description": "If true, joins all generated copies into a single mesh immediately."
                },
                "joined_name": {
                    "type": "string",
                    "description": "Name for the joined object if join_immediately is true."
                }
            },
            "required": [
                "object_name",
                "count",
                "radius"
            ]
        }
    },
    {
        "name": "join_objects",
        "description": "POWER TIP: Use this after 'select_by_pattern' to merge many repetitive objects into one! If 'object_names' is omitted, it joins all currently selected objects. Highly recommended for cleaning up fins, windows, or structural repetitive elements.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_names": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Optional: List of object names to join. If omitted, joins current selection."
                },
                "active_object": {
                    "type": "string",
                    "description": "Optional: Object that will receive the mesh of others."
                },
                "new_name": {
                    "type": "string",
                    "description": "Optional: New name for the joined object"
                }
            }
        }
    },
    {
        "name": "create_and_array",
        "description": "Create a primitive with a linear array modifier.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "primitive_type": {
                    "type": "string",
                    "description": "cube, cylinder, sphere, or torus"
                },
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ position"
                },
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
                "collection": {
                    "type": "string",
                    "description": "Optional: Move the created object to this collection"
                },
                "array_count": {
                    "type": "integer",
                    "description": "Number of copies"
                },
                "array_offset": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ offset between copies"
                },
                "scale": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ scale"
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ rotation in degrees"
                },
                "dimensions": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Absolute XYZ dimensions in metres."
                },
                "radius": {
                    "type": "number",
                    "description": "Radius for spheres/cylinders"
                },
                "depth": {
                    "type": "number",
                    "description": "Depth/Height for cylinders"
                },
                "vertices": {
                    "type": "integer",
                    "description": "Number of segments/vertices"
                },
                "major_radius": {
                    "type": "number",
                    "description": "Distance from center to center of tube for Torus"
                },
                "minor_radius": {
                    "type": "number",
                    "description": "Thickness of the tube for Torus"
                },
                "major_segments": {
                    "type": "integer",
                    "description": "Smoothness of the main ring for Torus"
                },
                "minor_segments": {
                    "type": "integer",
                    "description": "Smoothness of the tube circle for Torus"
                }
            },
            "required": [
                "primitive_type",
                "location"
            ]
        }
    },
    {
        "name": "random_distribute",
        "description": "Randomly distribute copies of an object within a ring or volume. PRO TIP: Distribution occurs around the 'center' parameter or the source object's location if center is omitted (not necessarily the world origin).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Name of the object to distribute"
                },
                "count": {
                    "type": "integer",
                    "description": "Number of random copies to create"
                },
                "min_distance": {
                    "type": "number",
                    "description": "Minimum distance from center"
                },
                "max_distance": {
                    "type": "number",
                    "description": "Maximum distance from center"
                },
                "center": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: XYZ center of distribution. Defaults to object location."
                },
                "z_position": {
                    "type": "number",
                    "default": 0.0,
                    "description": "Vertical position for the distribution"
                },
                "seed": {
                    "type": "integer",
                    "description": "Random seed for reproducible results"
                }
            },
            "required": [
                "object_name",
                "count",
                "min_distance",
                "max_distance"
            ]
        }
    },
    {
        "name": "extrude_mesh",
        "description": "Extrude mesh geometry (vertices, edges, or faces). PRO TIP: Use 'filter_normal' (e.g. [0,0,1] for top) to extrude specific parts of an object instead of the whole thing.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Object to extrude"
                },
                "mode": {
                    "type": "string",
                    "enum": [
                        "VERTS",
                        "EDGES",
                        "FACES"
                    ],
                    "default": "FACES",
                    "description": "Selection mode for extrusion"
                },
                "move": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "XYZ translation after extrusion"
                },
                "filter_normal": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Only extrude faces pointing in this direction (XYZ normal)"
                },
                "angle_threshold": {
                    "type": "number",
                    "default": 1.0,
                    "description": "Angle threshold in degrees for normal filtering"
                },
                "use_selection": {
                    "type": "boolean",
                    "default": false,
                    "description": "If True, use current mesh selection instead of filtering or selecting all."
                }
            },
            "required": [
                "object_name"
            ]
        }
    },
    {
        "name": "inset_faces",
        "description": "Inset faces of a mesh (great for creating walls from floors). PRO TIP: Use 'filter_normal' to only inset specific faces (like the top face).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Object to inset"
                },
                "thickness": {
                    "type": "number",
                    "description": "Inset amount"
                },
                "depth": {
                    "type": "number",
                    "description": "Optional extrude depth"
                },
                "filter_normal": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Only inset faces pointing in this direction (XYZ normal)"
                },
                "angle_threshold": {
                    "type": "number",
                    "default": 1.0,
                    "description": "Angle threshold in degrees for normal filtering"
                },
                "use_selection": {
                    "type": "boolean",
                    "default": false,
                    "description": "If True, use current mesh selection instead of filtering or selecting all."
                }
            },
            "required": [
                "object_name",
                "thickness"
            ]
        }
    },
    {
        "name": "shear_mesh",
        "description": "Shear mesh geometry along an axis (useful for sloped roofs). PRO TIP: Use 'filter_normal' (e.g. [0,0,1]) to shear only the top faces.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Object to shear"
                },
                "value": {
                    "type": "number",
                    "description": "Shear factor"
                },
                "axis": {
                    "type": "string",
                    "enum": [
                        "X",
                        "Y",
                        "Z"
                    ],
                    "description": "Axis to shear along (View axis)"
                },
                "orient_axis": {
                    "type": "string",
                    "enum": [
                        "X",
                        "Y",
                        "Z"
                    ],
                    "description": "Axis orthogonal to the shear plane"
                },
                "filter_normal": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional: Only shear faces pointing in this direction (XYZ normal)"
                },
                "angle_threshold": {
                    "type": "number",
                    "default": 1.0,
                    "description": "Angle threshold in degrees for normal filtering"
                }
            },
            "required": [
                "object_name",
                "value"
            ]
        }
    },
    {
        "name": "delete_object",
        "description": "Delete object(s) by name or pattern (e.g. 'Test_*').",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Specific object to delete"
                },
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern for bulk deletion (e.g. 'Test_*')"
                }
            }
        }
    },
    {
        "name": "set_object_visibility",
        "description": "Toggle or set visibility of an object in the viewport and/or render. SMART TOGGLE: If 'hide_viewport' and 'hide_render' are both omitted, the current visibility state will be flipped.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Name of the object to toggle (e.g. 'Apartment_Ceiling')"
                },
                "hide_viewport": {
                    "type": "boolean",
                    "description": "true = hide in viewport, false = show"
                },
                "hide_render": {
                    "type": "boolean",
                    "description": "true = hide in render, false = show"
                }
            },
            "required": [
                "object_name"
            ]
        }
    },
    {
        "name": "convert_to_mesh",
        "description": "Convert a non-mesh object (like Text or Curve) to a Mesh object so it can be joined or modified.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Name of the object to convert"
                }
            },
            "required": [
                "object_name"
            ]
        }
    },
    {
        "name": "build_room_shell",
        "description": "PRIMARY TOOL for building a 3D architectural shell from a 2D floor plan. Use this for the ENTIRE BUILDING OUTER PERIMETER (one call). Caller supplies explicit [x,y] vertex positions in order around the perimeter. Creates three separate named objects: {name}_Floor, {name}_Walls, {name}_Ceiling. PRO TIP: After this call, use build_wall_segment and build_wall_with_door to add interior partition walls. Do NOT call this per room — call it once for the whole building.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "vertices": {
                    "type": "array",
                    "minItems": 3,
                    "items": {
                        "type": "array",
                        "minItems": 2,
                        "items": {
                            "type": "number"
                        },
                        "description": "[x, y] or [x, y, z] — z is ignored, floor is always at Z=0"
                    },
                    "description": "Ordered perimeter vertices of the building/unit footprint. Minimum 3 vertices required. E.g. for a 10x6 rectangle: [[0,0],[10,0],[10,6],[0,6]]"
                },
                "height": {
                    "type": "number",
                    "default": 2.8,
                    "description": "Ceiling/wall height in metres (default 2.8)"
                },
                "wall_thickness": {
                    "type": "number",
                    "default": 0.2,
                    "description": "Exterior wall thickness in metres (default 0.2 = 200mm standard)."
                },
                "floor_thickness": {
                    "type": "number",
                    "default": 0.15,
                    "description": "Floor slab thickness in metres, grows downward (default 0.15 = 150mm)."
                },
                "name": {
                    "type": "string",
                    "description": "Base name — objects will be {name}_Floor, {name}_Walls, {name}_Ceiling"
                },
                "collection": {
                    "type": "string",
                    "description": "Collection to place the three objects in"
                },
                "doors": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "edge_index": {
                                "type": "integer",
                                "description": "0-indexed index of the edge in the vertices loop"
                            },
                            "door_offset": {
                                "type": "number",
                                "description": "Distance from the start vertex of the edge"
                            },
                            "door_width": {
                                "type": "number",
                                "default": 0.9,
                                "description": "Width of the door opening"
                            },
                            "door_height": {
                                "type": "number",
                                "default": 2.1,
                                "description": "Height of the door opening"
                            }
                        },
                        "required": [
                            "edge_index",
                            "door_offset"
                        ]
                    },
                    "description": "List of door openings to cut into the exterior walls"
                },
                "windows": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "edge_index": {
                                "type": "integer",
                                "description": "0-indexed index of the edge in the vertices loop"
                            },
                            "window_offset": {
                                "type": "number",
                                "description": "Distance from the start vertex of the edge"
                            },
                            "window_width": {
                                "type": "number",
                                "default": 1.2,
                                "description": "Width of the window opening"
                            },
                            "window_height": {
                                "type": "number",
                                "default": 1.5,
                                "description": "Height of the window opening"
                            },
                            "window_sill_height": {
                                "type": "number",
                                "default": 0.9,
                                "description": "Height from floor to bottom of window"
                            }
                        },
                        "required": [
                            "edge_index",
                            "window_offset"
                        ]
                    },
                    "description": "List of window openings to cut into the exterior walls"
                }
            },
            "required": [
                "vertices"
            ]
        }
    },
    {
        "name": "build_wall_segment",
        "description": "Create a plain interior partition wall (single flat quad face, no door). Use for solid dividers between rooms that share no opening. The wall is a zero-thickness surface from floor (Z=0) to ceiling height. WORKFLOW: build_room_shell (outer shell) → build_wall_segment (solid partitions) → build_wall_with_door (partitions with openings).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "start_point": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "[x, y] or [x, y, z] start of wall base (Z forced to 0)"
                },
                "end_point": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "[x, y] or [x, y, z] end of wall base (Z forced to 0)"
                },
                "height": {
                    "type": "number",
                    "default": 2.8,
                    "description": "Wall height in metres"
                },
                "thickness": {
                    "type": "number",
                    "default": 0.15,
                    "description": "Wall thickness in metres (default 0.15 = 150mm standard interior partition)."
                },
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
                "collection": {
                    "type": "string",
                    "description": "Collection to place object in"
                }
            },
            "required": [
                "start_point",
                "end_point"
            ]
        }
    },
    {
        "name": "build_wall_with_door",
        "description": "Create an interior wall segment with a door opening — pure vertex/face construction, no booleans. The wall is built from 3 faces: left panel (full height), lintel above door, right panel (full height). The door aperture is absent geometry (open space). Door is centred by default; pass door_offset to place it off-centre.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "start_point": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "[x, y] or [x, y, z] start of wall base (Z forced to 0)"
                },
                "end_point": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "[x, y] or [x, y, z] end of wall base (Z forced to 0)"
                },
                "height": {
                    "type": "number",
                    "default": 2.8,
                    "description": "Total wall height in metres"
                },
                "thickness": {
                    "type": "number",
                    "default": 0.15,
                    "description": "Wall thickness in metres (default 0.15 = 150mm standard interior partition)."
                },
                "door_offset": {
                    "type": "number",
                    "description": "Distance from start_point to left edge of door. Omit to centre."
                },
                "door_width": {
                    "type": "number",
                    "default": 0.9,
                    "description": "Door opening width in metres"
                },
                "door_height": {
                    "type": "number",
                    "default": 2.1,
                    "description": "Door opening height in metres"
                },
                "name": {
                    "type": "string",
                    "description": "Object name"
                },
                "collection": {
                    "type": "string",
                    "description": "Collection to place object in"
                }
            },
            "required": [
                "start_point",
                "end_point"
            ]
        }
    },
    {
        "name": "set_view",
        "description": "Switch viewport view (TOP, ISO, FRONT, SIDE). Use TOP for drawing floor plans, ISO to inspect the 3D result.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "mode": {
                    "type": "string",
                    "enum": [
                        "TOP",
                        "ISO",
                        "FRONT",
                        "SIDE"
                    ],
                    "default": "TOP",
                    "description": "View mode to switch to"
                }
            }
        }
    },
    {
        "name": "build_column",
        "description": "Create a structural column at a specific location. Can optionally be merged (union) with a target object (e.g. Room_Walls) to ensure seamless geometry without internal overlapping faces.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "[x, y] coordinates of the column's bottom-left corner."
                },
                "width": {
                    "type": "number",
                    "default": 0.4,
                    "description": "Column width (X-dimension)."
                },
                "depth": {
                    "type": "number",
                    "default": 0.4,
                    "description": "Column depth (Y-dimension)."
                },
                "height": {
                    "type": "number",
                    "default": 2.8,
                    "description": "Column height (default 2.8m)."
                },
                "name": {
                    "type": "string",
                    "description": "Object name (default 'Column')"
                },
                "collection": {
                    "type": "string",
                    "description": "Target collection"
                },
                "union_with": {
                    "type": "string",
                    "description": "Optional: Name of object to merge with (e.g. 'Room_Walls')."
                }
            },
            "required": [
                "location"
            ]
        }
    },
    {
        "name": "build_pipe_run",
        "description": "Create a straight pipe segment or a sequence of connected pipe segments. Pipes are typically rounded and color-coded based on their system type.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "points": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "number"
                        },
                        "minItems": 2,
                        "maxItems": 3
                    },
                    "description": "Sequence of [x, y] or [x, y, z] points defining the pipe path."
                },
                "radius": {
                    "type": "number",
                    "default": 0.05,
                    "description": "Outer radius of the pipe in metres."
                },
                "system_type": {
                    "type": "string",
                    "enum": [
                        "WATER",
                        "CHILLER",
                        "FIRE",
                        "GAS",
                        "DRAINAGE"
                    ],
                    "description": "Standard MEP system type for automatic color-coding."
                },
                "name": {
                    "type": "string",
                    "description": "Base name for the pipe objects."
                },
                "add_fittings": {
                    "type": "boolean",
                    "default": false,
                    "description": "If true, adds junction spheres at corners to bridge segments."
                },
                "collection": {
                    "type": "string",
                    "description": "Target collection."
                }
            },
            "required": [
                "points",
                "system_type"
            ]
        }
    },
    {
        "name": "build_cable_tray",
        "description": "Create a cable tray run with a standard profile (Ladder, Trough, etc.). Used for electrical containment.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "points": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "number"
                        },
                        "minItems": 3,
                        "maxItems": 3
                    },
                    "description": "Sequence of [x, y, z] points defining the tray path."
                },
                "width": {
                    "type": "number",
                    "default": 0.3,
                    "description": "Width of the cable tray (standard trunking sizing)."
                },
                "depth": {
                    "type": "number",
                    "default": 0.05,
                    "description": "Depth/height of the tray side rails."
                },
                "tray_type": {
                    "type": "string",
                    "enum": [
                        "LADDER",
                        "TROUGH",
                        "SOLID",
                        "CHANNEL"
                    ],
                    "default": "LADDER",
                    "description": "Profile style of the cable tray."
                },
                "system_type": {
                    "type": "string",
                    "enum": [
                        "POWER",
                        "DATA",
                        "FIBER",
                        "FIRE_ALARM"
                    ],
                    "default": "POWER",
                    "description": "System type for automatic color-coding of the tray and supports."
                },
                "auto_support_spacing": {
                    "type": "number",
                    "description": "Interval (metres) for automated support placement."
                },
                "auto_support_type": {
                    "type": "string",
                    "enum": [
                        "TRAPEZE_HANGER",
                        "CANTILEVER_BRACKET",
                        "WALL_BRACKET"
                    ],
                    "default": "TRAPEZE_HANGER",
                    "description": "Type of support to use for automated placement."
                },
                "height_to_ceiling": {
                    "type": "number",
                    "default": 0.5,
                    "description": "Rod length for hangers (relative to tray Z)."
                },
                "support_start_offset": {
                    "type": "number",
                    "default": 0.2,
                    "description": "Tolerance buffer (metres) from the start of the run for the first support."
                },
                "name": {
                    "type": "string",
                    "description": "Object name."
                },
                "collection": {
                    "type": "string",
                    "description": "Target collection."
                },
                "side_direction": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional [x, y, z] vector to override the auto-determined direction for wall/cantilever brackets (automated placement)."
                },
                "supports": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "location": {
                                "type": "array",
                                "items": {
                                    "type": "number"
                                },
                                "minItems": 3,
                                "maxItems": 3
                            },
                            "support_type": {
                                "type": "string",
                                "enum": [
                                    "TRAPEZE_HANGER",
                                    "CANTILEVER_BRACKET",
                                    "WALL_BRACKET"
                                ]
                            },
                            "height_to_ceiling": {
                                "type": "number"
                            },
                            "width": {
                                "type": "number"
                            },
                            "system_type": {
                                "type": "string"
                            },
                            "side_direction": {
                                "type": "array",
                                "items": {
                                    "type": "number"
                                }
                            },
                            "rotation": {
                                "type": "array",
                                "items": {
                                    "type": "number"
                                }
                            }
                        }
                    },
                    "description": "Optional list of manual support placements."
                }
            },
            "required": [
                "points"
            ]
        }
    },
    {
        "name": "add_tray_support",
        "description": "Add a support joint (overhung) that secures trunking/trays to the ceiling or walls.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "[x, y, z] mounting point on the tray."
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Euler rotation in degrees [X, Y, Z]"
                },
                "support_type": {
                    "type": "string",
                    "enum": [
                        "TRAPEZE_HANGER",
                        "CANTILEVER_BRACKET",
                        "WALL_BRACKET"
                    ],
                    "description": "Type of support joint."
                },
                "height_to_ceiling": {
                    "type": "number",
                    "description": "Distance from tray to ceiling for hangers."
                },
                "width": {
                    "type": "number",
                    "default": 0.3,
                    "description": "Width of the tray to support (for trapeze sizing)."
                },
                "name": {
                    "type": "string",
                    "description": "Object name."
                },
                "collection": {
                    "type": "string",
                    "description": "Target collection."
                },
                "side_direction": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Optional [x, y, z] vector to override the auto-determined direction for wall/cantilever brackets."
                }
            },
            "required": [
                "location",
                "support_type"
            ]
        }
    },
    {
        "name": "create_material",
        "description": "POWER TIP: Use 'pattern' or 'collection' directly here to create AND assign in ONE TURN. This is much faster and avoids rate limits compared to sequential selection-assignment workflows.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string"
                },
                "preset": {
                    "type": "string",
                    "enum": [
                        "glass",
                        "glass_tinted",
                        "glass_frosted",
                        "metal_brushed",
                        "metal_polished",
                        "metal_gold",
                        "metal_copper",
                        "plastic_glossy",
                        "plastic_matte",
                        "concrete",
                        "wood",
                        "rubber",
                        "emission"
                    ]
                },
                "base_color": {
                    "type": "string",
                    "description": "Hex color like #FF0000"
                },
                "roughness": {
                    "type": "number"
                },
                "metallic": {
                    "type": "number"
                },
                "transmission": {
                    "type": "number"
                },
                "ior": {
                    "type": "number"
                },
                "emission_color": {
                    "type": "string"
                },
                "emission_strength": {
                    "type": "number"
                },
                "alpha": {
                    "type": "number"
                },
                "object_names": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    }
                },
                "pattern": {
                    "anyOf": [
                        {
                            "type": "string"
                        },
                        {
                            "type": "array",
                            "items": {
                                "type": "string"
                            }
                        }
                    ],
                    "description": "Wildcard pattern(s) for objects (e.g. 'Wall_*' or ['Wall_*', 'Col_*'])"
                },
                "collection": {
                    "anyOf": [
                        {
                            "type": "string"
                        },
                        {
                            "type": "array",
                            "items": {
                                "type": "string"
                            }
                        }
                    ],
                    "description": "Assign to all objects in these collection(s)"
                },
                "slot_index": {
                    "type": "integer",
                    "default": 0
                }
            },
            "required": [
                "name"
            ]
        }
    },
    {
        "name": "assign_material",
        "description": "Assign an existing material. RATE LIMIT WARNING: Use 'pattern' or 'collection' directly here to assign to many objects in ONE TURN. Avoid using 'select_by_pattern' first as it doubles the API calls.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "material_name": {
                    "type": "string"
                },
                "object_names": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    }
                },
                "pattern": {
                    "anyOf": [
                        {
                            "type": "string"
                        },
                        {
                            "type": "array",
                            "items": {
                                "type": "string"
                            }
                        }
                    ],
                    "description": "Wildcard pattern(s) for objects (e.g. 'Wall_*' or ['Wall_*', 'Col_*'])"
                },
                "collection": {
                    "anyOf": [
                        {
                            "type": "string"
                        },
                        {
                            "type": "array",
                            "items": {
                                "type": "string"
                            }
                        }
                    ],
                    "description": "Assign to all objects in these collection(s)"
                },
                "slot_index": {
                    "type": "integer",
                    "default": 0
                }
            },
            "required": [
                "material_name"
            ]
        }
    },
    {
        "name": "set_material_properties",
        "description": "Modify properties of an existing material.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "material_name": {
                    "type": "string"
                },
                "base_color": {
                    "type": "string"
                },
                "metallic": {
                    "type": "number"
                },
                "roughness": {
                    "type": "number"
                },
                "emission_color": {
                    "type": "string"
                },
                "emission_strength": {
                    "type": "number"
                },
                "alpha": {
                    "type": "number"
                },
                "transmission": {
                    "type": "number"
                }
            },
            "required": [
                "material_name"
            ]
        }
    },
    {
        "name": "add_shader_node",
        "description": "Add a shader node to a material's node tree.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "material_name": {
                    "type": "string"
                },
                "node_type": {
                    "type": "string"
                },
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    }
                }
            },
            "required": [
                "material_name",
                "node_type",
                "location"
            ]
        }
    },
    {
        "name": "connect_shader_nodes",
        "description": "Connect two shader nodes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "material_name": {
                    "type": "string"
                },
                "from_node": {
                    "type": "string"
                },
                "from_socket": {
                    "type": "string"
                },
                "to_node": {
                    "type": "string"
                },
                "to_socket": {
                    "type": "string"
                }
            },
            "required": [
                "material_name",
                "from_node",
                "from_socket",
                "to_node",
                "to_socket"
            ]
        }
    },
    {
        "name": "assign_builtin_texture",
        "description": "Apply a Blender built-in procedural texture to a material.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "material_name": {
                    "type": "string"
                },
                "texture_type": {
                    "type": "string"
                }
            },
            "required": [
                "material_name",
                "texture_type"
            ]
        }
    },
    {
        "name": "assign_texture_map",
        "description": "Load an image and assign it to a material slot (Base Color, Roughness, Normal, etc.). Supports auto-creation of Normal Map nodes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "material_name": {
                    "type": "string"
                },
                "image_path": {
                    "type": "string",
                    "description": "Path to the image file. Can be absolute, or relative if BLENDER_ASSETS_DIR is set in .env."
                },
                "map_type": {
                    "type": "string",
                    "description": "Base Color, Roughness, Metallic, Normal, Emission, or Alpha",
                    "default": "Base Color",
                    "enum": [
                        "Base Color",
                        "Roughness",
                        "Metallic",
                        "Normal",
                        "Emission",
                        "Alpha"
                    ]
                }
            },
            "required": [
                "material_name",
                "image_path"
            ]
        }
    },
    {
        "name": "create_light",
        "description": "Create light (POINT, SUN, SPOT, AREA)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string"
                },
                "type": {
                    "type": "string",
                    "description": "POINT, SUN, SPOT, or AREA"
                },
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    }
                },
                "energy": {
                    "type": "number"
                },
                "color": {
                    "type": "string",
                    "description": "Hex color string (e.g., '#FF9900')"
                },
                "angle": {
                    "type": "number",
                    "description": "For SUN: angular diameter in degrees"
                },
                "size": {
                    "type": "number",
                    "description": "For AREA: size of the light"
                }
            },
            "required": [
                "name",
                "type",
                "location"
            ]
        }
    },
    {
        "name": "set_world_background",
        "description": "Set the world background to a solid color, a procedural sky, or an HDRI environment image.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "mode": {
                    "type": "string",
                    "description": "'color', 'sky' (Nishita), or 'hdri' (Image)",
                    "enum": [
                        "color",
                        "sky",
                        "hdri"
                    ]
                },
                "color": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "RGB color for 'color' mode (default dark grey)"
                },
                "strength": {
                    "type": "number",
                    "description": "Emission strength (default 1.0)"
                },
                "image_path": {
                    "type": "string",
                    "description": "Path to HDRI image. Can be absolute, or relative if BLENDER_ASSETS_DIR is set in .env."
                },
                "rotation_z": {
                    "type": "number",
                    "description": "Z-axis rotation in degrees for HDRI"
                }
            },
            "required": [
                "mode"
            ]
        }
    },
    {
        "name": "create_camera",
        "description": "Create camera",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string"
                },
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    }
                },
                "rotation": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "default": [
                        0,
                        0,
                        0
                    ],
                    "description": "Rotation in degrees"
                },
                "lens": {
                    "type": "number",
                    "description": "Camera focal length in mm"
                },
                "type": {
                    "type": "string",
                    "enum": [
                        "PERSP",
                        "ORTHO",
                        "PANO"
                    ],
                    "description": "Camera type"
                }
            },
            "required": [
                "name",
                "location"
            ]
        }
    },
    {
        "name": "set_active_camera",
        "description": "Set the active camera for the scene.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "camera_name": {
                    "type": "string"
                }
            },
            "required": [
                "camera_name"
            ]
        }
    },
    {
        "name": "camera_look_at",
        "description": "Point a camera at a target location.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "camera_name": {
                    "type": "string"
                },
                "target_location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    }
                }
            },
            "required": [
                "camera_name",
                "target_location"
            ]
        }
    },
    {
        "name": "set_keyframe",
        "description": "Set a keyframe for an object property.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string"
                },
                "property_path": {
                    "type": "string"
                },
                "frame": {
                    "type": "integer"
                },
                "value": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    }
                }
            },
            "required": [
                "object_name",
                "property_path",
                "frame",
                "value"
            ]
        }
    },
    {
        "name": "get_keyframes",
        "description": "Get all keyframes for an object.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string"
                }
            },
            "required": [
                "object_name"
            ]
        }
    },
    {
        "name": "set_timeline_range",
        "description": "Set the timeline range for animation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "start_frame": {
                    "type": "integer"
                },
                "end_frame": {
                    "type": "integer"
                },
                "current_frame": {
                    "type": "integer"
                }
            },
            "required": [
                "start_frame",
                "end_frame"
            ]
        }
    },
    {
        "name": "play_animation",
        "description": "Play or stop animation playback.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "play": {
                    "type": "boolean",
                    "default": true
                }
            }
        }
    },
    {
        "name": "configure_render_settings",
        "description": "Configure render settings.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "engine": {
                    "type": "string",
                    "enum": [
                        "CYCLES",
                        "BLENDER_EEVEE_NEXT"
                    ]
                },
                "samples": {
                    "type": "integer"
                },
                "resolution_x": {
                    "type": "integer"
                },
                "resolution_y": {
                    "type": "integer"
                }
            }
        }
    },
    {
        "name": "render_frame",
        "description": "Render the current frame.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "output_path": {
                    "type": "string"
                }
            }
        }
    },
    {
        "name": "render_animation",
        "description": "Render an animation sequence.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "start_frame": {
                    "type": "integer"
                },
                "end_frame": {
                    "type": "integer"
                },
                "output_dir": {
                    "type": "string"
                }
            }
        }
    },
    {
        "name": "undo",
        "description": "Undo the last action in Blender",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "redo",
        "description": "Redo the last undone action in Blender",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "set_scene_units",
        "description": "Configure the scene measurement units and scaling. This is crucial for 3D printing because slicers expect absolute millimeter dimensions while Blender defaults to meters.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "system": {
                    "type": "string",
                    "enum": [
                        "METRIC",
                        "IMPERIAL"
                    ],
                    "description": "The unit system to use (default: 'METRIC')."
                },
                "length_unit": {
                    "type": "string",
                    "enum": [
                        "MILLIMETERS",
                        "CENTIMETERS",
                        "METERS",
                        "INCHES",
                        "FEET"
                    ],
                    "description": "Length units of the scene (default: 'MILLIMETERS')."
                },
                "scale": {
                    "type": "number",
                    "description": "Unit scale factor. For metric millimeters, set this to 0.001 to map 1 Blender grid unit to 1 millimeter (default: 0.001)."
                }
            }
        }
    },
    {
        "name": "check_mesh_for_printing",
        "description": "Analyze a mesh object's topology for 3D printing readiness. Checks for boundary edges (holes), non-manifold edges (T-junctions), degenerate edges/faces (zero size), and computes mesh volume.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "The name of the mesh object to analyze."
                }
            },
            "required": [
                "object_name"
            ]
        }
    },
    {
        "name": "repair_mesh",
        "description": "Attempt automated non-destructive mesh cleanup and repairs (merge double vertices, fill holes, and recalculate face normals outwards).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "The name of the mesh object to repair."
                },
                "merge_distance": {
                    "type": "number",
                    "description": "Threshold distance for merging overlapping vertices (default: 0.0001)."
                },
                "recalculate_normals": {
                    "type": "boolean",
                    "description": "Recalculate face normals to point consistently outwards (default: true)."
                }
            },
            "required": [
                "object_name"
            ]
        }
    },
    {
        "name": "apply_voxel_remesh",
        "description": "Fuse multiple overlapping geometry parts into a single watertight manifold volume using a Voxel Remesh operation. Note: This operation can be lossy and deletes original UV maps.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "The name of the mesh object to remesh."
                },
                "voxel_size": {
                    "type": "number",
                    "description": "Resolution grid size. Smaller values preserve finer detail but increase processing time and mesh density (default: 0.1)."
                },
                "adaptivity": {
                    "type": "number",
                    "description": "Reduces polygon count on planar areas. Ranges from 0.0 (no reduction) to 1.0 (maximum decimation) (default: 0.0)."
                },
                "clean_geometry": {
                    "type": "boolean",
                    "description": "Automatically delete disconnected loose parts from the mesh during remesh (default: true)."
                }
            },
            "required": [
                "object_name"
            ]
        }
    },
    {
        "name": "export_model",
        "description": "Export the specified object or the entire selection to standard formats (STL or 3MF). 3MF preserves materials and colors for multi-color printing. Relative paths are resolved against the BLENDER_ASSETS_DIR folder.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Optional: Name of the object to isolate and export. If omitted, exports currently selected objects."
                },
                "filepath": {
                    "type": "string",
                    "description": "Optional: Filepath to export the model to (e.g. 'keychain.stl', 'model.3mf'). Defaults to '[object_name].stl' inside assets directory if omitted."
                },
                "format": {
                    "type": "string",
                    "enum": [
                        "STL",
                        "3MF"
                    ],
                    "description": "File format to export (default: 'STL'). Use 3MF for multi-color printing with material preservation. Requires threemf_io addon for 3MF export."
                },
                "selection_only": {
                    "type": "boolean",
                    "description": "Export only selected objects (default: true)."
                }
            }
        }
    },
    {
        "name": "import_model",
        "description": "Import a 3D model file (STL, OBJ, or FBX) into the scene and select it. Relative paths are resolved against the BLENDER_ASSETS_DIR folder.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "filepath": {
                    "type": "string",
                    "description": "Filepath of the model to import (e.g. 'keychain.stl' or 'f:/models/part.obj')."
                }
            },
            "required": [
                "filepath"
            ]
        }
    },
    {
        "name": "enter_sculpt_mode",
        "description": "Switch a mesh object into Blender's Sculpt Mode. Must be called before set_dyntopo or symmetrize_mesh.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Name of the mesh object to enter sculpt mode on"
                }
            },
            "required": [
                "object_name"
            ]
        }
    },
    {
        "name": "exit_sculpt_mode",
        "description": "Exit Sculpt Mode and return the active object to Object Mode.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "set_dyntopo",
        "description": "Enable or disable Dynamic Topology (Dyntopo) in Sculpt Mode. Dyntopo automatically subdivides or merges polygons as you sculpt, allowing unlimited resolution in specific areas. Requires enter_sculpt_mode to be called first.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "enabled": {
                    "type": "boolean",
                    "description": "True to enable Dyntopo, False to disable",
                    "default": true
                },
                "detail_size": {
                    "type": "number",
                    "description": "Detail level (lower = more polygons, higher = fewer). Range: 1–100. Default: 12.",
                    "default": 12
                },
                "constant_detail": {
                    "type": "boolean",
                    "description": "Use constant detail (uniform polygon size) instead of relative screen-space detail.",
                    "default": false
                }
            },
            "required": [
                "enabled"
            ]
        }
    },
    {
        "name": "apply_sculpt_smooth",
        "description": "Apply Laplacian smoothing to an entire mesh to round out hard edges and surface bumps. Works in Object Mode — no live viewport needed. Use after voxel remesh to soften blocky artifacts.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Name of the mesh object to smooth"
                },
                "iterations": {
                    "type": "integer",
                    "description": "Number of smoothing passes. Higher = rounder. Default: 3.",
                    "default": 3
                },
                "factor": {
                    "type": "number",
                    "description": "Smoothing strength per pass (0.0 = no effect, 1.0 = maximum). Default: 0.5.",
                    "default": 0.5
                }
            },
            "required": [
                "object_name"
            ]
        }
    },
    {
        "name": "sculpt_inflate",
        "description": "Inflate or deflate a mesh by displacing all vertices along their surface normals. Positive distance = expand outward like a balloon. Negative distance = shrink inward. Use mask_below_z to protect the flat base (e.g. mask_below_z=0.0 keeps the bottom flat).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Name of the mesh object to inflate/deflate"
                },
                "distance": {
                    "type": "number",
                    "description": "Displacement distance along normals. Positive = expand, negative = shrink. Default: 0.05.",
                    "default": 0.05
                },
                "mask_below_z": {
                    "type": "number",
                    "description": "Optional world-space Z coordinate below which vertices are NOT moved (protects flat base). Matches the object's Location Z in the UI, not local mesh coordinates."
                }
            },
            "required": [
                "object_name"
            ]
        }
    },
    {
        "name": "sculpt_grab",
        "description": "Move vertices near a 3D location by an offset vector, simulating Blender's Grab sculpt brush. Uses smooth cosine falloff: vertices at the center move the full offset, vertices at the radius edge are barely moved. Use this to pull a boat bow into a point, push in dents, raise terrain hills, etc.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Name of the mesh object to sculpt"
                },
                "location": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "3D center [x, y, z] of the grab operation in world space"
                },
                "offset": {
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Direction and distance to pull/push [dx, dy, dz]"
                },
                "radius": {
                    "type": "number",
                    "description": "Radius of influence around the location. Default: 1.0.",
                    "default": 1.0
                }
            },
            "required": [
                "object_name",
                "location",
                "offset"
            ]
        }
    },
    {
        "name": "symmetrize_mesh",
        "description": "Mirror mesh geometry across an axis so both sides are perfectly symmetric. The source side overwrites the mirror side. POSITIVE_X copies the +X half to the -X side. Automatically enters and exits Sculpt Mode.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "object_name": {
                    "type": "string",
                    "description": "Name of the mesh object to symmetrize"
                },
                "direction": {
                    "type": "string",
                    "enum": [
                        "POSITIVE_X",
                        "NEGATIVE_X",
                        "POSITIVE_Y",
                        "NEGATIVE_Y",
                        "POSITIVE_Z",
                        "NEGATIVE_Z"
                    ],
                    "description": "Which side is the source that gets mirrored. Default: POSITIVE_X.",
                    "default": "POSITIVE_X"
                }
            },
            "required": [
                "object_name"
            ]
        }
    }
];
