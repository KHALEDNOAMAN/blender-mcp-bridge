import importlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

CATS = [
    ("Scene & Diagnostics", "blender_mcp_bridge.tools.scene", "get_scene_tools"),
    ("Collections", "blender_mcp_bridge.tools.collections", "get_collection_tools"),
    ("Modeling", "blender_mcp_bridge.tools.modeling", "get_modeling_tools"),
    ("Materials", "blender_mcp_bridge.tools.materials", "get_material_tools"),
    ("Lighting & World", "blender_mcp_bridge.tools.lighting", "get_lighting_tools"),
    ("Camera", "blender_mcp_bridge.tools.camera", "get_camera_tools"),
    ("Animation", "blender_mcp_bridge.tools.animation", "get_animation_tools"),
    ("Rendering", "blender_mcp_bridge.tools.rendering", "get_rendering_tools"),
    ("History / Undo", "blender_mcp_bridge.tools.history", "get_history_tools"),
    ("3D-Print Preparation", "blender_mcp_bridge.tools.printing", "get_printing_tools"),
    ("Sculpting", "blender_mcp_bridge.tools.sculpting", "get_sculpting_tools"),
    # Answered locally from data/design-rules.json, not forwarded to Blender.
    ("Design Rules", "blender_mcp_bridge.tools.design_rules", "get_design_rule_tools"),
]

def params_str(t):
    props = t.inputSchema.get("properties", {})
    req = set(t.inputSchema.get("required", []))
    parts = []
    for p in props:
        parts.append(f"**{p}**" if p in req else p)
    return ", ".join(parts) if parts else "—"

lines = []
total = 0
toc = []
body = []
for cat, mod, fn in CATS:
    tools = getattr(importlib.import_module(mod), fn)()
    total += len(tools)
    anchor = cat.lower().replace(" & ", "--").replace(" / ", "--").replace(" ", "-").replace("&","").replace("/","")
    toc.append(f"- [{cat}](#{anchor}) ({len(tools)})")
    body.append(f"\n## {cat}\n")
    body.append("| Tool | Description | Parameters (**bold** = required) |")
    body.append("|---|---|---|")
    for t in sorted(tools, key=lambda x: x.name):
        desc = " ".join(t.description.split()) if t.description else ""
        if len(desc) > 220:
            desc = desc[:217] + "..."
        body.append(f"| `{t.name}` | {desc} | {params_str(t)} |")

hdr = f"""# Bridge Tool Reference — {total} tools

Auto-generated from the bridge tool schemas in `blender_mcp_bridge/tools/` (the single source of truth
the MCP client sees). Regenerate after adding or changing a tool:

```bash
py scripts/gen_tools_doc.py   # or: uv run python scripts/gen_tools_doc.py
```

Every tool listed here has a matching handler in the Blender addon
(`blender_mcp_addon/server.py` dispatch table); a consistency check lives in the
generator and fails loudly on drift.

"""
out = hdr + "\n".join(toc) + "\n" + "\n".join(body) + "\n"
with open(f"{ROOT}/docs/tools.md", "w", encoding="utf-8") as f:
    f.write(out)
print("wrote docs/tools.md -", total, "tools")

# Drift check: every tool the bridge advertises must have an addon handler --
# except the design-rule tools, which are answered locally in server.py and
# deliberately never reach the addon.
srv = open(f"{ROOT}/blender_mcp_addon/server.py", encoding="utf-8").read()
addon = set(re.findall(r'"([a-z0-9_]+)":\s*self\.', srv))
bridge = {t.name for cat, mod, fn in CATS for t in getattr(importlib.import_module(mod), fn)()}
from blender_mcp_bridge.tools.design_rules import DESIGN_RULE_HANDLERS  # noqa: E402

bridge -= set(DESIGN_RULE_HANDLERS)
drift = (addon - bridge) | (bridge - addon)
if drift:
    print("DRIFT:", sorted(addon - bridge), sorted(bridge - addon))
    sys.exit(1)
print("addon dispatch and bridge schemas are in sync:", len(bridge), "tools")
