import bpy

from ...utils import hex_to_rgb


class ModelingSystems:
    def build_pipe_run(
        self,
        points,
        system_type,
        radius=0.05,
        name="Pipe_Run",
        collection=None,
        add_fittings=False,
    ):
        """Create a straight pipe segment or multi-point sequence (X, Y, Z, or diagonal)."""
        if len(points) < 2:
            return {
                "status": "error",
                "message": "At least two points required for a pipe run",
            }

        SYSTEM_COLORS = {
            "WATER": "#2E5BFF",
            "CHILLER": "#00D1FF",
            "FIRE": "#FF3B30",
            "GAS": "#FFCC00",
            "DRAINAGE": "#34C759",
        }

        color = SYSTEM_COLORS.get(system_type, "#808080")
        mat_name = f"MAT_MEP_{system_type}"
        mat = bpy.data.materials.get(mat_name)
        if not mat:
            mat = bpy.data.materials.new(name=mat_name)
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            rgb = hex_to_rgb(color)
            bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
            bsdf.inputs["Roughness"].default_value = 0.2
            if system_type in ["WATER", "CHILLER"]:
                bsdf.inputs["Metallic"].default_value = 0.3

        created_objs = []
        from mathutils import Vector

        # 1. Create Segments (handles X, Y, Z and Diagonals naturally)
        for i in range(len(points) - 1):
            p1, p2 = Vector(points[i]), Vector(points[i + 1])
            dist = (p2 - p1).length
            if dist < 0.001:
                continue

            center = (p1 + p2) / 2
            obj_name = f"{name}_{i:02d}"
            bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=dist, location=center)
            obj = bpy.context.active_object
            obj.name = obj_name

            # Orient cylinder from Z-up to segment direction
            direction = (p2 - p1).normalized()
            rot_quat = Vector((0, 0, 1)).rotation_difference(direction)
            obj.rotation_mode = "QUATERNION"
            obj.rotation_quaternion = rot_quat

            if len(obj.data.materials) == 0:
                obj.data.materials.append(mat)
            else:
                obj.data.materials[0] = mat

            col_target = collection or "MEP_Systems"
            coll = bpy.data.collections.get(col_target) or bpy.data.collections.new(col_target)
            if col_target not in bpy.context.scene.collection.children:
                bpy.context.scene.collection.children.link(coll)
            for c in list(obj.users_collection):
                c.objects.unlink(obj)
            coll.objects.link(obj)

            created_objs.append(obj.name)

        # 2. Automated Junction Spheres (fill mechanical gaps at transitions)
        if add_fittings and len(points) > 2:
            for i in range(1, len(points) - 1):
                p_prev = Vector(points[i - 1])
                p_next = Vector(points[i + 1])

                # SKIP joint if it's a "tip" or turn-around (P_prev == P_next)
                if (p_prev - p_next).length < 0.001:
                    continue

                # OPTIONAL: Skip if it's a perfectly straight run (no angle)
                # But for now, we'll keep them to bridge separate cylinder segments cleanly

                self._add_pipe_fitting(
                    location=points[i],
                    fitting_type="JOINT",
                    system_type=system_type,
                    radius=radius,
                    name=f"{name}_Joint_{i:02d}",
                    collection=collection,
                )

        return {"status": "success", "objects": created_objs}

    def _add_pipe_fitting(
        self,
        location,
        fitting_type,
        system_type,
        rotation=(0, 0, 0),
        radius=0.05,
        name="Fitting",
        collection=None,
    ):
        """Internal helper to add a junction sphere to bridge pipe transitions."""
        # Use a large junction sphere (1.4x) to ensure overlap across X, Y, and Z
        joint_radius = radius * 1.4

        bpy.ops.mesh.primitive_uv_sphere_add(radius=joint_radius, location=location)
        obj = bpy.context.active_object
        obj.name = f"{name}_{fitting_type}"

        # Consistent with user request: joints do not have materials to stand out as visual nodes

        col_target = collection or "MEP_Fittings"
        coll = bpy.data.collections.get(col_target) or bpy.data.collections.new(col_target)
        if col_target not in bpy.context.scene.collection.children:
            bpy.context.scene.collection.children.link(coll)
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        coll.objects.link(obj)

        return {"status": "success"}

    def build_cable_tray(
        self,
        points,
        width=0.3,
        depth=0.05,
        tray_type="LADDER",
        system_type="POWER",
        name="Cable_Tray",
        collection=None,
        auto_support_spacing=None,
        auto_support_type="TRAPEZE_HANGER",
        support_start_offset=0.2,
        height_to_ceiling=0.5,
        side_direction=None,
        supports=None,
    ):
        """Create a multi-segment cable tray run and optionally add supports."""
        if len(points) < 2:
            return {
                "status": "error",
                "message": "At least two points required for a tray run",
            }

        from mathutils import Vector

        created_objs = []
        segments = []  # (v1, v2, length) for support distribution

        # 1. Create Segments
        for i in range(len(points) - 1):
            v1, v2 = Vector(points[i]), Vector(points[i + 1])
            length = (v2 - v1).length
            if length < 0.001:
                continue

            direction = (v2 - v1).normalized()
            center = (v1 + v2) / 2

            bpy.ops.mesh.primitive_cube_add(size=1.0, location=center)
            tray = bpy.context.active_object
            tray.name = f"{name}_{i:02d}"
            tray.scale = (length, width, depth)

            rot_quat = Vector((1, 0, 0)).rotation_difference(direction)
            tray.rotation_mode = "QUATERNION"
            tray.rotation_quaternion = rot_quat
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

            # Material logic
            TRAY_COLORS = {
                "POWER": "#333333",  # Dark gray
                "DATA": "#FFCC00",  # Yellow
                "FIBER": "#FF9900",  # Orange
                "FIRE_ALARM": "#FF3333",  # Red
            }
            color_hex = TRAY_COLORS.get(system_type, "#333333")

            mat_name = f"MAT_MEP_TRAY_{system_type}"
            mat = bpy.data.materials.get(mat_name)
            if not mat:
                mat = bpy.data.materials.new(name=mat_name)
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                rgb = hex_to_rgb(color_hex)
                bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
                bsdf.inputs["Metallic"].default_value = 0.8
                bsdf.inputs["Roughness"].default_value = 0.4
            if len(tray.data.materials) == 0:
                tray.data.materials.append(mat)

            col_target = collection or "MEP_Trays"
            coll = bpy.data.collections.get(col_target) or bpy.data.collections.new(col_target)
            if col_target not in bpy.context.scene.collection.children:
                bpy.context.scene.collection.children.link(coll)
            for c in list(tray.users_collection):
                c.objects.unlink(tray)
            coll.objects.link(tray)

            created_objs.append(tray.name)
            segments.append((v1, v2, length, direction))

        # 2. Bridge gaps with fittings (internal joints)
        for i in range(1, len(points) - 1):
            # Direction of joint is average of previous and next segment
            dir_in = segments[i - 1][3]
            dir_out = segments[i][3]
            joint_dir = (dir_in + dir_out).normalized()

            self._add_tray_fitting(
                location=points[i],
                direction=joint_dir,
                width=width,
                depth=depth,
                system_type=system_type,
                name=f"{name}_Joint_{i:02d}",
                collection=collection,
            )

        # 2. Automated Spacing (distribute across all segments)
        if auto_support_spacing and auto_support_spacing > 0.1:
            total_length = sum(s[2] for s in segments)

            # Place supports at intervals starting from the specified offset
            current_target = support_start_offset
            while current_target <= total_length - 0.1:  # End buffer of 0.1m
                # Find which segment this point falls into
                acc_len = 0.0
                for v1, v2, seg_len, direction in segments:
                    # Check if target is within this segment
                    if acc_len <= current_target <= acc_len + seg_len + 0.001:
                        # SLOPE DETECTION: Skip if segment is not horizontal (Z-direction > 0.1)
                        if abs(direction.z) > 0.1:
                            break  # Skip this segment

                        # Joint avoidance: skip if too close to segment start or end joints (within 0.1m)
                        dist_from_seg_start = current_target - acc_len
                        dist_from_seg_end = (acc_len + seg_len) - current_target

                        if dist_from_seg_start > 0.1 and dist_from_seg_end > 0.1:
                            # Interpolate on this segment
                            t = dist_from_seg_start / seg_len if seg_len > 0 else 0
                            t = max(0, min(1, t))
                            loc = v1 + (v2 - v1) * t
                            self.add_tray_support(
                                location=list(loc),
                                support_type=auto_support_type,
                                height_to_ceiling=height_to_ceiling,
                                width=width,
                                system_type=system_type,
                                name=f"{name}_AutoSupp",
                                collection=collection,
                                direction=list(direction),
                                side_direction=side_direction,
                            )
                        break
                    acc_len += seg_len
                current_target += auto_support_spacing

        # 3. Manual Supports
        if supports:
            valid_keys = [
                "location",
                "support_type",
                "height_to_ceiling",
                "width",
                "system_type",
                "collection",
                "direction",
                "side_direction",
                "rotation",
            ]
            for s_args in supports:
                filtered = {k: v for k, v in s_args.items() if k in valid_keys}
                # Use defaults from tray if missing
                if "width" not in filtered:
                    filtered["width"] = width
                if "collection" not in filtered:
                    filtered["collection"] = collection
                if "system_type" not in filtered:
                    filtered["system_type"] = system_type

                self.add_tray_support(**filtered)

        return {"status": "success", "objects": created_objs}

    def _add_tray_fitting(
        self,
        location,
        direction=None,
        width=0.3,
        depth=0.05,
        system_type="POWER",
        name="Tray_Joint",
        collection=None,
    ):
        """Internal helper to add a cylinder hinge to bridge tray rotations."""
        from mathutils import Vector

        # 1. Determine local width axis (pivot axis)
        # Using Cross(Dir, Up) to find the 'Side' vector
        up = Vector((0, 0, 1))
        fwd = Vector(direction) if direction else Vector((1, 0, 0))

        # Fallback if fwd is vertical
        if abs(fwd.dot(up)) > 0.999:
            side = Vector((0, 1, 0))
        else:
            side = fwd.cross(up).normalized()

        # 2. Create Hinge Cylinder
        # Radius is slightly larger than tray depth half (e.g. depth=0.05 -> radius=0.03)
        radius = depth * 0.6

        bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=width, location=location)
        obj = bpy.context.active_object
        obj.name = name

        # Orient to 'side' axis
        rot_quat = Vector((0, 0, 1)).rotation_difference(side)
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = rot_quat

        # Match tray material
        mat_name = f"MAT_MEP_TRAY_{system_type}"
        mat = bpy.data.materials.get(mat_name)
        if mat and len(obj.data.materials) == 0:
            obj.data.materials.append(mat)

        col_target = collection or "MEP_Fittings"
        coll = bpy.data.collections.get(col_target) or bpy.data.collections.new(col_target)
        if col_target not in bpy.context.scene.collection.children:
            bpy.context.scene.collection.children.link(coll)
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        coll.objects.link(obj)

        return {"status": "success"}

    def add_tray_support(
        self,
        location,
        support_type,
        height_to_ceiling=0.5,
        width=0.3,
        system_type="POWER",
        name="Tray_Support",
        collection=None,
        direction=None,
        side_direction=None,
        rotation=None,
    ):
        """Add tray support variants with context."""
        from mathutils import Vector

        objs = []

        up = Vector((0, 0, 1))
        fwd = Vector(direction) if direction else Vector((1, 0, 0))
        if abs(fwd.dot(up)) > 0.999:
            side = Vector((0, 1, 0))
        else:
            side = fwd.cross(up).normalized()

        # Allow explicit override so wall/cantilever brackets can be placed
        # toward the correct wall face regardless of tray axis direction.
        if side_direction is not None:
            side = Vector(side_direction).normalized()

        # Euler Rotation Override (Z-Up default)
        final_rot_quat = None
        if rotation:
            import math

            euler = [math.radians(r) for r in rotation]
            from mathutils import Euler

            final_rot_quat = Euler(euler, "XYZ").to_quaternion()

        if support_type == "TRAPEZE_HANGER" or support_type == "DOUBLE_TRAPEZE":
            # Rod height adjustment: stop at underside of slab (Z-0.025)
            # Trapeze consists of: 1-2 crossbars + 2 vertical rods
            rod_radius = 0.008
            rod_len = height_to_ceiling - 0.025

            # 1. Crossbars (horizontal)
            levels = [0.0]
            if support_type == "DOUBLE_TRAPEZE":
                levels.append(-0.2)  # Second bar 20cm below first

            for z_off in levels:
                bpy.ops.mesh.primitive_cylinder_add(
                    radius=0.012,
                    depth=width + 0.1,  # Extend slightly past tray width
                    location=(location[0], location[1], location[2] + z_off),
                )
                bar = bpy.context.active_object
                rot_quat = Vector((0, 0, 1)).rotation_difference(side)
                bar.rotation_mode = "QUATERNION"
                bar.rotation_quaternion = rot_quat
                objs.append(bar)

            # 2. Rods (vertical)
            offset = width / 2
            max_z_off = max(levels)
            min_z_off = min(levels)
            total_rod_len = rod_len + abs(min_z_off)

            for sign in [-1, 1]:
                rod_loc = Vector(location) + side * (offset * sign)
                rod_loc.z += max_z_off + rod_len / 2 + min_z_off / 2
                bpy.ops.mesh.primitive_cylinder_add(
                    radius=rod_radius,
                    depth=total_rod_len,
                    location=(rod_loc.x, rod_loc.y, rod_loc.z),
                )
                objs.append(bpy.context.active_object)

        elif support_type == "CANTILEVER_BRACKET":
            # Horizontal Arm extending along the 'side' vector
            arm_len = 0.4
            arm_width = 0.04
            # Positioning: Arm center is half-way along 'side'
            arm_center = Vector(location) + side * (arm_len / 2 - 0.05)
            arm_center.z -= 0.03

            bpy.ops.mesh.primitive_cube_add(location=arm_center)
            arm = bpy.context.active_object
            arm.scale = (arm_width, arm_len, arm_width)
            # Standard cube is 1x1x1. Scale it.
            # We need to rotate it to align with 'side'
            rot_quat = Vector((0, 1, 0)).rotation_difference(side)
            arm.rotation_mode = "QUATERNION"
            arm.rotation_quaternion = rot_quat
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            objs.append(arm)

            # Wall Plate (perpendicular to 'side')
            # Standard Fixed Bracket Size
            plate_height = 0.4
            plate_loc = Vector(location) + side * (arm_len - 0.05)
            # Center the plate on the arm/tray level (ignore height_to_ceiling)
            bpy.ops.mesh.primitive_cube_add(location=plate_loc)
            plate = bpy.context.active_object
            plate.scale = (0.1, 0.015, plate_height)
            # Plate faces 'side' direction
            plate.rotation_mode = "QUATERNION"
            plate.rotation_quaternion = rot_quat
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            objs.append(plate)

        elif support_type == "WALL_BRACKET":
            # Vertical Wall Support with small ledge
            # Wall Plate (Back)
            # Standard Fixed Bracket Size (ignore height_to_ceiling)
            plate_height = 0.4
            plate_loc = Vector(location) + side * 0.25
            bpy.ops.mesh.primitive_cube_add(location=plate_loc)
            plate = bpy.context.active_object
            plate.scale = (0.1, 0.015, plate_height)
            rot_quat = Vector((0, 1, 0)).rotation_difference(side)
            plate.rotation_mode = "QUATERNION"
            plate.rotation_quaternion = rot_quat
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            objs.append(plate)

            # Ledge (Under Tray)
            ledge_loc = Vector(location) + side * 0.125
            ledge_loc.z -= 0.04
            bpy.ops.mesh.primitive_cube_add(location=ledge_loc)
            ledge = bpy.context.active_object
            ledge.scale = (0.2, 0.15, 0.02)
            ledge.rotation_mode = "QUATERNION"
            ledge.rotation_quaternion = rot_quat
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            objs.append(ledge)

        else:
            bpy.ops.mesh.primitive_cube_add(size=0.05, location=location)
            objs.append(bpy.context.active_object)

        # Apply material
        mat_name = "MAT_MEP_SUPPORT"
        mat = bpy.data.materials.get(mat_name)
        if not mat:
            mat = bpy.data.materials.new(name=mat_name)
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            bsdf.inputs["Base Color"].default_value = (0.5, 0.5, 0.5, 1.0)
            bsdf.inputs["Metallic"].default_value = 0.9
            bsdf.inputs["Roughness"].default_value = 0.3

        if mat:
            for obj in objs:
                if len(obj.data.materials) == 0:
                    obj.data.materials.append(mat)
                else:
                    obj.data.materials[0] = mat

        col_target = collection or "MEP_Supports"
        coll = bpy.data.collections.get(col_target) or bpy.data.collections.new(col_target)
        if col_target not in bpy.context.scene.collection.children:
            bpy.context.scene.collection.children.link(coll)

        for obj in objs:
            obj.name = f"{name}_{support_type}"
            for c in list(obj.users_collection):
                c.objects.unlink(obj)
            coll.objects.link(obj)

            if final_rot_quat:
                obj.rotation_mode = "QUATERNION"
                obj.rotation_quaternion = final_rot_quat @ obj.rotation_quaternion

        return {"status": "success", "objects": [o.name for o in objs]}
