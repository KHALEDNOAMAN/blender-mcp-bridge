# Cable Comb — design v1 (LOCKED)

A two-part desk cable organiser. A **base** screws or sticks to the desk edge and
carries two tapered pins; a **comb** drops onto those pins and holds up to five
cables in slots. Pull the comb off to re-route, push it back on to tidy.

Every dimension below is set by a rule from `data/design-rules.json`, cited in
the table at the end. Where a rule supplied a range, the chosen value and the
reason for that choice are stated.

## Why this shape

The knowledge base is strongest on **pin-and-hole joints** — that is where its
attested (not defaulted) numbers live: 0.25 mm hole-over-pin, 45° chamfered pin
tips, 1 mm minimum wall. So the design leans on a pin joint rather than a snap
fit, and both parts print flat with no supports.

## Parts

```
            COMB (drops on)                     BASE (fixed to desk)
   ┌──────────────────────────────┐      ┌──────────────────────────────┐
   │  ╷   ╷   ╷   ╷   ╷   ╷       │      │                              │
   │  │   │   │   │   │   │ slots │      │      ●              ●        │  pins
   │  ╵   ╵   ╵   ╵   ╵   ╵       │      │                              │
   │   ○              ○   holes   │      └──────────────────────────────┘
   └──────────────────────────────┘
        70 × 22 × 6                              70 × 22 × 4  (+5 pin)
```

## Elevation — how they meet

```
   COMB          ┌────────────────────────────────┐  6.0
                 │        ○ hole ⌀5.25            │
                 └────────────────────────────────┘  0
                            │  0.25 mm total clearance
   BASE                  ╱──┴──╲                     9.0  ← 45° chamfer, 1 mm tall
                         │ ⌀5.0 │                    8.0
                         │ pin  │
                 ┌───────┴──────┴─────────────────┐  4.0
                 │            base plate          │
                 └────────────────────────────────┘  0  ← on the build plate
```

The pin is **5.0 mm** and the hole **5.25 mm** — a 0.25 mm diametral clearance,
which is the attested figure, not a default. The pin's top 1 mm is chamfered at
**45°** so it funnels into the hole and stays self-supporting.

## Dimensions

### Base — `Base`

| feature | value | why |
|---|---|---|
| plate | 70 × 22 × 4 mm | 4 mm keeps it rigid; well over the 1 mm wall minimum |
| pin diameter | 5.0 mm | nominal; the hole is opened up instead of shrinking the pin |
| pin height | 5.0 mm above the plate | 4 mm engagement + 1 mm chamfer |
| pin chamfer | 45°, top 1 mm | R2 — chamfer not fillet, holds a constant 45° overhang |
| pin centres | x = ±28 mm, y = 0 | outboard of the outermost slot (±22 mm); see the clash note |
| corner fillet | 2 mm | R6 — inside corners filleted to avoid stress risers |

### Comb — `Comb`

| feature | value | why |
|---|---|---|
| plate | 70 × 22 × 6 mm | 6 mm gives the slots depth without thin walls |
| hole diameter | 5.25 mm | R1 — 0.25 mm larger than the 5.0 mm pin |
| hole depth | through | a blind pocket would need its roof bridged over the 5.25 mm bore, the one feature here that would need support; through is also self-clearing |
| hole mouth fillet | 0.5 mm | R5 — funnels the pin in on assembly |
| cable slots | 5 × 4 mm wide, 4 mm deep | fits typical 3–4 mm USB/DC cable |
| slot pitch | 11 mm | 5 slots across 70 mm with 7 mm of material between |
| slot floor fillet | 1 mm | R6 — inside corners filleted |
| wall between slots | 7 mm | far above the 1 mm minimum |

### Pin placement — a clash caught before modelling

The first draft put the pins at **±22 mm**, which is exactly where the outermost
cable slots sit. The 5.25 mm hole would have broken straight through the slot
floor. Checking the arithmetic before opening Blender caught it; the modelling
commands would all have reported success.

Pins moved **outboard to ±28 mm**, which leaves 5.625 mm of clearance to the
nearest slot edge (1 mm of wall beyond the hole) and 4.38 mm to the plate edge.

## Print orientation

Both parts lie **flat on the build plate**, largest face down:

- No overhang exceeds 45° anywhere — the only sloped feature is the pin chamfer,
  which sits exactly at the limit (R3, R4).
- The pins point **up**, so they need no support and stay crisp.
- Slots open upward, so their floors are printed flat rather than bridged.

## What must be true when built

Checks to run on the exported STLs, not on the modelling commands succeeding:

1. `Base` pin diameter measures 5.0 mm; `Comb` hole measures 5.25 mm.
2. The gap between them is 0.25 mm diametral (0.125 mm per side).
3. No face on either part exceeds a 45° overhang.
4. No wall is thinner than 1 mm.
5. Both meshes are watertight with zero degenerate faces.

## Rules this design follows

| # | rule | value | trust | source |
|---|---|---|---|---|
| R1 | Make the hole about 0.25 mm larger than the pin, for material shrinkage | 0.25 mm | **stated** | [Ultimate Guide to Connecting 3D Printed Parts @ 25:54](https://www.youtube.com/watch?v=vsHpiHhB3RU&t=1554s) |
| R2 | Chamfer the pin tip rather than fillet it — a chamfer holds a constant 45° overhang | 45° | **stated** | [Ultimate Guide @ 18:30](https://www.youtube.com/watch?v=vsHpiHhB3RU&t=1110s) |
| R3 | Keep overhang angles at 50° or less to print without supports | 50° | **stated** | orientation |
| R4 | Design overhangs no steeper than 50° | 50° | **stated** | supports |
| R5 | Add a fillet to the top of a hole so the pin is funnelled in | — | no number | [Ultimate Guide @ 25:47](https://www.youtube.com/watch?v=vsHpiHhB3RU&t=1547s) |
| R6 | Add fillets on inside corners to avoid stress risers | 0.5–1 mm | default | assumption, not attested |
| R7 | Ensure no wall is thinner than 1 mm | 1 mm | **stated** | [8 Essential Design Rules @ 00:11](https://www.youtube.com/watch?v=1n_R8shlGcs&t=11s) |
| R8 | Chamfer and round the top of press-fit pins for repeatable assembly | 0.1–0.2 mm | default | applied as the 45° chamfer of R2 |

**Rules deliberately not applied.** The KB also recommends turning circular pins
into slots and adding retention bumps (both `default`, from the same source).
Those suit a joint that must resist pull-out; this comb is meant to lift off by
hand, so they would work against the design. Noting them here so the omission is
a decision rather than an oversight.

Where a rule is marked `default`, the number came from print-kb's
`defaults.json`, not from anything a video actually said — applied knowingly.

## Built vs. specified

Everything specified above is in the STLs and measured: 0.2500 mm clearance,
45° pin chamfer, 4 mm slots with 7 mm walls, both meshes watertight with zero
non-manifold edges.

**R5 and R6 (the fillets) are applied** as a 0.3 mm, 2-segment bevel on each
part. An earlier build used 0.5 mm; that rounded the comb's bottom edge enough
to flare 0.21 mm outward, which at 0.2 mm layers is a first-layer overhang. 0.3 mm
keeps the flare at 0.127 mm, inside one layer.

The bevel leaves the joint alone — the bore stays ⌀5.250 mm through the full
engagement depth, and `use_clamp_overlap` prevents it eating into the 45° pin
chamfer that R2 requires.
