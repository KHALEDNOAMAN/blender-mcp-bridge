# Studio Design Doc v1

Status: DRAFT — not locked. Cross-check against this before/after implementation.

## 1. Naming

- Product name: **Studio** (not "IDE" — rejected explicitly).
- `session_editor/` retired and deleted (2026-07-13) — see §10 Migration checklist.
  `studio/` is the sole editor now; the Bridge Server serves its build at `/editor`.

## 2. Scope decision: retire session editor, fold into Studio

The session editor's command-sequence/replay model became Studio's guided panel
view. No parallel tool maintained — `session_editor/` has been deleted (§10).
Existing session JSON format (`metadata` + `commands[]`) stays the on-disk format;
Studio adds optional `parameters` (§4) and `branches` (§5) layers on top without
breaking that format for simple linear sessions.

## 3. Frontend: Vite + React, JAMstack

- Switch from vanilla JS (`session_editor/*.js`, ~2600 lines, global-script-tag state)
  to **Vite + React**. No Next.js/meta-framework — no SSR/server routing needed for a
  local-first tool talking directly to the MCP bridge.
- Build output is static (JAMstack): deployable as a plain static bundle, servable
  locally or as a GitHub Pages build if ever desired. No backend-for-frontend.
- Client talks directly to `MCP_BRIDGE_HOST:MCP_BRIDGE_PORT` (from `.env`) over
  HTTP/WebSocket, same as today — this part of the architecture is unchanged.
- Reason for switching now rather than later: feature branching (§5) needs a
  graph UI with multi-path diffing/re-render, and global params (§4) need reactive
  propagation to every command referencing them. Both are exactly where manual DOM
  diffing (current `app.js` splice/render-by-hand pattern) gets painful.

## 4. Global parameters (parametric design)

- New layer *in front of* existing MCP calls, not a protocol change.
- Param store: `{ name: value }`, editable in Studio UI, saved in session JSON
  under a new optional `parameters` key (absent = today's behavior, unchanged).
- Command args may reference a param via a string token, e.g. `"${cap_radius}"`.
  Resolved to the literal value at dispatch time, right before the MCP call is made.
- **No change for n8n / direct MCP callers**: they call the MCP server the same way
  they do today. Param resolution happens only in the Studio dispatch layer, never
  inside the MCP server itself. If a command has no `${...}` tokens, resolution is a
  no-op passthrough.

### 4.1 Param model: hybrid declare-first + inline quick-create

- The Parameters panel (new collapsible sidebar panel, alongside Session Metadata /
  Playback) is the source of truth — params live there as `{ name: value }` rows,
  addable/removable/renameable.
- Referencing an unknown `${name}` in an arg field (schema form field or raw JSON
  textarea) does **not** silently create a phantom param and does **not** hard-error
  either — it surfaces an inline "create parameter `name`" affordance right at the
  field, so you can define it on the spot without leaving the command editor. Once
  created (even with an empty/placeholder value), the reference resolves normally.
- Typos are still caught: a `${name}` with no matching param and no user action to
  create it fails validation at dispatch time, same as a required-field-empty error
  today.

### 4.2 UI surface

- New `ParametersPanel` component, same collapsible-card pattern as
  `MetadataPanel`/`PlaybackPanel` (`collapsed` state persisted to localStorage,
  consistent with `metadataCollapsed`/`playbackCollapsed`/`commandsCollapsed`).
- Table of rows: name (text, unique), value (text — coercion happens at dispatch,
  not storage), delete button. An "Add Parameter" row/button appends a blank row.

### 4.3 Resolution & type coercion

- Resolution happens in the same place args are currently assembled for dispatch
  (`DynamicArgsForm.getArgs()` / the raw-JSON command-card path in `App.jsx`), not
  inside `lib/api.js` — `runCommand()` itself stays a dumb passthrough, no param
  awareness.
- Order: **substitute, then coerce** — replace the `${name}` token with the param's
  raw string value first, then run the *same* schema-driven coercion the form
  already applies for that field's declared type (`parseFloat` for number/integer,
  `'true'/'false'` string compare for boolean, `JSON.parse` for json-typed fields).
  This reuses the existing coercion path as the single source of truth rather than
  introducing a second, param-store-side typed value.
