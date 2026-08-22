#!/usr/bin/env python
"""Copy the design-rule export into the package so wheels ship it.

`data/design-rules.json` is what print-kb writes to. `blender_mcp_bridge/data/` is the
copy that goes inside the wheel, so `uvx blender-mcp-bridge` can answer design
questions with no repo checked out.

Run this after a `print-kb export` and before building a release. A test fails if
the two drift, so this is never something you can silently forget.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "design-rules.json"
BUNDLED = ROOT / "blender_mcp_bridge" / "data" / "design-rules.json"


def main() -> int:
    if not SOURCE.exists():
        print(f"No export at {SOURCE}. Run `print-kb export` first.", file=sys.stderr)
        return 1

    if BUNDLED.exists() and BUNDLED.read_bytes() == SOURCE.read_bytes():
        print("Bundled design rules already match the export.")
        return 0

    BUNDLED.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE, BUNDLED)
    print(f"Copied {SOURCE.name} -> {BUNDLED.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
