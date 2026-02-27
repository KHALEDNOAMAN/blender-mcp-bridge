import bpy
import math
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
        elif type == "torus":
            if "major_radius" in kwargs:
                params["major_radius"] = kwargs["major_radius"]
            if "minor_radius" in kwargs:
                params["minor_radius"] = kwargs["minor_radius"]
            if "major_segments" in kwargs:
                params["major_segments"] = kwargs["major_segments"]
            if "minor_segments" in kwargs:
                params["minor_segments"] = kwargs["minor_segments"]

        is_update = bool(name and name in bpy.data.objects)
        if is_update:
            obj = bpy.data.objects[name]
            obj.location = location
        else:
            existing_objects = {obj.name for obj in bpy.data.objects}
            op(**params)
            new_objects = [
                obj for obj in bpy.data.objects if obj.name not in existing_objects
            ]
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
                dims = (dims[0], dims[1], obj.dimensions.z)
            elif len(dims) >= 3:
                dims = dims[:3]

            obj.dimensions = dims
            # Only bake scale if ALL scale components are non-zero.
            # A zero scale component (e.g. flat axis of a plane) would
            # collapse all vertices to a point, destroying the mesh.
            if all(abs(s) > 1e-6 for s in obj.scale):
                bpy.context.view_layer.objects.active = obj
                obj.select_set(True)
                bpy.ops.object.transform_apply(scale=True)

        # ── ROTATION  (applied AFTER dimensions) ──
        if rotation is not None:
            obj.rotation_euler = [math.radians(r) for r in rotation]
        elif not is_update:
            obj.rotation_euler = (0, 0, 0)

        if collection:
            self._move_to_collection_helper(obj, collection)

        status = "updated" if is_update else "created"
        return {
            "success": True,
            "name": obj.name,
            "type": type,
            "status": status,
            "dimensions": list(obj.dimensions),
            "location": list(obj.location),
            "verified": True,
            "message": f"Object '{obj.name}' ({type}) {status} successfully. Dimensions: {list(obj.dimensions)}.",
        }

    def _move_to_collection_helper(self, obj, collection_name):
        coll = get_collection(collection_name)
        for c in obj.users_collection:
            c.objects.unlink(obj)
        coll.objects.link(obj)
