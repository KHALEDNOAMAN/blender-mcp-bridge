# Design Rules from print-kb

`data/design-rules.json` holds 3D-printing design rules extracted from video
sources by [`print-kb`](../../print-kb), a sibling project. This document is the
handoff: what the file contains, how it got there, and what to build on it.

**Nothing here depends on print-kb at runtime.** The file is self-contained JSON.
No database, no markdown parsing, no import — read it and go.

## Why it exists

An agent generating printable geometry needs to know things that are cheap to
honour while modelling and expensive to discover after a failed print: how steep
an overhang can be, how thick a wall must be, how much clearance a pin needs in
its hole. That knowledge exists, scattered across hundreds of YouTube tutorials.

print-kb extracts it, grounds each rule in the second it was spoken, and exports
only the rules that constrain geometry.

## What is in the file

```json
{
  "schema_version": 2,
  "generated": "2026-08-18",
  "counts": { "rules": 111, "measured": 17, "defaulted": 36, "actionable": 53 },
  "rules": [
    {
      "rule": "Keep unsupported overhang angles at 45-50 degrees or less.",
      "topic": "modeling",
      "value": { "low": 45, "high": 50, "unit": "deg", "is_range": true },
      "value_source": "source",
      "stated_as": "45-50 degrees",
      "source": {
        "title": "How to 3D PRINT Parts that FIT Together",
        "url": "https://www.youtube.com/watch?v=...&t=318s",
        "timestamp": "05:18",
        "timestamp_unverified": false
      }
    }
  ]
}
```

### `value_source` is the field that matters

| value | meaning | trust |
|---|---|---|
| `source` | the video stated this number | highest — attested, and citable |
| `default` | filled from print-kb's `config/defaults.json` | conventional FDM practice, not from this source |
| `none` | no dimension applies | the rule is still true, it just has no number |

Roughly 15% of rules carry an attested number. That is not a defect in the
extraction: presenters demonstrate dimensions in CAD and say "a bit bigger", so
the transcript genuinely does not contain them. Defaults close the gap for rules
that are *asking* for a dimension, taking the file from 15% to ~47% actionable.

**Prefer `source` values where you have them.** Where you fall back to a
`default`, it is safe to apply but worth surfacing as an assumption rather than
as something a video claimed.

### `timestamp_unverified`

The rule text is reliable. When this is `true`, the *citation* could not be
matched back to the captions by content, so the link may point at the wrong
moment in the video. Do not present those timestamps as precise.

### Audience

Only `designer`-facing rules are exported. print-kb also holds operator advice —
cleaning the build plate, drying filament — which an agent generating geometry
cannot act on. It is filtered out before the file is written.

## Reading it

```python
import json
from pathlib import Path

RULES = json.loads(Path("data/design-rules.json").read_text(encoding="utf-8"))["rules"]

def design_rules(keyword="", topic="", measured_only=False, limit=20):
    """Rules bearing on a keyword or topic, attested values first."""
    hits = [
        r for r in RULES
        if (not topic or r["topic"] == topic)
        and (not keyword or keyword.lower() in r["rule"].lower())
        and (not measured_only or r["value_source"] == "source")
    ]
    hits.sort(key=lambda r: {"source": 0, "default": 1, "none": 2}[r["value_source"]])
    return hits[:limit]
```

That is the whole integration. Rules already arrive sorted with attested values
first, so `[:n]` gives the most useful ones without further ranking.

## MCP tools

Implemented in [`blender_mcp_bridge/tools/design_rules.py`](../blender_mcp_bridge/tools/design_rules.py) and
registered alongside the Blender tools, so an agent connects to one server rather
than two.

Unlike every other tool here, these are answered **locally** from the JSON — they
short-circuit in `call_tool` before the Blender bridge, which has no handler for
them and would error. They are read-only, so they are also excluded from session
recording.

| tool | arguments | returns |
|---|---|---|
| `get_design_rules` | `keyword`, `topic`, `unit`, `measured_only`, `limit` | filtered rules |
| `list_design_topics` | — | topics with rule counts and how many carry values |
| `check_design` | `description`, `limit` | rules bearing on a described part |

`check_design` is the one to reach for: given *"a snap-fit enclosure lid with a
2mm wall and pin joints"*, it splits the description into terms, unions the
matches and ranks them by how many terms hit, attested values first. That query
returns 48 matching rules, leading with pin-and-hole tension, a 0.5 mm sliding
clearance and snap-fit fillets.

Both points below are carried in the tool descriptions themselves, since they
change how a model uses the result:

- The rules should be consulted **before** generating geometry, not after.
- A `null` value means the source stated no number, so the agent should choose a
  dimension knowingly rather than treating the rule as inapplicable.

Rules sourced from a `default` also carry an explicit `assumption` string naming
the default, so a conventional number is never mistaken for one a video stated.

If the file is absent the tools return an actionable error rather than an empty
result, and `DESIGN_RULES_PATH` overrides its location. The file is re-read when
its mtime changes, so a `print-kb export` lands without restarting the server.

## Keeping it current

print-kb writes this file directly, via `PRINT_KB_EXPORT_PATH` in its `.env`:

```
PRINT_KB_EXPORT_PATH=../blender-mcp-bridge/data/design-rules.json
```

So `print-kb ingest`, `rebuild`, `export` and the retract/restore commands all
refresh it in place — there is no copy step. If the file looks stale, run
`print-kb status` in that project: it flags derived files older than the newest
extraction.

The MCP tools re-read the file when its mtime changes, so an export lands in a
running server without a restart.

The whole chain, verified end to end:

```
YouTube video
  └─ print-kb ingest        transcript → tips, timestamps grounded in captions
       └─ export            designer-facing rules → design-rules.json
            └─ writes to    ../blender-mcp-bridge/data/design-rules.json
                 └─ served  check_design / get_design_rules / list_design_topics
```

The file is a snapshot by design. It keeps working with print-kb absent, copies
between machines, and diffs cleanly when rules change. The export is also
deterministic: re-running it over an unchanged KB reproduces the file byte for
byte, so a noisy diff means the rules genuinely moved.

## Where the rules come from

11 video sources, extracted by a local LLM (`qwen3.8-27b` on llama.cpp), with
every timestamp grounded against the captions rather than trusted from the model.
print-kb's `docs/llm-quirks.md` documents why that grounding exists — the model
fabricates plausible timestamps that pass a range check while pointing minutes
away from where a tip was actually said.

Coverage is uneven and worth knowing:

| topic | rules | with a stated value |
|---|---|---|
| modeling | 79 | 7 |
| tolerances | 19 | 7 |
| orientation | 6 | 1 |
| supports | 5 | 2 |
| slicer, materials | 1 each | 0 |

`modeling` is a catch-all and `slicer`/`materials` are too thin to answer much.
More sources on those topics would help; `print-kb find "<query>"` rates
candidates before spending extraction time on them.
