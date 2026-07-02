"""
Filament Name Tag & Stand System (Redesigned v3)
================================================
Produces 4 separate, material-efficient 3D-printable pieces:

1. NameTagCard (55 × 70 × 2.2 mm)
   - Raised 2 mm border frame on front face
   - 3 lines of raised text ("Bambu Lab", "PLA Basic", "Cyan (10603)")
   - Gravity drop-and-lock L-slot at the top-left to prevent sliding off under vibration

2. AMSClip (16 × 6.8 × 17 mm)
   - Clips directly onto the front lip of the Bambu AMS (snug 2.8 mm rim gap)
   - T-peg slide-on rail on the front

3. StickonHolder (20 × 2 × 15 mm base)
   - Flat-back mounting bracket for adhesive/double-sided tape
   - Minimalist T-peg slide-on rail

4. DeskStand (40 × 40 mm base, 35 mm height)
   - Sleek "crane" design that lets the card hang vertically like a sign
   - Prints flat on its side without supports
   - T-peg slide-on rail at the top

T-Peg / L-Slot Interface:
   - T-peg Neck: 12.0 mm wide × 3.8 mm high × 3.0 mm deep
   - T-peg Lip: 16.0 mm wide × 6.0 mm high × 1.2 mm deep
   - Card L-Slot:
     * Horizontal entry channel: 4.2 mm high, open at left, runs to X = +6.1 mm
     * Vertical locking pocket: 12.2 mm wide, extends up to Y = 29.0 mm
     * Gravity lock: Release card -> drops 3 mm -> locked in place by front lip and channel edge
"""

from tests.utils.mcp_client import MCPClient

# ─── Shared Dimensions ────────────────────────────────────────────────────────
CARD_W, CARD_H, CARD_D = 55.0, 40.0, 2.2  # mm (H: 70 -> 40 for correct desk clearance)
BORDER = 2.0  # Raised border thickness
RECESS_DEPTH = 1.2  # Depth of front-face recess
CARD_FRONT_Z = CARD_D  # Front face height (Z = 2.2)

# T-Peg interface dimensions
PEG_NECK_W = 12.0
PEG_NECK_H = 3.8
PEG_NECK_D = 3.0

PEG_LIP_W = 16.0
PEG_LIP_H = 6.0
PEG_LIP_D = 1.2

# Slot dimensions (with 0.1 mm print clearance)
SLOT_H = PEG_NECK_H + 0.4  # 4.2 mm entry height
SLOT_W_STOP = (PEG_NECK_W / 2) + 0.1  # +6.1 mm (right-side stop for centering)
LOCK_HEIGHT = 6.0  # height of vertical pocket

# Scene X offsets for the 4 pieces
X_CARD = 0.0
X_CLIP = 80.0
X_HOLD = 160.0
X_STAND = 240.0
# ──────────────────────────────────────────────────────────────────────────────


