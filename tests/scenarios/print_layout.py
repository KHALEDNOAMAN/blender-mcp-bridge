# src/tests/scenarios/print_layout.py

import json

from tests.utils.mcp_client import MCPClient


class PrintScenario:
    """Replicates a 3D Printing preparation pipeline (Calibration Jack)."""

    def __init__(self, client: MCPClient):
        self.client = client

    def run(self):
        print("=" * 60)
        print("3D Printing Pipeline — Integration Test")
        print("=" * 60)

        # 1. Set units to millimeters (Standard for 3D Printing)
        print("\n1. Setting Scene Units to Millimeters...")
        self.client.call_tool(
            "set_scene_units",
            {"system": "METRIC", "length_unit": "MILLIMETERS", "scale": 0.001},
        )

        # 2. Create the intersecting primitives for the calibration Jack
        print("\n2. Generating calibration Jack geometry...")

        # Center Sphere
        print("  Creating Center Sphere...")
        self.client.call_tool(
            "create_sphere", {"location": [0.0, 0.0, 0.0], "radius": 2.0, "name": "Sphere"}
        )

        # Vertical Cylinder (Z-axis)
        print("  Creating Vertical Cylinder...")
        self.client.call_tool(
            "create_cylinder",
            {"location": [0.0, 0.0, 0.0], "radius": 0.8, "depth": 6.0, "name": "Cyl_Z"},
        )

        # Horizontal Cylinder (Y-axis)
        print("  Creating Horizontal Y-Cylinder...")
        self.client.call_tool(
            "create_cylinder",
            {
                "location": [0.0, 0.0, 0.0],
                "radius": 0.8,
                "depth": 6.0,
                "rotation": [90.0, 0.0, 0.0],
                "name": "Cyl_Y",
            },
        )

        # Horizontal Cylinder (X-axis)
        print("  Creating Horizontal X-Cylinder...")
        self.client.call_tool(
            "create_cylinder",
            {
                "location": [0.0, 0.0, 0.0],
                "radius": 0.8,
                "depth": 6.0,
                "rotation": [0.0, 90.0, 0.0],
                "name": "Cyl_X",
            },
        )

        # 3. Check Topology of Sphere before join
        print("\n3. Checking Topology of Sphere...")
        check_res = self.client.call_tool("check_mesh_for_printing", {"object_name": "Sphere"})
        print("Result:", json.dumps(check_res, indent=2))

        # 4. Join all parts into a single mesh group
        print("\n4. Joining parts into a single mesh group...")
        join_res = self.client.call_tool(
            "join_objects",
            {
                "object_names": ["Sphere", "Cyl_Z", "Cyl_Y", "Cyl_X"],
                "active_object": "Sphere",
                "new_name": "CalibrationJack",
            },
        )
        print("Join Result:", json.dumps(join_res, indent=2))

        # 5. Apply Voxel Remesh to fuse all intersections into a watertight volume
        print("\n5. Applying Voxel Remesh to fuse geometry...")
        remesh_res = self.client.call_tool(
            "apply_voxel_remesh",
            {"object_name": "CalibrationJack", "voxel_size": 0.08, "adaptivity": 0.1},
        )
        print("Remesh Result:", json.dumps(remesh_res, indent=2))

        # 6. Shift object up so the bottom sits at Z = 0
        print("\n6. Shifting CalibrationJack to sit on the build plate (Z=0)...")
        shift_res = self.client.call_tool(
            "transform_object",
            {"object_name": "CalibrationJack", "location": [0.0, 0.0, 3.0]},
        )
        print("Shift Result:", json.dumps(shift_res, indent=2))

        # 7. Export the final fused watertight STL
        print("\n7. Exporting CalibrationJack to STL...")
        export_res = self.client.call_tool(
            "export_model",
            {
                "object_name": "CalibrationJack",
                "filepath": "calibration_jack.stl",
                "format": "STL",
            },
        )
        print("Export Result:", json.dumps(export_res, indent=2))

        print("=" * 60)
        print("✅ 3D Printing Pipeline scenario complete.")
        print("=" * 60)
