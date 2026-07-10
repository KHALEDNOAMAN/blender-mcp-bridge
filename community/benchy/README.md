# SH Benchy — Measured Recreation of the #3DBenchy

A complete recreation of the famous [#3DBenchy](https://3dbenchy.com) calibration boat,
built **entirely from measurements** — cross-sections, silhouettes, and feature positions
extracted programmatically from the reference STL, combined with the hard dimensions from
the official brochure (60.00 × 31.00 × 48.00 mm, 23.00 mm roof at 5.5°, 10.50 × 9.50 mm
front window, ø9/ø12 stern window, ø3 × 11 mm chimney bore, 12.00 × 10.81 × 9.00 mm deck
box…). No geometry was copied; every vertex was derived, placed, and verified across
**51 build iterations** driven through the Blender MCP bridge.

**Model Used:** claude-fable-5 (Claude Code)

![SH Benchy Preview](assets/images/sh_benchy_preview.png)

## How to Replay

To recreate this Benchy in your own Blender instance, ensure the MCP server is running and execute:

```bash
python -m src.main play community/benchy/session.json
```

One replay produces the full model and exports a print-ready `sh_benchy.stl`.
The session is idempotent: it wipes the scene and rebuilds from scratch every run.

> [!IMPORTANT]
> Use the current bundled Blender addon (`blender_mcp_addon/`) — this session relies on
> its batch-safe `delete *`, deterministic cap triangulation, and loud-failure modifier
> baking. Older addon builds will fail the cleanup step or produce corrupted geometry.

## What the Session Builds

| Stage | Highlights |
|---|---|
| Hull | 9-ring `create_polygon` loft from measured stations: 40° spoon bow, upright bulwark band, uniform 2.6 mm gunwale rail (true perpendicular offsets), 69° raked transom, keel + deck spine rings so both caps are clean quads |
| Deck | Flat aft cockpit at Z=8.5, exact 45° companionway ramp, rising foredeck — all measured |
| Details | Hawsepipe "eyes" as true pipes with flange rings, prop-shaft socket, raked fishing-rod holder, deck box with spec 9.00 mm pocket |
| Cabin | Trapezium loft wheelhouse, side arches with raised double frames, front + stern windows aligned at Z=32 with unified 1.2 mm frames, helm console with recessed steering wheel |
| Roof & chimney | Measured trapezoid roof (rear-flush, front-flared visor) at 5.5°, chimney to exactly 48.00 mm with spec bore |
| Print prep | Bake all booleans → level-2 subsurf on the hull → join 18 parts → 0.15 mm voxel remesh (watertight fuse) → Laplacian smoothing → re-drill eyes + prop socket → engrave **SH BENCHY** 0.25 mm into the flat bottom → `check_mesh_for_printing` → STL export |

## Hard-Won Lessons Baked Into This Session

- **Big cap n-gons tent.** A loft's end cap over a height-varying ring gets triangulated
  unpredictably — bridging triangles domed our deck and crumpled the hull bottom. Fix:
  spine rings so caps degrade to thin coplanar slivers, plus deterministic cap
  triangulation in the addon.
- **Small holes don't survive subdivision + voxel remesh.** Subsurf pinches a ø4 hole
  nearly shut and the remesh unions the pinched material into a membrane. Fix: re-drill
  every bore into the final solid, after smoothing.
- **Engrave bottom text, don't raise it** — the print bed needs a flat first layer;
  the original's shallow bottom letters exist precisely to reveal first-layer squashing.
- **Boolean holders before cutters** when cleaning a scene, or batch-delete both together.

## Printing

Load `sh_benchy.stl` into your slicer. Like the original, it is designed to print at
1:1 without supports — hull overhang ≈ 40°, flat bottom with engraved nameplate,
verified watertight before export.

![SH Benchy Printed](assets/images/sh_benchy_printed.jpeg)
*The final printed SH Benchy — photo coming after the first print!*
