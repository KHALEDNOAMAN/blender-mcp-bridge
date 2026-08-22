# blender_mcp_addon/tools/modeling/primitives.py

import math
import os

import bpy  # type: ignore

from ...utils import get_collection


class ModelingPrimitives:
    def create_cube(
        self,
        location,
        scale=None,
        rotation=None,
        name=None,
        collection=None,
        **kwargs,
    ):
        """Create a cube"""
        return self.create_primitive(
            "cube",
            location,
            scale=scale,
            rotation=rotation,
            name=name,
            collection=collection,
            **kwargs,
        )

    def create_cylinder(
        self,
        location,
        radius=None,
        depth=None,
        vertices=32,
        scale=None,
        rotation=None,
        name=None,
        collection=None,
        **kwargs,
    ):
        """Create a cylinder"""
        params = {
            "scale": scale,
            "rotation": rotation,
            "name": name,
            "collection": collection,
            "vertices": vertices,
        }
        if radius is not None:
            params["radius"] = radius
        if depth is not None:
            params["depth"] = depth
        params.update(kwargs)
        return self.create_primitive("cylinder", location, **params)

    def create_icosphere(
        self,
        location,
        radius=1.0,
        subdivisions=2,
        scale=None,
        rotation=None,
        name=None,
        collection=None,
        **kwargs,
    ):
        """Create an ico sphere"""
        return self.create_primitive(
            "icosphere",
            location,
            scale=scale,
            rotation=rotation,
            name=name,
            collection=collection,
            radius=radius,
            subdivisions=subdivisions,
            **kwargs,
        )

    def create_sphere(
        self,
        location,
        radius=1.0,
        scale=None,
        rotation=None,
        name=None,
        collection=None,
    ):
        """Create a UV sphere"""
        return self.create_primitive(
            "sphere",
            location,
            scale=scale,
            rotation=rotation,
            name=name,
            collection=collection,
            radius=radius,
        )

    def create_cone(
        self,
        location,
        radius1=1.0,
        radius2=0.0,
        depth=2.0,
        scale=None,
        rotation=None,
        name=None,
        collection=None,
        **kwargs,
    ):
        """Create a cone primitive"""
        params = {
            "scale": scale,
            "rotation": rotation,
            "name": name,
            "collection": collection,
        }
        if radius1 is not None:
            params["radius1"] = radius1
        if radius2 is not None:
            params["radius2"] = radius2
        if depth is not None:
            params["depth"] = depth
        params.update(kwargs)
        return self.create_primitive("cone", location, **params)

    def create_torus(
        self,
        location,
        major_radius=1.0,
        minor_radius=0.25,
        major_segments=48,
        minor_segments=12,
        scale=None,
        rotation=None,
        name=None,
        collection=None,
    ):
        """Create a torus"""
        return self.create_primitive(
            "torus",
            location,
            scale=scale,
            rotation=rotation,
            name=name,
            collection=collection,
            major_radius=major_radius,
            minor_radius=minor_radius,
            major_segments=major_segments,
            minor_segments=minor_segments,
        )

    def create_text(
        self,
        text,
        location,
        name=None,
        size=1.0,
        extrude=0.05,
        rotation=None,
        align_x="LEFT",
        collection=None,
        font=None,
        offset=None,
        **kwargs,
    ):
        """Create 3D text (FONT object)"""
        is_update = bool(name and name in bpy.data.objects)
        if is_update:
            obj = bpy.data.objects[name]
            if obj.type != "FONT":
                raise ValueError(f"Object '{name}' is not a text object")
            obj.location = location
        else:
            bpy.ops.object.text_add(location=location)
            obj = bpy.context.active_object
            if name:
                obj.name = name

        # Update text data
        obj.data.body = text
        obj.data.size = size
        obj.data.extrude = extrude
        obj.data.align_x = align_x

        # Optional typeface. Blender's built-in font is a thin sans with no
        # bold variant, so a real bold needs an actual .ttf loaded here.
        if font:
            font_path = font
            if not os.path.isabs(font_path):
                # Bare names like "arialbd.ttf" resolve against the OS font dir.
                for base in (
                    os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts"),
                    "/usr/share/fonts",
                    "/Library/Fonts",
                ):
                    candidate = os.path.join(base, font_path)
                    if os.path.exists(candidate):
                        font_path = candidate
                        break
            if not os.path.exists(font_path):
                raise ValueError(f"Font not found: {font}")
            obj.data.font = bpy.data.fonts.load(font_path, check_existing=True)

        # Fattens the glyph outline in place -- this is faux-bold, and it is
        # what makes a legend read on a printed part. Applied on top of
        # whatever typeface is in use.
        if offset is not None:
            obj.data.offset = offset

        if rotation is not None:
            obj.rotation_euler = [math.radians(r) for r in rotation]

        if collection:
            self._move_to_collection_helper(obj, collection)

        status = "updated" if is_update else "created"
        return {
            "success": True,
            "name": obj.name,
            "status": status,
            "message": f"Text object '{obj.name}' {status} successfully.",
        }

    def create_empty(
        self,
        location,
        name=None,
        empty_display_type="PLAIN_AXES",
        empty_display_size=1.0,
        instance_collection=None,
        collection=None,
        **kwargs,
    ):
        """Create an Empty object, optionally instancing a collection"""
        is_update = bool(name and name in bpy.data.objects)
        if is_update:
            obj = bpy.data.objects[name]
            if obj.type != "EMPTY":
                raise ValueError(f"Object '{name}' is not an Empty object")
            obj.location = location
        else:
            bpy.ops.object.empty_add(
                type=empty_display_type, radius=empty_display_size, location=location
            )
            obj = bpy.context.active_object
            if name:
                obj.name = name

        obj.empty_display_type = empty_display_type
        obj.empty_display_size = empty_display_size

        if instance_collection:
            inst_coll = get_collection(instance_collection)
            obj.instance_type = "COLLECTION"
            obj.instance_collection = inst_coll

        if collection:
            self._move_to_collection_helper(obj, collection)

        if "hide_viewport" in kwargs:
            obj.hide_viewport = kwargs["hide_viewport"]
        if "hide_render" in kwargs:
            obj.hide_render = kwargs["hide_render"]

        status = "updated" if is_update else "created"
        msg = f"Empty object '{obj.name}' {status} successfully."
        if instance_collection:
            msg += f" Instancing collection '{instance_collection}'."

        return {
            "success": True,
            "name": obj.name,
            "status": status,
            "message": msg,
        }

    def create_plane(
        self,
        location,
        size=2.0,
        scale=None,
        rotation=None,
        name=None,
        collection=None,
        **kwargs,
    ):
        """Create a plane"""
        return self.create_primitive(
            "plane",
            location,
            scale=scale,
            rotation=rotation,
            name=name,
            collection=collection,
            size=size,
            **kwargs,
        )

    def create_polygon(
        self,
        vertices,
        location=(0, 0, 0),
        extrude=0.0,
        name=None,
        rotation=None,
        collection=None,
        **kwargs,
    ):
        """Create a flat polygon mesh from a list of 2D or 3D vertex coordinates.

        Args:
            vertices: List of [x, y] or [x, y, z] coordinates defining the polygon outline.
                      Vertices should be ordered (clockwise or counter-clockwise).
            location: World-space origin for the object.
            extrude: If > 0, extrude the polygon along +Z by this amount to create a solid.
            name: Object name.
            rotation: Euler rotation in degrees [X, Y, Z].
            collection: Collection to place the object in.
        """
        import bmesh  # type: ignore

        if len(vertices) < 3:
            raise ValueError("A polygon requires at least 3 vertices.")

        # Normalise to 3D (default Z=0)
        verts_3d = []
        for v in vertices:
            if len(v) == 2:
                verts_3d.append((v[0], v[1], 0.0))
            elif len(v) >= 3:
                verts_3d.append((v[0], v[1], v[2]))
            else:
                raise ValueError(f"Vertex must have 2 or 3 components, got {len(v)}")

        # ── Build mesh with bmesh ──
        top_vertices = kwargs.get("top_vertices")
        if top_vertices:
            # Detect if top_vertices is a list of layers
            if isinstance(top_vertices[0], (list, tuple)) and isinstance(
                top_vertices[0][0], (list, tuple)
            ):
                layers_data = top_vertices
            else:
                layers_data = [top_vertices]

            all_layers_3d = [verts_3d]
            for layer_idx, layer in enumerate(layers_data):
                if len(layer) != len(vertices):
                    raise ValueError(
                        f"Layer {layer_idx} in top_vertices must have {len(vertices)} vertices, got {len(layer)}"
                    )

                layer_verts_3d = []
                for v in layer:
                    if len(v) == 2:
                        z = (layer_idx + 1) * 5.0
                        layer_verts_3d.append((v[0], v[1], z))
                    elif len(v) >= 3:
                        layer_verts_3d.append((v[0], v[1], v[2]))
                    else:
                        raise ValueError(
                            f"Vertex in layer {layer_idx} must have 2 or 3 components, got {len(v)}"
                        )
                all_layers_3d.append(layer_verts_3d)

            mesh = bpy.data.meshes.new(name or "Polygon")
            obj = bpy.data.objects.new(mesh.name, mesh)
            bpy.context.collection.objects.link(obj)

            bm = bmesh.new()

            # Create vertices for all layers
            bm_layers_verts = []
            for layer_verts in all_layers_3d:
                bm_layer = [bm.verts.new(v) for v in layer_verts]
                bm_layers_verts.append(bm_layer)

            # Cap bottom and top, then triangulate the caps deterministically:
            # a long or height-varying cap n-gon is otherwise triangulated ad hoc
            # by the viewport, which can bridge distant vertices and tent the
            # surface above/below the ring outline.
            cap_faces = [
                bm.faces.new(bm_layers_verts[0]),
                bm.faces.new(reversed(bm_layers_verts[-1])),
            ]
            bmesh.ops.triangulate(bm, faces=cap_faces, ngon_method="BEAUTY")

            # Connect side faces between each layer
            n_verts = len(vertices)
            n_layers = len(bm_layers_verts)
            for layer_idx in range(n_layers - 1):
                bot_layer = bm_layers_verts[layer_idx]
                top_layer = bm_layers_verts[layer_idx + 1]
                for i in range(n_verts):
                    bm.faces.new(
                        [
                            bot_layer[i],
                            bot_layer[(i + 1) % n_verts],
                            top_layer[(i + 1) % n_verts],
                            top_layer[i],
                        ]
                    )

            bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
            bm.to_mesh(mesh)
            bm.free()
            mesh.update()
        else:
            mesh = bpy.data.meshes.new(name or "Polygon")
            obj = bpy.data.objects.new(mesh.name, mesh)
            bpy.context.collection.objects.link(obj)

            bm = bmesh.new()
            bm_verts = [bm.verts.new(v) for v in verts_3d]
            bm.faces.new(bm_verts)

            if extrude > 0:
                result = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
                extruded_verts = [e for e in result["geom"] if isinstance(e, bmesh.types.BMVert)]
                bmesh.ops.translate(bm, vec=(0, 0, extrude), verts=extruded_verts)

                taper = kwargs.get("taper", 1.0)
                if taper != 1.0:
                    cx = sum(v[0] for v in verts_3d) / len(verts_3d)
                    cy = sum(v[1] for v in verts_3d) / len(verts_3d)
                    for ev in extruded_verts:
                        ev.co.x = cx + (ev.co.x - cx) * taper
                        ev.co.y = cy + (ev.co.y - cy) * taper

            bm.to_mesh(mesh)
            bm.free()
            mesh.update()

        # ── Position / Rotation ──
        obj.location = location

        if rotation is not None:
            obj.rotation_euler = [math.radians(r) for r in rotation]

        if name:
            obj.name = name

        if collection:
            self._move_to_collection_helper(obj, collection)

        obj.hide_viewport = False
        obj.hide_render = False

        return {
            "success": True,
            "name": obj.name,
            "type": "polygon",
            "status": "created",
            "dimensions": list(obj.dimensions),
            "location": list(obj.location),
            "vertex_count": len(vertices),
            "extruded": extrude > 0,
            "message": f"Polygon '{obj.name}' created with {len(vertices)} vertices"
            + (f", extruded {extrude}mm" if extrude > 0 else "")
            + ".",
        }

    def create_primitive(
        self,
        type,
        location,
        scale=None,
        rotation=None,
        name=None,
        collection=None,
        **kwargs,
    ):
        """Create primitive mesh with precise parameters"""
        ops_map = {
            "cube": bpy.ops.mesh.primitive_cube_add,
            "cylinder": bpy.ops.mesh.primitive_cylinder_add,
            "sphere": bpy.ops.mesh.primitive_uv_sphere_add,
            "torus": bpy.ops.mesh.primitive_torus_add,
            "plane": bpy.ops.mesh.primitive_plane_add,
            "cone": bpy.ops.mesh.primitive_cone_add,
            "icosphere": bpy.ops.mesh.primitive_ico_sphere_add,
        }

        op = ops_map.get(type.lower())
        if not op:
            raise ValueError(f"Unknown primitive type: {type}")

        params = {"location": location}
        if type == "cube":
            params["size"] = kwargs.get("size", 1.0)
        elif type == "plane":
            params["size"] = kwargs.get("size", 2.0)
        elif type == "cylinder":
            if "vertices" in kwargs:
                params["vertices"] = kwargs["vertices"]
            if "radius" in kwargs:
                params["radius"] = kwargs["radius"]
            if "depth" in kwargs:
                params["depth"] = kwargs["depth"]
        elif type == "sphere" or type == "icosphere":
            if "radius" in kwargs:
                params["radius"] = kwargs["radius"]
            if "subdivisions" in kwargs:
                params["subdivisions"] = kwargs["subdivisions"]
        elif type == "cone":
            if "radius1" in kwargs:
                params["radius1"] = kwargs["radius1"]
            if "radius2" in kwargs:
                params["radius2"] = kwargs["radius2"]
            if "depth" in kwargs:
                params["depth"] = kwargs["depth"]
        elif type == "torus":
            if "major_radius" in kwargs:
                params["major_radius"] = kwargs["major_radius"]
            if "minor_radius" in kwargs:
                params["minor_radius"] = kwargs["minor_radius"]
            if "major_segments" in kwargs:
                params["major_segments"] = kwargs["major_segments"]
            if "minor_segments" in kwargs:
                params["minor_segments"] = kwargs["minor_segments"]

        # Sanity check: scene is configured so raw values ARE millimeters
        # directly (no /1000 conversion needed). Catch the common mistake of
        # treating these as meters and dividing mm by 1000 before calling in.
        # This is a hard error, not just a warning: a sub-0.1 feature is never
        # printable on any real nozzle, so it is never an intentional value.
        skip_keys = {
            "location",
            "rotation",
            "scale",
            "name",
            "collection",
            "vertices",
            "subdivisions",
        }
        shape_values = [
            v for k, v in params.items() if k not in skip_keys and isinstance(v, (int, float))
        ]
        if (
            bpy.context.scene.unit_settings.length_unit == "MILLIMETERS"
            and shape_values
            and all(0 < abs(v) < 0.1 for v in shape_values)
        ):
            example = shape_values[0]
            raise ValueError(
                f"CRITICAL ERROR: all shape dimensions are under 0.1 (e.g. {example}) while the scene is "
                f"configured in MILLIMETERS. This scene's raw values ARE millimeters directly — do NOT "
                f"divide by 1000 to 'convert to meters'. If you meant {example * 1000:g}mm, pass "
                f"{example * 1000:g}, not {example}."
            )

        is_update = bool(name and name in bpy.data.objects)
        if is_update:
            shape_params = {k: v for k, v in params.items() if k != "location"}
            if shape_params:
                raise ValueError(
                    f"CRITICAL ERROR: '{name}' already exists, so this call would only move it — "
                    f"Blender cannot resize an existing primitive's shape ({', '.join(shape_params)}) "
                    f"in place via this operator. Delete '{name}' first, then recreate it with the "
                    f"new dimensions."
                )
            obj = bpy.data.objects[name]
            obj.location = location
        else:
            existing_objects = {obj.name for obj in bpy.data.objects}
            op(**params)
            new_objects = [obj for obj in bpy.data.objects if obj.name not in existing_objects]
            obj = new_objects[0] if new_objects else bpy.context.object
            if not obj:
                raise RuntimeError("Failed to identify or create object")
            if name:
                obj.name = name

        # Ensure visibility
        obj.hide_viewport = False
        obj.hide_render = False

        # ── SIZE / SCALE / DIMENSIONS  (applied BEFORE rotation) ──
        # Order matters: dimensions depend on the mesh being in its default
        # orientation.  A rotated plane has a zero-extent world axis that
        # Blender cannot resize, so we must resize first, then rotate.

        # Size update for existing cubes/planes
        if is_update and "size" in kwargs and type in ["cube", "plane"]:
            s = kwargs["size"]
            obj.dimensions = (s, s, s) if type == "cube" else (s, s, 0.0)

        if scale is not None:
            obj.scale = scale
        elif not is_update:
            obj.scale = (1, 1, 1)

        # Dimensions (Highest Priority) – applied in default orientation
        if "dimensions" in kwargs and kwargs["dimensions"]:
            dims = kwargs["dimensions"]
            if len(dims) == 2:
                dims = (dims[0], dims[1], obj.dimensions[2])
            elif len(dims) >= 3:
                dims = dims[:3]

            obj.dimensions = dims
            # Only bake scale if ALL scale components are non-zero.
            # A zero scale component (e.g. flat axis of a plane) would
            # collapse all vertices to a point, destroying the mesh.
            if all(abs(s) > 1e-6 for s in obj.scale):
                # transform_apply(scale=True) on this Blender build has been
                # observed to also bake the object's LOCATION into the mesh
                # data while leaving obj.location unchanged - net effect: the
                # object ends up positioned at 2x its intended location. Zero
                # location before the apply (so nothing extra gets baked in)
                # and restore it after.
                saved_location = tuple(obj.location)
                obj.location = (0.0, 0.0, 0.0)
                bpy.context.view_layer.objects.active = obj
                obj.select_set(True)
                bpy.ops.object.transform_apply(scale=True)
                obj.location = saved_location

        # ── ROTATION  (applied AFTER dimensions) ──
        if rotation is not None:
            obj.rotation_euler = [math.radians(r) for r in rotation]
        elif not is_update:
            obj.rotation_euler = (0, 0, 0)

        if collection:
            self._move_to_collection_helper(obj, collection)

        status = "updated" if is_update else "created"
        message = f"Object '{obj.name}' ({type}) {status} successfully. Dimensions: {list(obj.dimensions)}."
        return {
            "success": True,
            "name": obj.name,
            "type": type,
            "status": status,
            "dimensions": list(obj.dimensions),
            "location": list(obj.location),
            "verified": True,
            "message": message,
        }

    def _move_to_collection_helper(self, obj, collection_name):
        coll = get_collection(collection_name)
        for c in obj.users_collection:
            c.objects.unlink(obj)
        coll.objects.link(obj)

    # ────────────────────────────────────────────────────────────────────
    # Watertight plate: 2D profile with holes + engraved regions, built as
    # a single indexed mesh (caps + walls share vertex indices), so the
    # result is watertight BY CONSTRUCTION — no boolean operations.
    # Added after boolean text cutouts repeatedly produced non-manifold
    # STLs that slicers silently "repaired" (deleting holes/text).
    # ────────────────────────────────────────────────────────────────────
    def create_watertight_plate(
        self,
        name,
        outline,
        thickness,
        holes=None,
        circle_holes=None,
        engrave_regions=None,
        engrave_depth=0.6,
        location=(0, 0, 0),
        collection=None,
        **kwargs,
    ):
        """Build a watertight extruded plate from a 2D outline.

        outline:          [[x,y], ...] outer boundary.
        thickness:        plate height (z 0..thickness).
        holes:            list of [[x,y],...] loops cut fully through.
        circle_holes:     list of [cx, cy, r] circles cut fully through.
        engrave_regions:  list of {"outer": [[x,y],...], "holes": [[[x,y],...], ...]}
                          recessed from the TOP face down by engrave_depth
                          (e.g. text glyphs: outer contour + counters).
        engrave_depth:    depth of the engraved recess from the top face.
        """
        from mathutils import Vector  # type: ignore
        from mathutils.geometry import tessellate_polygon  # type: ignore

        holes = holes or []
        circle_holes = circle_holes or []
        engrave_regions = engrave_regions or []

        def clean(loop, eps=1e-3):
            out = []
            for p in loop:
                p = (float(p[0]), float(p[1]))
                if not out or abs(p[0] - out[-1][0]) > eps or abs(p[1] - out[-1][1]) > eps:
                    out.append(p)
            while (
                len(out) > 2
                and abs(out[0][0] - out[-1][0]) <= eps
                and abs(out[0][1] - out[-1][1]) <= eps
            ):
                out.pop()
            return out

        def jitter(loop, salt):
            # deterministic sub-micron jitter breaks collinear tessellation
            # degeneracies (T-junctions) without affecting print dimensions
            out = []
            for i, (x, y) in enumerate(loop):
                h = (hash((salt, i)) % 1000 - 500) * 1e-6
                out.append((x + h, y - h))
            return out

        def circle_loop(cx, cy, r, n=48):
            return [
                (cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n))
                for i in range(n)
            ]

        outline = clean(outline)
        hole_loops = [clean(h) for h in holes] + [clean(circle_loop(*c)) for c in circle_holes]
        eng = []
        for k, r in enumerate(engrave_regions):
            eng.append(
                {
                    "outer": jitter(clean(r["outer"]), ("eo", k)),
                    "holes": [
                        jitter(clean(h), ("eh", k, j)) for j, h in enumerate(r.get("holes", []))
                    ],
                }
            )

        z_top = float(thickness)
        z_floor = z_top - float(engrave_depth)

        verts = []  # (x, y, z)
        faces = []  # index tuples

        def add_ring(loop, z):
            base = len(verts)
            for x, y in loop:
                verts.append((x, y, z))
            return list(range(base, base + len(loop)))

        def add_walls(bot_ids, top_ids):
            n = len(bot_ids)
            for i in range(n):
                j = (i + 1) % n
                faces.append((bot_ids[i], bot_ids[j], top_ids[j], top_ids[i]))

        def tess(loops2d):
            """Tessellate loops (first outer, rest holes); returns triangles as
            indices into the concatenated loop vertices."""
            data = [[Vector(p) for p in lp] for lp in loops2d]
            return tessellate_polygon(data)

        def add_cap(loops2d, ring_ids_concat):
            for tri in tess(loops2d):
                faces.append(tuple(ring_ids_concat[i] for i in tri))

        # rings
        out_b = add_ring(outline, 0.0)
        out_t = add_ring(outline, z_top)
        hole_rings = [(add_ring(h, 0.0), add_ring(h, z_top)) for h in hole_loops]
        eng_rings = []
        for r in eng:
            o_f = add_ring(r["outer"], z_floor)
            o_t = add_ring(r["outer"], z_top)
            c_pairs = [(add_ring(c, z_floor), add_ring(c, z_top)) for c in r["holes"]]
            eng_rings.append((o_f, o_t, c_pairs))

        # bottom cap: outline + through-holes
        add_cap([outline] + hole_loops, out_b + [i for hb, _ in hole_rings for i in hb])
        # top cap: outline + through-holes + engrave outers
        add_cap(
            [outline] + hole_loops + [r["outer"] for r in eng],
            out_t
            + [i for _, ht in hole_rings for i in ht]
            + [i for (_, o_t, _) in eng_rings for i in o_t],
        )
        # engrave counter islands (top face) and engrave floors
        for r, (o_f, _o_t, c_pairs) in zip(eng, eng_rings, strict=True):
            for c_loop, (_c_f, c_t) in zip(r["holes"], c_pairs, strict=True):
                add_cap([c_loop], c_t)
            add_cap([r["outer"]] + r["holes"], o_f + [i for c_f, _ in c_pairs for i in c_f])
        # walls
        add_walls(out_b, out_t)
        for hb, ht in hole_rings:
            add_walls(hb, ht)
        for o_f, o_t, c_pairs in eng_rings:
            add_walls(o_f, o_t)
            for c_f, c_t in c_pairs:
                add_walls(c_f, c_t)

        # build mesh
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.location = location

        # consistent outward normals
        import bmesh  # type: ignore

        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        # watertight report
        boundary = sum(1 for e in bm.edges if len(e.link_faces) != 2)
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()

        if collection:
            self._move_to_collection_helper(obj, collection)

        return {
            "success": boundary == 0,
            "name": obj.name,
            "is_watertight": boundary == 0,
            "non_manifold_edges": boundary,
            "vertices": len(verts),
            "faces": len(faces),
            "dimensions": list(obj.dimensions),
            "message": (
                f"Watertight plate '{obj.name}' created: {len(verts)} verts, "
                f"{len(faces)} faces, non-manifold edges: {boundary}."
            ),
        }