- A param value is always stored/edited as a plain string in the Parameters panel;
  it only becomes typed at the moment it's substituted into a specific arg field,
  based on that field's schema — the same param can feed a number field in one
  command and a string field in another without any special handling.

### 4.4 Arithmetic expressions

Motivated by real friction hit building `assets/param_box_session.json` (v1 hollow
box test session): derived values like a cavity's Z-center or overshot height had
to be hand-computed and re-typed every time `box_height`/`wall_thickness` changed,
with the formula only living in a comment. Expressions close that gap.

- **Grammar**: a field's value is either a plain literal (unchanged, today's
  behavior) or **one arithmetic expression occupying the entire field value** —
  e.g. `"${box_height} / 2"`, `"(${box_height} + ${cavity_overshoot}) - ${wall_thickness}"`.
  No mixing expression syntax into a larger literal string (contrast with e.g. a
  filepath like `"part_${size}.stl"`, which is out of scope — that stays a plain
  substitution-only token per §4, not an expression).
- **Operators**: `+ - * / ( )` and numeric literals plus `${name}` references only.
  No function calls, no comparisons, no string ops — deliberately minimal.
- **Evaluator**: a small hand-written recursive-descent parser (`lib/expr.js`),
  not `eval()`/`Function()` and not a third-party library — the grammar is tiny
  (four operators + parens + two token types) and a bespoke parser is safer by
  construction (never touches JS's own evaluator) and has zero new dependencies.
- **Array/JSON fields**: each element of an array-typed field (e.g.
  `dimensions: ["${box_length}", "${box_width}", "${box_height} - 2"]`) is
  evaluated independently under the same whole-element-expression rule — no
  special-casing scalars vs. array elements.
- **Multi-param inline quick-create**: an expression can reference several
  undefined params at once (e.g. `"${a} + ${b} * 2"` with neither `a` nor `b`
  declared yet). The inline hint (§4.1) lists every undefined name found in the
  expression, each with its own "Create it" action, rather than surfacing them
  one at a time.
- **Coercion order unchanged**: evaluate the expression to a number first, then
  apply the field's normal schema-driven coercion (§4.3) — an expression in a
  number-typed field yields a JS number directly from the evaluator; in a
  json-typed field, the evaluated number is inserted as-is (no re-stringify/
  re-parse round-trip needed since the evaluator already produces a number).

## 5. Feature branching

Concrete v1 spec, superseding the original DAG-node framing below (kept for
context on the "jump" concept, which range-lists express just as well as edges
for this use case).

### 5.1 Data model: array-primary, DAG as opt-in overlay

- `commands[]` is unchanged — stays the single source of truth, index-ordered,
  exactly as it is today. No node/edge graph, no migration for any of the 12
  existing session files.
- A new optional top-level `branches` key: `{ [branchName]: { ranges: [[start,
  end], ...] } }`, 0-indexed, inclusive, over the *same* `commands[]` array.
  Example (the user's original motivating case):
  ```json
  "branches": {
    "Feature1 (keychain)": { "ranges": [[0, 9], [19, 29]] },
    "Feature2 (add flag)":  { "ranges": [[0, 24], [30, 44]] }
  }
  ```
  A "jump" (command 10 → command 20 in 1-indexed user terms) is simply the gap
  between one range's end and the next range's start — no separate edge concept.
- Absent `branches` key = today's behavior, unchanged. Existing session files
  need zero changes to keep working.

### 5.2 UI: Branches panel + range-click builder

- New collapsible `BranchesPanel`, same pattern as `ParametersPanel` (header
  toggle, `branchesCollapsed` in localStorage, consistent visual language).
- Lists saved branches by name, each with its own **▶ Run** button and a
  delete/edit action.
- **"+ New Branch"** opens a small builder: click a command card to mark range
  start, click another (or the same one) to mark range end, **"Add Range"**
  appends `[start, end]` to the branch being built, repeat for additional
  ranges, then **Save** with a name. Reuses the existing command-list selection
  UI rather than inventing a new picker widget.

### 5.3 Running a branch

- **Auto-wipe then replay-from-scratch**: running a branch always starts by
  clearing the Blender scene, then replays every range in order as real MCP
  dispatches — deterministic, matches how most existing session templates
  already start with a `delete_object(pattern: '*')` command themselves.
  (Rejected: replay-from-current-state — non-deterministic, and would risk a
  double-wipe against sessions whose own first command already clears the
  scene.)
- Reuses the existing `dispatchCommand`/`playFrom`-style execution engine
  (param resolution included, per §4) — a branch run is functionally "playFrom
  with a list of ranges" instead of a single `[start, endIndex]` pair, not a
  parallel execution path.
- Sits alongside, not instead of, the existing Session Playback panel — Play
  All / Play / Play to Active operate on the plain linear `commands[]` exactly
  as today, but only when the session has **no branches defined**.

### 5.3.1 Play All / Play / Play to Active are disabled when branches exist

Discovered as a real gap while testing: running raw linear `commands[]` on a
branching session (e.g. `assets/branch_test_session.json`) silently executes
every branch's steps back-to-back in file order, which is not any branch's
actual intended sequence and can easily produce broken or nonsensical geometry
(e.g. a later branch's steps running against a scene state they were never
designed for) — with no error, since each individual command still dispatches
fine on its own.

- **Disable, don't warn**: `Object.keys(session.branches || {}).length > 0` →
  Play All, Play, and Play to Active are disabled (not just confirm-gated).
  Rejected: a warn-and-continue confirm dialog — too easy to click through
  without registering why linear playback stopped making sense once branches
  exist.
- **Live-reactive, not a one-time gate**: the disable condition re-evaluates
  on every branches change — deleting the last branch immediately re-enables
  linear playback, no reload needed.
- **Per-command Run stays enabled** regardless of branches — it's still
  useful for testing a single step in isolation and doesn't carry the same
  footgun (you're not silently running a whole invalid multi-branch sequence).
- **Stop** stays enabled/disabled exactly as before (tied to `isPlaying`,
  which is `true` during a branch run too) — a branch run still needs to be
  interruptible.

### 5.4 Deferred from v1 (kept from original framing, not yet speced)

- Checkpoints at expensive nodes (to skip full replay-from-scratch on iteration)
  — revisit only if replay time becomes a real workflow blocker, per the
  original rejected-alternatives note above.
- Arbitrary non-contiguous/non-range node picking (§5.2 only supports
  contiguous `[start, end]` ranges per branch entry, not individual
  cherry-picked indices) — matches the user's actual motivating use case;
  revisit if a real workflow needs it.

## 6. Guided / JSON view toggle

An "IDE-like" mode toggle: switch between the current structured panel UI and
a raw whole-session JSON editor, for power users who want to bulk-edit, paste
in a hand-written session, or directly fix a branch's `ranges` array.

### 6.1 Toggle placement and scope

- One toggle in the Header (next to Theme/Export JSON), not a per-panel
  control. Switches the entire right-side Commands area (metadata/params/
  branches/commands all collapse into one JSON view) — editing is one thing
  at a time, not several partial views juggled simultaneously.
- Label: "Guided" / "JSON" (button reflects the mode you'd switch *to*, same
  convention as the existing Theme toggle button).

### 6.2 Sync model: explicit apply, not live two-way binding

- On toggle-in to JSON mode, the textarea is seeded once from
  `JSON.stringify(session, null, 2)` — a snapshot, not a live binding.
- Edits stay local to the textarea. An **"Apply JSON"** button parses +
  validates (§6.3) and, only on success, replaces session state and switches
  back to guided view.
- Switching away from JSON mode without applying (toggle back to Guided,
  or navigate away via Load/New Session) prompts to discard or apply first —
  same pattern as the existing per-command args editor's unsaved-state
  handling, not a new interaction to learn.
- Rejected: live two-way binding (every keystroke syncing both views). Real
  added complexity — cursor-position preservation while re-rendering JSON on
  every structured edit, handling invalid intermediate JSON while typing,
  debouncing — for marginal gain over explicit-apply.

### 6.3 Validation on Apply

- **Syntax first**: `JSON.parse` — failure shows an inline error at Apply,
  blocks switching back to guided view. No partial/best-effort apply.
- **Shape checks next**, reusing a new shared `lib/sessionValidation.js`
  (not a JSON-mode-only special case):
  - `validateBranches(session)` — every branch's every `[start, end]` range
    must have `0 <= start <= end < commands.length`. This closes a real
    existing gap: nothing today validates a branch's ranges anywhere,
    including `runBranch()` itself — the click-to-pick `BranchBuilder` UI
    happens to only ever produce valid ranges by construction, but a
    hand-edited or future-bugged range currently has no guard at dispatch
    time either. `runBranch()` should call this validator before running,
    not only the JSON-apply path.
  - Undefined `${param}` references are deliberately **not** blocked here —
    that's already handled at dispatch time (§4.1/§4.3, the inline
    quick-create flow), and JSON-pasted commands referencing not-yet-created
    params should behave the same as guided-UI-typed ones: resolvable later,
    not a hard block on save.
- Failure surfaces as an inline message near the Apply button (which range,
  which branch, what's out of bounds) — not a generic "invalid session" toast.

## 7. Command tree / branch diagram

A visual DAG of the session's structure — commands and how branches jump between
them — NOT a 3D geometry preview. Explicitly scoped this way after weighing a
three.js scene-preview idea: a fake geometry preview (primitive proxies for each
command, no booleans/materials/text evaluation) risks being actively misleading
given this session's repeated lesson that "looks right" and "is right" diverge
easily for boolean/modifier results — a diagram of session *structure* is honest
by construction since it only renders data Studio already has, not a guess at
what Blender will draw.

### 7.1 Placement and rendering approach

- New collapsible `CommandTreePanel`, same pattern as `BranchesPanel`, placed
  below it in the sidebar.
- Hand-rolled SVG, not a new graph-library dependency (`react-flow`, `dagre`,
  etc. rejected) — the actual graph shape here is simple: a linear spine of
  commands plus branch ranges as overlays, not an arbitrary node/edge graph.
  Consistent with `lib/expr.js`'s same reasoning (small custom logic over a
  new dependency when the problem is genuinely small).

### 7.2 Layout: horizontal spine + range brackets

- One row of numbered ticks/dots for commands `1..N` (a Gantt-chart-style
  timeline, not a vertical list — scales via horizontal scroll for large N).
- One colored horizontal bracket per branch, below the spine, spanning each
  of its ranges with visible gaps where it skips commands — directly shows
  "this branch covers these commands, jumps over these."
- Clicking a command tick jumps to/expands that command in the main
  `CommandList`, same interaction as the JSON outline's click-to-jump (§6).
- No branches defined → just the plain numbered spine, no brackets.

## 8. Non-goals / explicitly deferred

- WASM browser→localhost bridge: dropped. Plain fetch/WebSocket to the local MCP
  bridge is sufficient; no browser sandbox limitation actually requires WASM.
- No change to the MCP protocol or `blender_mcp_addon/server.py` call contract.
  n8n's existing MCP usage is unaffected by anything in this doc.

## 9. Known cleanup (found during this review, not yet fixed)

Hardcoded absolute paths that should resolve via `BLENDER_ASSETS_DIR` instead:
- `blender_mcp_addon/server.py:53` — debug STL path
- `blender_mcp_addon/server.py:188` — debug log file path
- `assets/mushroom_bw_session.json:489,499` — baked-in `filepath` values
- `community/benchy/session.json:1261` — baked-in `filepath` value

Not fixed in this pass — flagging for explicit sign-off before editing generated
session assets or addon debug code.

## 10. Migration checklist (fill in as implemented)

- [x] Vite + React scaffold — new `studio/` folder created alongside `session_editor/`
      (initially not a rename; `session_editor/` retired separately once Studio
      reached full parity — see the retirement entry below)
- [x] Port timeline/command-card view from current `app.js`/`ui.js` — 1:1 feature
      port: session load/save, metadata panel, command list (add/edit/delete/
      move/filter), schema-driven dynamic args form, playback (play all / play /
      play-to-active / stop / delay), modal (alert/confirm/testing-bar), theme
      toggle, collapsible panels, all keyboard shortcuts, new-session templates
      (blank / 3d_print / stl_edit)
- [x] `parameters` key + `${...}` resolution in dispatch layer — implemented per
      §4.1-4.3: hybrid declare-first + inline quick-create, `ParametersPanel`
      sidebar component, resolution centralized in `App.jsx`'s `dispatchCommand()`
      (used by `runSingle`/`playFrom`/edit-modal Test-Run), `lib/params.js` holds
      the pure resolve/coerce logic. Verified end-to-end via Playwright: typed
      `${cube_pos}` into a `create_cube` location field, used the inline "Create
      it" hint, filled the value in the Parameters panel, ran the command —
      resolved and executed successfully in real Blender while the stored command
      JSON kept the literal `${cube_pos}` token (confirmed re-runnable/parametric,
      not a one-time substitution).
- [x] Arithmetic expressions (§4.4) — `lib/expr.js`, a small hand-written
      recursive-descent parser/evaluator (`+ - * / ( )`, numeric literals,
      `${name}` refs; deliberately not `eval`/`Function` or a third-party lib).
      Motivated directly by `assets/param_box_session.json`: its cavity cutter's
      Z-height/position had to be hand-recomputed on every resize with the
      formula living only in a comment — now `wall_thickness + ((box_height +
      cavity_overshoot) - wall_thickness) / 2` etc. are live expressions in the
      command arguments themselves, evaluated at dispatch time. Multi-param
      inline quick-create extended (§4.1) to list every undefined name in an
      expression at once. Verified via a standalone evaluator sanity check
      (matched the session's previously hand-computed values 100/230/135
      exactly) and end-to-end in Studio against the live bridge: loaded the
      rewritten 5-parameter session (down from 9 — 4 were pure derived
      literals), Play All succeeded on all 6 commands, and a Cycles render of
      the result confirmed a real open-top hollow box (walls, floor, and
      cavity all visibly correct), not just a numeric readout.
- [x] Feature branching — implemented per §5.1-5.3 (array-primary, `branches`
      as an opt-in overlay, not a DAG node graph — see §5 for why this
      supersedes the original node/edge framing). New `BranchesPanel` +
      `BranchBuilder` components: click-to-mark-range picker inside the
      existing generic Modal, saved branches shown with their range labels
      and a per-branch ▶ Run. `runBranch()` in `App.jsx` auto-wipes the scene
      then replays each range's commands via the same `dispatchCommand` path
      as normal playback (parameters resolve identically). Verified
      end-to-end against the live bridge: built a 4-command test session with
      two divergent branches (Branch A = #1-#3 creating a cube, Branch B =
      #1-#2 + #4 creating a sphere instead), ran each via the UI, and
      confirmed via `get_scene_info` after each run that the scene contained
      exactly the right single object — proving both the range-jump logic
      and the auto-wipe-before-replay determinism work correctly.
- [ ] Checkpoint marking for expensive nodes (§5.4) — deferred; revisit only
      if replay-from-scratch time becomes a real workflow blocker
- [ ] Arbitrary non-contiguous/non-range branch picking (§5.4) — deferred;
      current range-only model matches the motivating use case
- [x] Guided / JSON view toggle (§6) — Header toggle (`{ } JSON` / `🧭 Guided`,
      disabled with no session loaded) swaps the whole right-side content area
      between the structured panels and a new `JsonSessionEditor` textarea.
      Explicit-apply model per §6.2: seeded once on toggle-in, edits stay
      local until "Apply JSON" parses + validates and only then replaces
      session state; switching away without applying prompts to confirm
      discard. New `lib/sessionValidation.js` (`validateBranches`,
      `validateSessionShape`) is shared, not JSON-mode-only — `runBranch()`
      now also validates a branch's ranges are in-bounds before dispatching,
      closing a real latent gap (nothing previously guarded against an
      out-of-bounds range at run time). Verified end-to-end: edited
      `label_text` directly in the JSON textarea, applied, confirmed the
      Parameters panel reflected the change; confirmed an out-of-bounds
      branch range and malformed JSON syntax both correctly block Apply with
      an inline error and keep the editor in JSON mode.
- [x] Retire `session_editor/` (§2) — deleted (2026-07-13) now that Studio has
      full feature parity plus parameters/expressions/branching/JSON-mode it
      never had. `src/server.py`'s `/editor` mount now points at
      `studio/dist` instead of `session_editor/`, guarded with an
      `os.path.isdir` check — if `studio/dist` doesn't exist (gitignored,
      only produced by `npm run build`), `/editor` serves a short 503 message
      with the build command instead of crashing server startup or 404ing
      silently. Verified via a throwaway server instance on a separate port
      (didn't touch the live bridge on 8008, which a user was still running):
      confirmed `/editor` correctly serves Studio's `<title>Blender MCP
      Studio</title>` build output. `README.md` and `community/README.md`
      updated to describe Studio (not session_editor) as the editor, including
      the new `http://localhost:8008/editor/` zero-setup access path.
- [x] Command tree / branch diagram (§7) — new `CommandTreePanel`, same
      collapsible-panel pattern as `BranchesPanel`. Hand-rolled SVG (no new
      dependency): a horizontal spine of numbered ticks for `commands[]`,
      with one colored bracket row per branch below it, spanning each range
      with visible gaps where it jumps over commands. Clicking a tick reuses
      the same expand/jump interaction as the JSON outline (§6). Deliberately
      NOT a 3D geometry preview — that idea was explicitly rejected after
      weighing it: a fake primitive-proxy preview (no boolean/text/material
      evaluation) risks being actively misleading given this session's
      repeated lesson that "looks right" and "is right" diverge easily for
      boolean results; a structure-only diagram is honest by construction
      since it only renders data already in the session (order + ranges).
      Verified end-to-end against the live bridge with the 3-branch/10-command
      test session: spine showed all 10 ticks, branch rows correctly showed
      Feature A as one continuous bar (#1-#3), Feature B and C each as two
      separate bars with a visible gap between them (confirming the jump is
      visually distinguishable from a contiguous range), and clicking tick #7
      correctly expanded `create_text (TagLabel)` in the command list.
- [ ] Fix hardcoded paths (§9), pending sign-off — still open

### Bugs found & fixed during Studio scaffold verification (2026-07-13)

Both were **latent in the original `session_editor/api.js` too** — they never
surfaced there because session editor was always served same-origin with the
MCP bridge (mounted at `/editor` on the bridge itself, or opened via `file://`).
Studio's Vite dev server (a genuinely different origin/port) exposed them:

1. **`checkConnection()` port probing was a no-op off `file://`.** The original
   logic only varied the tested port when `window.location.protocol === 'file:'`;
   otherwise it always used `window.location.origin` regardless of the `port`
   loop variable — so on a real dev server it silently resolved to the page's
   *own* origin instead of the MCP bridge. Fixed in `studio/src/lib/api.js`:
   `checkConnection()` now always probes `localhost:8008`/`localhost:8000`
   explicitly first, falling back to same-origin only if neither responds.
2. Compounding this, Vite's dev server returns 200 for any path (SPA fallback),
   so the broken same-origin check appeared to "succeed," masking the bug until
   actual tool calls were attempted (which 404'd against Studio's own dev port).

Verified end-to-end via Playwright against the live MCP bridge on port 8008:
connection resolves correctly, New Command flow (category → tool → schema-driven
form → validation) works, `create_cube` executed successfully in real Blender,
card state updates to "✓ Done" — zero console errors. Server-side CORS was
already correctly configured in `src/server.py` (`CORSMiddleware`,
`allow_origins=["*"]`); no server changes were needed once the client-side
port-resolution bug was fixed.