class FilamentTagLayout:
    def __init__(self, client: MCPClient):
        self.client = client

    def _step(self, num, desc):
        print(f"\n[{num}] {desc}...")

    def _cube(self, name, loc, scale, rotation=None):
        """Create a cube with given half-extents (scale) and apply transforms."""
        params = {"name": name, "location": loc, "scale": scale, "size": 2.0}
        if rotation:
            params["rotation"] = rotation
        self.client.call_tool("create_cube", params)
        apply_args = {"object_names": [name], "scale": True, "location": True}
        if rotation:
            apply_args["rotation"] = True
        self.client.call_tool("apply_transforms", apply_args)

    def _bool_diff(self, target, cutter):
        """Boolean DIFFERENCE, apply modifier, delete cutter."""
        self.client.call_tool(
            "boolean_operation",
            {
                "object_a": target,
                "object_b": cutter,
                "operation": "DIFFERENCE",
                "solver": "MANIFOLD",
                "hide_cutter": True,
            },
        )
        self.client.call_tool("apply_all_modifiers", {"object_name": target})
        self.client.call_tool("delete_object", {"object_name": cutter})

    # ══════════════════════════════════════════════════════════════════════════
    def run(self):
        print("=" * 60)
        print("Filament Name Tag & Clip System — Redesign v3")
        print("=" * 60)

        c = self.client

        # Set scene to metric millimetres
        self._step(0, "Setting scene to metric millimetres")
        c.call_tool("set_scene_units", {"system": "METRIC", "length_unit": "MILLIMETERS"})

        # ══════════════════════════════════════════════════════════════════════
        # PIECE 1 — NAME TAG CARD (with Gravity L-Slot)
        # ══════════════════════════════════════════════════════════════════════
        self._step(1, "Creating Hanging Name Tag Card")

        # 1a. Base card body (centered at (X_CARD, 0, CARD_D/2) so it rests on Z=0)
        self._cube(
            "CardBody", loc=[X_CARD, 0.0, CARD_D / 2], scale=[CARD_W / 2, CARD_H / 2, CARD_D / 2]
        )

        # 1b. Raised border recess on front face
        inner_w = CARD_W - 2 * BORDER
        inner_h = CARD_H - 2 * BORDER
        recess_z = CARD_FRONT_Z - RECESS_DEPTH / 2
        self._cube(
            "BorderCutter",
            loc=[X_CARD, 0.0, recess_z],
            scale=[inner_w / 2, inner_h / 2, RECESS_DEPTH / 2],
        )
        self._bool_diff("CardBody", "BorderCutter")

        # 1c. Gravity L-Slot cutters
        # Entry channel (horizontal slot starting from left edge)
        # Left edge is X = -27.5, right stop is X = 6.1 (total width 33.6)
        entry_w = (CARD_W / 2) + SLOT_W_STOP
        entry_cx = X_CARD - (CARD_W / 4) + (SLOT_W_STOP / 2)
        self._cube(
            "EntrySlotCutter",
            loc=[entry_cx, 12.0, CARD_D / 2],
            scale=[entry_w / 2, SLOT_H / 2, CARD_D],
        )
        self._bool_diff("CardBody", "EntrySlotCutter")

        # Vertical locking pocket (extends upward to Y = 18.0)
        # Pocket covers X = -6.1 to +6.1 (width 12.2) and Y = 12.0 to 18.0 (height 6.0)
        self._cube(
            "LockPocketCutter",
            loc=[X_CARD, 15.0, CARD_D / 2],
            scale=[SLOT_W_STOP, LOCK_HEIGHT / 2, CARD_D],
        )
        self._bool_diff("CardBody", "LockPocketCutter")

        # 1d. Raised text (extrudes +0.8 mm out of the recess)
        self._step(2, "Adding text inside the card recess")
        text_configs = [
            ("Bambu Lab", 3.0, 4.0),
            ("PLA Basic", 7.0, -5.0),
            ("Cyan (10603)", 3.5, -13.0),
        ]

        text_names = []
        for i, (txt, sz, y_base) in enumerate(text_configs):
            t_name = f"CardText_{i}"
            c.call_tool(
                "create_text",
                {
                    "name": t_name,
                    "text": txt,
                    "location": [X_CARD, y_base, CARD_FRONT_Z],
                    "size": sz,
                    "extrude": 0.8,
                    "align_x": "CENTER",
                },
            )
            c.call_tool("convert_to_mesh", {"object_name": t_name})
            text_names.append(t_name)

        # 1e. Join card body and text
        c.call_tool(
            "join_objects",
            {
                "object_names": ["CardBody"] + text_names,
                "active_object": "CardBody",
                "new_name": "NameTagCard",
            },
        )

        # ══════════════════════════════════════════════════════════════════════
        # PIECE 2 — AMS LIP CLIP (snug 2.8 mm rim gap)
        # ══════════════════════════════════════════════════════════════════════
        self._step(3, "Creating AMS Lip Clip")

        # Clip body (outer block)
        # Width: 16.0, Depth: 6.8 (2.0 + 2.8 + 2.0), Height: 17.0
        self._cube("AMSClipOuter", loc=[X_CLIP, 0.0, 8.5], scale=[8.0, 3.4, 8.5])

        # U-channel gap cutter (depth: 2.8, height: 15.0)
        self._cube("AMSClipGap", loc=[X_CLIP, 0.0, 7.5], scale=[10.0, 1.4, 7.5])
        self._bool_diff("AMSClipOuter", "AMSClipGap")

        # T-Peg Neck on the front face (at Y = -3.4)
        # Width: 12.0, Depth: 3.0 (protrudes Y: -3.4 to -6.4), Height: 3.8 (centered at Z = 6.9)
        self._cube(
            "ClipPegNeck",
            loc=[X_CLIP, -4.9, 6.9],
            scale=[PEG_NECK_W / 2, PEG_NECK_D / 2, PEG_NECK_H / 2],
        )

        # T-Peg Front Lip (at Y = -6.4)
        # Width: 16.0, Depth: 1.2 (protrudes Y: -6.4 to -7.6), Height: 6.0
        self._cube(
            "ClipPegLip",
            loc=[X_CLIP, -7.0, 6.9],
            scale=[PEG_LIP_W / 2, PEG_LIP_D / 2, PEG_LIP_H / 2],
        )

        # Join clip components
        c.call_tool(
            "join_objects",
            {
                "object_names": ["AMSClipOuter", "ClipPegNeck", "ClipPegLip"],
                "active_object": "AMSClipOuter",
                "new_name": "AMSClip",
            },
        )

        # ══════════════════════════════════════════════════════════════════════
        # PIECE 3 — SLIM STICK-ON HOLDER (flat back)
        # ══════════════════════════════════════════════════════════════════════
        self._step(4, "Creating Slim Stick-on Holder")

        # Base plate (20 × 2 × 15 mm)
        self._cube("HolderBase", loc=[X_HOLD, 0.0, 7.5], scale=[10.0, 1.0, 7.5])

        # T-Peg Neck on the front face (at Y = -1.0)
        # Width: 12.0, Depth: 3.0 (protrudes Y: -1.0 to -4.0), Height: 3.8
        self._cube(
            "HolderPegNeck",
            loc=[X_HOLD, -2.5, 6.9],
            scale=[PEG_NECK_W / 2, PEG_NECK_D / 2, PEG_NECK_H / 2],
        )

        # T-Peg Front Lip (at Y = -4.0)
        # Width: 16.0, Depth: 1.2 (protrudes Y: -4.0 to -5.2), Height: 6.0
        self._cube(
            "HolderPegLip",
            loc=[X_HOLD, -4.6, 6.9],
            scale=[PEG_LIP_W / 2, PEG_LIP_D / 2, PEG_LIP_H / 2],
        )

        # Join holder components
        c.call_tool(
            "join_objects",
            {
                "object_names": ["HolderBase", "HolderPegNeck", "HolderPegLip"],
                "active_object": "HolderBase",
                "new_name": "StickonHolder",
            },
        )

        # ══════════════════════════════════════════════════════════════════════
        # PIECE 4 — SLEEK DESK STAND (crane-style hanging mount)
        # ══════════════════════════════════════════════════════════════════════
        self._step(5, "Creating Sleek Desk Stand")

        # Base plate (40 × 40 × 3 mm)
        self._cube("StandBase", loc=[X_STAND, 0.0, 1.5], scale=[20.0, 20.0, 1.5])

        # Vertical post (8 × 8 × 45 mm, placed at the back Y = 16.0)
        # Post extends from Z = 1.5 to Z = 46.5
        self._cube("StandPost", loc=[X_STAND, 16.0, 24.0], scale=[4.0, 4.0, 22.5])

        # Horizontal arm extending forward (8 × 20 × 6 mm, extends from Y=16.0 to Y=-4.0)
        self._cube("StandArm", loc=[X_STAND, 6.0, 45.0], scale=[4.0, 10.0, 3.0])

        # T-Peg Neck on the front face of the arm (at Y = -4.0)
        # Width: 12.0, Depth: 3.0 (protrudes Y: -4.0 to -7.0), Height: 3.8
        self._cube(
            "StandPegNeck",
            loc=[X_STAND, -5.5, 45.0],
            scale=[PEG_NECK_W / 2, PEG_NECK_D / 2, PEG_NECK_H / 2],
        )

        # T-Peg Front Lip (at Y = -7.0)
        # Width: 16.0, Depth: 1.2 (protrudes Y: -7.0 to -8.2), Height: 6.0
        self._cube(
            "StandPegLip",
            loc=[X_STAND, -7.6, 45.0],
            scale=[PEG_LIP_W / 2, PEG_LIP_D / 2, PEG_LIP_H / 2],
        )

        # Join stand components
        c.call_tool(
            "join_objects",
            {
                "object_names": [
                    "StandBase",
                    "StandPost",
                    "StandArm",
                    "StandPegNeck",
                    "StandPegLip",
                ],
                "active_object": "StandBase",
                "new_name": "DeskStand",
            },
        )

        # ══════════════════════════════════════════════════════════════════════
        # EXPORTS
        # ══════════════════════════════════════════════════════════════════════
        self._step(6, "Exporting print-ready STL files")
        exports = [
            ("NameTagCard", "filament_tag_card.stl"),
            ("AMSClip", "filament_tag_ams_clip.stl"),
            ("StickonHolder", "filament_tag_stickon_holder.stl"),
            ("DeskStand", "filament_tag_desk_stand.stl"),
        ]
        for obj_name, path in exports:
            c.call_tool(
                "export_model",
                {
                    "object_name": obj_name,
                    "filepath": path,
                    "format": "STL",
                },
            )

        print("=" * 60)
        print("[OK] Redesigned Filament Name Tag & Stand System complete.")
        print("  1. NameTagCard    -> filament_tag_card.stl (with gravity lock)")
        print("  2. AMSClip        -> filament_tag_ams_clip.stl (2.8 mm snug gap)")
        print("  3. StickonHolder  -> filament_tag_stickon_holder.stl")
        print("  4. DeskStand      -> filament_tag_desk_stand.stl (crane style)")
        print("=" * 60)
