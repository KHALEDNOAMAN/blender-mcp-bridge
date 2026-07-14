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

### 4.5 Non-finite result rejection (divide-by-zero, NaN)

Found as a real gap while discussing what "guidance" the JSON editor could
give (§6.4 follow-up): `evaluateExpression()` threw on syntax errors,
undefined params, and non-numeric param values, but **not** on a divide-by-
zero — `${x} / 0` evaluates to JS's `Infinity` without throwing, and that
would silently reach the MCP dispatch as a bad argument instead of failing
validation with a clear message.

- `evaluateExpression()` now checks `Number.isFinite(result)` before
  returning; a non-finite result (from `/0`, or any other operation that
  produces `Infinity`/`-Infinity`/`NaN`) throws `"Expression evaluates to
  <Infinity|NaN>: divide by zero or invalid math"` instead of returning the
  non-finite value silently.
- Same error surfaces through every existing call path unchanged — dispatch-
  time resolution (§4.3 `resolveArgsObject`), the guided form's inline
  validation (`DynamicArgsForm`/`SchemaField`), and the new JSON-mode
  expression linter (§6.5) all consume `evaluateExpression()`, so the fix is
  one change, not three.
- **Explicitly out of scope**: semantic "wrong formula" or "out of range"
  checking (e.g. a radius that evaluates to a negative number, or a scale
  that's technically finite but physically nonsensical for a given tool).
  That needs per-tool min/max/positivity metadata that doesn't exist
  anywhere in the MCP schemas today (`src/tools/*.py` define types only, no
  `minimum`/`maximum`) — adding it would be new schema work on the Python
  side, a materially different and larger task than fixing the evaluator.
  Not attempted here; revisit only as its own scoped piece of work.

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

### 6.4 Real code editor (CodeMirror), post-v1 upgrade

The original plain-`<textarea>` JSON editor had zero "guidance" beyond the
outline panel and Apply-time errors — no syntax highlighting, no line
numbers, no live feedback while typing. Upgraded to CodeMirror 6 (modular:
`@codemirror/lang-json` + a theme, not one monolithic package) rather than
hand-rolling highlighting/line-numbers ourselves, since a real editor gets
these correctly and for free — the first genuine exception to this doc's
otherwise-consistent "no new dependency" pattern (§4.4, §7.1), justified
because text editing is exactly the kind of solved problem not worth
re-deriving in-house.

- **Live linting**: `@codemirror/lang-json`'s built-in linter shows inline
  syntax-error squiggles as you type, not only on Apply — real-time feedback
  a plain textarea + Apply-time `JSON.parse` couldn't give.
- **Shape validation stays separate**: `validateSessionShape`/`validateBranches`
  (§6.3) remain an Apply-time check, run after CodeMirror confirms valid
  syntax — a generic JSON linter has no notion of "this branch range is out
  of bounds," that's session-schema-specific and stays our own code.
- **Outline panel unchanged visually**, only its jump-to-line implementation
  swapped from raw textarea `setSelectionRange`/`scrollTop` math to
  CodeMirror's own cursor-dispatch + `scrollIntoView` effect — same UX,
  more correct positioning (CodeMirror's line/column model handles this
  properly, where the old approach approximated with a fixed line-height
  constant).
- Theme-aware: CodeMirror's editor theme follows Studio's existing
  dark/light toggle rather than being a fixed third color scheme.

### 6.5 Parametric expression linting in JSON mode

§6.4's linter only understands generic JSON syntax — it has no idea `"${a} /
0"` is a live expression, let alone a broken one. Added a second linter pass
so JSON mode gives the same "guidance" on parametric values that a synced
Command Tree / guided form already implies exists.

- A second `linter()` source registered alongside the JSON-syntax one (§6.4),
  same lint gutter, same red-squiggle UI — visually one system, not a
  separate warnings panel (rejected: a distinct list below the editor reads
  as a different, lesser class of problem than a JSON syntax error, when
  from the user's perspective both mean "this won't work").
- On each lint pass (same 750ms debounce as the JSON linter): parse the
  document (skip silently if it doesn't parse — the JSON linter already
  owns reporting that), walk every string value in `commands[].arguments`,
  and for each one that's a bare `${name}` token or `looksLikeExpression()`
  (§4.4) true, run it through `evaluateExpression()` against the session's
  current `parameters` (plus any params referenced-but-undefined get their
  own diagnostic, same message as the guided form's inline hint).
- Diagnostics reported: undefined parameter reference, expression syntax
  error, and non-finite result (§4.5) — each mapped back to its source line/
  column in the document so the squiggle lands on the actual offending
  string, not just "somewhere in this session."
- Does NOT duplicate `validateSessionShape`/`validateBranches` (§6.3) — those
  stay the Apply-time gate for branch range bounds; this linter is purely
  about parametric expressions, live, before Apply is even clicked.

**Bug found in the first implementation (same day, real user report):** the
v1 `jsonExprLinter.js` scanned every double-quoted string literal in the raw
document text via regex, not scoped to `commands[].arguments` as this
section always specified — `looksLikeExpression()`'s heuristic ("contains an
operator character AND a digit or `${...}`") is loose enough that ordinary
prose in a `description` field (e.g. `"location.z = box_height / 2 (computed
live)"` — has `/`, `(`, `)`, digits) matched it, then `evaluateExpression()`
tried to tokenize the English sentence as math and threw, surfacing as a
false-positive red squiggle under plain description text. Fixed by having
the linter actually parse the JSON and walk only `commands[].arguments`
subtrees (reusing `collectStringLeaves` from §4.5's array-field fix),
computing each candidate string's real source offset via a source-text
search anchored to its containing command's already-known start position —
not a blind whole-document regex scan. `metadata`/`description` text is
never inspected for expression syntax again.

### 6.6 Parameters panel in JSON mode

Found as a direct consequence of the above: when JSON mode flags an
undefined parameter, there was no way to fix it without leaving JSON mode
(and Guided-mode's own Parameters panel isn't visible there) — a genuine
workflow dead end, reported directly by the user hitting it.

- A parameters panel (same name/value editor as the Guided view's
  `ParametersPanel`) is now docked in JSON mode too, alongside the outline.
- **Immediate, not staged**: editing a parameter's value here takes effect
  right away — same as it always has in Guided mode — independent of the
  JSON textarea's own explicit-apply model (§6.2). These are two genuinely
  separate pieces of state (the live parameter store vs. the pending JSON
  text edit), each keeping its existing natural update model rather than
  forcing one to match the other. This is *why* it's useful: the expression
  linter (§6.5) re-checks against the live parameter set on every keystroke
  in either place, so adding a missing parameter here makes its red squiggle
  in the JSON textarea disappear immediately, without an Apply click.

### 6.7 Discard must undo parameter edits too

Real bug reported directly by the user: "immediate, not staged" (§6.6) meant
a parameter edit — including deleting every parameter — was a genuine,
permanent mutation the instant it happened, with **no relationship to
Discard at all**. Clicking Discard only ever reset `viewMode` to `'guided'`;
it never touched `session.parameters`, so deleting all parameters via the
docked panel and then clicking Discard left the deletion in place — the
opposite of what "Discard" means to a user (undo what I did in this
JSON-editing session).

- On toggling **into** JSON mode, `session.parameters` is snapshotted.
- The docked panel keeps editing live (§6.6's rationale — instant linter
  feedback — still holds, unchanged).
- **Discard now restores the snapshot**, undoing any parameter edits made
  while JSON mode was open, not just abandoning the pending JSON text.
- **Apply JSON does NOT restore the snapshot** — Apply is the intentional
  commit point; whatever the panel's current state is at that moment is
  correct and expected to stick, exactly like it always has for every other
  live-editing surface in Studio.
- The snapshot is taken once per toggle-in, not continuously — re-entering
  JSON mode later takes a fresh snapshot of whatever's current then.

**Second bug found immediately while testing the fix above**: Apply JSON
parses the *textarea's own text* and commits that wholesale via
`setSession(parsedSession)` — but the textarea's `"parameters"` key is never
rewritten when you edit the docked panel (§6.6 keeps panel edits live/
immediate specifically so they don't round-trip through the debounced text
editor). So deleting one parameter via the panel, then clicking **Apply**
(not Discard), silently *reverted* the deletion — the stale textarea text's
original parameter set overwrote the just-made live edit, the opposite
direction of the Discard bug above. Fixed by making the docked panel the
single authoritative source for `parameters`: `handleApplyJson` takes
`commands`/`metadata`/`branches` from the parsed textarea as usual, but
always uses the *live* `session.parameters` (whatever the panel currently
shows) rather than the parsed text's own `"parameters"` key. The textarea
can still display the current parameters as part of the full JSON view, but
editing them there does nothing — the panel is where parameter edits
actually happen, both while composing changes and at Apply time.

### 6.8 Docked panel layout polish

User feedback on a real screenshot after §6.6 shipped: the delete "×" button
rendered as its own floating row between name and value inputs, and the
panel had no way to widen the narrow fixed sidebar to see full parameter
names/values.

- Root cause of the floating delete button: `.json-editor-sidebar .params-row`
  had been forced to `flex-direction: column` (an earlier attempt to fit
  name+value in a narrow column by stacking them), which put the delete
  button — a third flex child with no special sizing — on its own row
  instead of inline. Removed the stacking override entirely; the row now
  always lays out name/value/delete horizontally in one line (matching the
  Guided-view Parameters panel's existing layout, per the user's reference
  screenshot), just with smaller font/padding and a narrower name/value
  split in the JSON-mode sidebar specifically.
- Delete button recolored to `var(--danger-color)` (red), matching the
  existing Clear button's styling — previously used the same neutral
  `.btn-icon` style as every other icon button, which read as "just another
  action," not a destructive one.
- `useResizableSidebar()` (previously built for the Guided-view left
  sidebar) was generalized to accept `storageKey`/`minWidth`/`maxWidth`/
  `defaultWidth` instead of hardcoding them, so it could be reused for a
  second, independent drag handle between the JSON-mode sidebar (outline +
  Parameters panel) and the CodeMirror editor — its own localStorage key
  (`jsonSidebarWidth`) and bounds (200–480px, default 260px) so resizing one
  view's sidebar doesn't affect the other's. Verified: dragging the handle
  100px widened the sidebar from 260px to 360px exactly, and the delete
  button's computed color matched `--danger-color` (`rgb(218, 54, 51)`).

### 6.9 Apply must block on parametric expression errors too

Real bug, caught by the user from a live screenshot: after deleting
parameters via the docked panel, the live lint gutter correctly showed red
squiggles/dots for the now-undefined `${box_length}`/`${box_width}` refs —
but **Apply JSON was still clickable and would have proceeded**, applying a
session with commands that reference parameters that no longer exist.

- `handleApply` checked JSON syntax (`JSON.parse`) and `validateSessionShape`
  (§6.3, branch range bounds) but never checked parametric expression
  problems — despite `findExpressionProblems()` (§6.5) already running live
  in the same component for the lint gutter, it was never consulted at
  Apply time, only used to paint squiggles.
- Fixed: Apply now also runs `findExpressionProblems()` against the live
  parameters and hard-blocks (same pattern as branch-range errors, not a
  warn-and-allow confirm dialog — rejected because a warn-through defeats
  the purpose here, it would just be one accidental click away from the
  exact failure this bug report was about) if any undefined-param or
  broken-expression problem exists anywhere in `commands[].arguments`. The
  error list shown is the same `.json-session-editor-errors` area already
  used for shape errors — one consistent place for "why Apply is blocked,"
  not a second UI pattern. Messages are de-duplicated (`[...new
  Set(...)]`) since the same undefined param is commonly referenced by
  multiple fields on one command (e.g. both `location` and `dimensions`),
  which would otherwise repeat an identical line once per occurrence.
  Verified end-to-end: deleted `box_length` (still referenced by
  `create_cube`'s `location`/`dimensions`) via the docked panel — Apply
  correctly blocked with one deduplicated error line, editor stayed open;
  adding `box_length` back via the panel and clicking Apply again then
  succeeded normally.

### 6.10 Parameters panel must be collapsible in JSON mode too

User report: "in edit mode, the parameters panel are not collapsible." The
docked `ParametersPanel` embedded in JSON mode (§6.6) rendered the same
chevron-header UI as every other collapsible card, but clicking it did
nothing.

- Root cause: `JsonSessionEditor` passed `collapsed={false}` (a literal, not
  state) and `onToggle={() => {}}` (a no-op) when rendering `ParametersPanel`
  — copy-pasted plumbing that was never wired to real state when the panel
  was first docked into JSON mode.
- Fixed: added real `paramsCollapsed` state, seeded from and persisted to
  `localStorage` (`jsonParametersCollapsed`), mirroring the pattern used by
  other collapsible panels in the app. `onToggle` now flips and persists it.
- Verified end-to-end with Playwright against the live bridge: measured
  `.metadata-body`'s rendered height before/after toggling — collapsed to 0,
  re-expanded back to the original height, and confirmed the collapsed state
  survives a full page reload (new session load + JSON-mode re-entry still
  showed the panel collapsed), i.e. the localStorage persistence path works,
  not just the in-memory toggle. Screenshot confirmed the collapsed panel
  renders correctly (header + badge count + right-pointing chevron, body
  hidden), matching the collapsed styling used elsewhere in the app.

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

### 7.3 Moved to a bottom dock: "Command Timeline"

User request: move the Command Tree out of the sidebar and turn it into a
persistent bottom strip — the "command timeline" — since it's inherently a
horizontal, full-width diagram and was cramped living in a narrow, vertically
scrolled sidebar column alongside Metadata/Parameters/Branches.

- `CommandTreePanel` (component name unchanged, header text now "Command
  Timeline") moved out of `.left-sidebar` to sit below `main` (sidebar +
  Commands list), full width, inside a new `.guided-body` column wrapper
  (Header → ActionBar → `main` → Command Timeline). Still collapsible via
  the same chevron-header pattern as every other panel; collapsing it
  shrinks it back to just the header strip (`height: auto !important`
  overrides the resized height while collapsed).
- Resizable vertically via a new `.vertical` variant of the existing
  `.sidebar-resize-handle` (§6.8's horizontal handle, rotated: `row-resize`
  cursor, horizontal bar instead of vertical, drag along `clientY` instead
  of `clientX`). Rather than duplicate `useResizableSidebar`, the hook
  gained an `axis: 'horizontal' | 'vertical'` option (reads `clientX` or
  `clientY`) and an `invert` option — the timeline is anchored to the
  bottom, so dragging the handle *up* must *grow* it, the opposite sign of
  a raw pointer-delta on that axis. Own storage key (`timelineHeight`,
  100–400px bounds, default 160px), independent of the two horizontal
  sidebars' widths.
- Bug found during verification: the resize handle initially sat at
  `top: -6px` (just outside the dock's own box) so it could be positioned
  flush against the card above with no visual gap — but the dock has
  `overflow: hidden` (needed to clip the SVG when the dock is shorter than
  its content), which also clipped the handle from hit-testing. Clicks at
  that position fell through to `.guided-body` behind it instead of
  starting a drag. Fixed by moving the handle to `top: 0` (just inside the
  dock's own top edge, `z-index: 1` above the header) and adding
  `padding-top: 6px` to the dock so the header isn't visually flush under
  the handle. Verified: dragging the handle up 80px grew the dock from
  160px to 243px measured via `getBoundingClientRect()`, and the extra
  height correctly revealed all three branch rows in a session that
  previously needed to scroll to see them.
- `.metadata-body`'s normal `max-height: 400px` (§ ordinary collapsible
  panels) is overridden for this dock specifically (`.command-timeline-dock
  .metadata-body { max-height: none; flex: 1; }`) so the SVG's scroll
  container actually fills whatever height the drag handle sets, instead of
  being capped at a fixed value regardless of the dock's real height.

### 7.4 New ActionBar: playback transport + branch run, docked below the header

User request: consolidate all playback controls (previously their own
`PlaybackPanel` sidebar card) plus a way to pick-and-run a branch into one
always-visible bar at the top of the guided view, instead of controls living
in scrollable sidebar cards where they could be scrolled out of view.

- New `ActionBar` component, rendered between `Header` and `main` (guided
  view only — JSON mode has its own Apply/Discard actions and no playback/
  branch semantics apply to raw JSON editing, so the bar doesn't render
  there at all).
- `PlaybackPanel.jsx` retired entirely (deleted, not just unused) — Undo/
  Redo, Play All/Play/Play to Active/Stop, Reset/Clear Scene, and the delay
  input all moved into `ActionBar` verbatim (same handlers, same
  disabled-state logic keyed off `isPlaying`/`hasBranches`/etc., §5.3's
  "branches disable raw linear playback" rule unchanged).
- Branch running moved from `BranchesPanel`'s old per-row Run button to a
  dropdown (`<select>` of branch names) + single "Run Branch" button in the
  ActionBar's right-hand group. `BranchesPanel` keeps create/inspect/delete
  only now — it's no longer where you actually run one, just where you
  manage the set. The dropdown auto-selects the first branch whenever the
  branch set changes and the current selection no longer exists (branch
  deleted, or a new/different session loaded), so it's never stuck pointing
  at a stale name.
- Verified end-to-end with Playwright against a real branching session
  (`assets/branch_test_session.json`, 3 branches): ActionBar renders with
  all transport buttons plus a populated branch dropdown showing all three
  branch names; selecting a different branch updates the dropdown's value;
  `BranchesPanel`'s rows confirmed to have zero Run buttons left (create/
  delete only); switching to JSON mode confirmed both the ActionBar and the
  Command Timeline are absent there, and switching back restores them.

### 7.5 ActionBar merged into the Command Timeline dock

Follow-up user request, immediately after §7.4 shipped: fold the standalone
ActionBar into the Command Timeline instead of keeping it as its own card
above `main`. Motivation stated directly — the goal is that "even with the
command timeline collapsed, we can still select the branches if it exists
and can play pause etc," i.e. transport controls should live somewhere that
can never itself scroll out of view or get hidden, which a separate card
above `main` doesn't guarantee once other panels grow.

- `CommandTreePanel` now renders three stacked regions instead of the old
  header+body pair: a slim click-to-collapse title row
  (`.command-timeline-titlebar`, "Command Timeline" + chevron, `onClick`
  toggles `collapsed` same as before), a permanent `ActionBar` row
  immediately below it, then the collapsible SVG diagram
  (`.metadata-body`, still governed by `collapsed`). The standalone
  `<ActionBar>` render between `Header` and `main` in `App.jsx` was removed;
  `App.jsx` now passes one `actionBarProps` object into `CommandTreePanel`,
  which spreads it onto the embedded `<ActionBar>`.
- Critical ordering point: the ActionBar row is a **sibling** of the
  collapsible body, not a child of the clickable title row. An earlier
  attempt nested it inside `.metadata-header` itself (so title, ActionBar,
  and chevron were all one `onClick`-to-toggle flex row) — that broke
  immediately, since every click on a transport button or the branch
  `<select>` also toggled `collapsed` via event bubbling to the header's own
  `onClick`. Pulling the ActionBar out to its own row below the title
  (rendered unconditionally, ignoring `collapsed`) fixed it without needing
  `stopPropagation` on every individual control.
- Bug found and fixed during this restructuring: the first nested-in-header
  layout also wrapped the chevron onto its own line below the ActionBar
  once the ActionBar's own internal content wrapped (narrow window), because
  the header row had `flex-wrap: wrap` and three flex children (title,
  ActionBar, chevron) with the ActionBar being the one most likely to need
  two rows. Splitting the title/chevron into their own dedicated row (no
  wrapping needed — just two short items) resolved this as a side effect of
  the same restructuring, not a separate patch.
- Verified end-to-end with Playwright: clicking a transport button (Reset)
  no longer collapses the timeline; collapsing the timeline via the
  title row leaves the ActionBar (all transport buttons + populated branch
  dropdown) visibly present and interactive; selecting a different branch
  while collapsed correctly updates the dropdown's value without
  re-expanding the timeline; a branch-free session correctly hides the
  branch dropdown/run group entirely while still showing the rest of the
  ActionBar (delay input shifts right via the row's `space-between`); JSON
  mode still renders neither the ActionBar nor the Command Timeline at all.

### 7.6 Collapsible command ranges (Excel-style column grouping)

User request, prompted by a session with a large branch spanning many
commands: let a range of commands condense into one marker, click-triggered
from a branch's range bar, the same way Excel lets you collapse a group of
columns/rows.

- **Collapse scope is global, not per-row.** The spine and every branch row
  share the same tick x-positions (`xForIndex(idx)` was one function for the
  whole diagram) — a range can't collapse for one branch's bar while
  staying expanded on the spine or another branch's row, because they're
  literally the same horizontal coordinates. So `collapsedRanges` is one
  shared piece of state for the whole diagram: clicking ANY branch's range
  bar (or the resulting marker, to re-expand) collapses/expands that range
  everywhere at once. This was a real design fork (asked and confirmed
  before implementing, not assumed) — the alternative of only allowing
  collapse where every visible branch treats the range as one uninterrupted
  block was rejected as too conservative (wouldn't even fire on the
  motivating screenshot, where branch B splits #4-6 from #7-9 through the
  middle of what branch A treats as one block).
- **Data model**: `collapsedRanges` is local `useState` in `CommandTreePanel`
  — a view preference, not session data. Not persisted, resets on
  reload/new session load. `mergeRanges()` normalizes overlapping/adjacent
  collapse requests into disjoint ranges so collapsing two touching branch
  bars produces one contiguous marker instead of a 1-command sliver of
  normal ticks wedged between two markers.
- **Rendering model**: `buildSegments(commandCount, collapsedRanges)` walks
  command indices 0..N-1 and produces an ordered list of segments — each
  either a single command tick or one collapsed marker standing in for a
  whole range. X-positions (`segmentCenterX`) are computed per-segment, not
  per-command-index, so a collapsed marker (wider, `COLLAPSED_SEGMENT_WIDTH`
  = 56px) doesn't just visually shrink — the commands after it actually
  shift left, closing the gap.
- **Marker click re-expands**; a single-command range (`start === end`) is
  not collapsible (nothing to condense) — its bar renders without the
  `.collapsible` class/cursor and its click handler is a no-op guard, not
  just a disabled style.
- Bug found and fixed during implementation: a branch's range bar uses
  `xForIndex(start)`/`xForIndex(end)` to know where to draw — when a
  branch's own full range collapsed onto itself (the exact case in the
  screenshot that prompted this: Feature A's range IS #1-3, and #1-3 gets
  collapsed), both endpoints resolved to the same collapsed marker's
  *center* x, so the bar rendered as a near-zero-width sliver dot instead of
  spanning the marker. Fixed by adding `xStartForIndex`/`xEndForIndex`,
  which return the marker's left/right *edge* when an endpoint lands inside
  a collapsed segment (matching a single tick's center otherwise, unchanged
  behavior for the non-collapsed case).
- Verified with Playwright against `assets/branch_test_session.json`:
  collapsing Feature A's #1-3 bar drops the tick count from 10 to 7 (3 ticks
  replaced by 1 marker), the marker labels correctly as "#1–#3", and Feature
  A's own bar now spans the full marker width instead of collapsing to a
  dot; clicking the marker re-expands back to exactly 10 ticks; collapsing
  two independent non-adjacent ranges at once (#1-3 and #7-10, leaving #4-6
  as normal ticks between them) renders two markers with no bar reporting a
  negative or zero width across any branch row.

## 8. Non-goals / explicitly deferred

- WASM browser→localhost bridge: dropped. Plain fetch/WebSocket to the local MCP
  bridge is sufficient; no browser sandbox limitation actually requires WASM.
- No change to the MCP protocol or `blender_mcp_addon/server.py` call contract.
  n8n's existing MCP usage is unaffected by anything in this doc.

## 9. Known cleanup — RESOLVED (2026-07-13)

Hardcoded absolute paths, fixed after explicit sign-off on each:
- `blender_mcp_addon/server.py` `import_and_analyze_reference()` (hardcoded
  debug STL fallback path) — **deleted entirely**, not patched. Confirmed via
  grep it was unreachable: registered in the addon's dispatch table but had
  no schema on the bridge side (`src/tools/`), so no MCP client could ever
  call it. Its dispatch-table entry was removed too.
- `blender_mcp_addon/server.py` `addon_log()` (hardcoded absolute log path) —
  now resolves `__file__`-relative (`os.path.dirname(os.path.abspath(__file__))`),
  not via `BLENDER_ASSETS_DIR` (that's semantically for export/render output,
  not debug logs) or a new env var — always resolvable on any machine with
  zero new config, appropriate for what's a try/except-silent-noop debug aid.
- `assets/mushroom_bw_session.json` (2 `export_model` calls) and
  `community/benchy/session.json` (1 `export_model` call) — baked-in absolute
  `filepath` values replaced with bare filenames (e.g. `"mushroom_bw_cap_black.stl"`),
  letting the bridge's existing `BLENDER_ASSETS_DIR` resolution in
  `blender_mcp_addon/tools/printing.py` handle it, same as every other
  session file already does. Verified live against the bridge: a bare
  relative `filepath` on `export_model` correctly resolved to
  `f:/github-proj/blender-mcp-n8n/assets/<name>.stl`, confirming the fixed
  session files will export to the same place they did before, just without
  a hardcoded absolute path baked into the JSON.

Deployed addon copy (`%APPDATA%\Blender Foundation\Blender\5.0\scripts\addons\blender_mcp_addon`)
synced with the fixed `server.py` — still needs an addon reload in Blender
(F3 → Reload Scripts, or restart) to take effect; that step was left to the user.

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
- [x] Non-finite result rejection (§4.5) — `evaluateExpression()` now throws
      `"Expression evaluates to Infinity: divide by zero or invalid math"`
      (or `NaN`) instead of silently returning a non-finite value.
      **Additionally found and fixed while implementing this**: the inline
      guided-form hint (`ParamTokenHint` in `SchemaField.jsx`) and
      `DynamicArgsForm.validate()` both only ever checked whether a field's
      *entire raw text* was itself a bare token/expression — which is never
      true for an array-typed field like `location`/`dimensions`, since
      that field's raw text is JSON-array syntax (`[0, 0, "${h} / 0"]`)
      containing an expression as one element, not an expression itself.
      This meant a divide-by-zero (or undefined-param) inside a
      `location`/`dimensions` array silently passed guided-form validation
      before this fix and only surfaced at dispatch time. New shared
      `lib/expr.js` helpers (`collectStringLeaves`, `candidateStringsForField`)
      parse the field's JSON and check every string element individually;
      both `ParamTokenHint` and `DynamicArgsForm.validate()` now use them.
      Verified end-to-end: typed `[0, 0, "${box_height} / 0"]` into
      `create_cube`'s location field in the guided edit modal — inline hint
      showed the exact error message live, and clicking "Apply Changes"
      was correctly blocked (modal stayed open).
- [x] Parametric expression linting in JSON mode (§6.5) — new
      `lib/jsonExprLinter.js`, a second CodeMirror `linter()` source
      alongside the JSON-syntax one (§6.4), same lint gutter. Reports
      undefined param refs, expression syntax errors, and non-finite
      results as inline diagnostics anchored to their exact position.
      **Real user-reported bug in the first version, fixed same day**: the
      v1 implementation scanned every double-quoted string in the raw
      document via regex (not scoped to `commands[].arguments` despite this
      section's spec always saying so) — `looksLikeExpression()`'s loose
      heuristic ("has an operator char and a digit or `${...}`") matched
      ordinary prose in `description` fields (e.g. `"location.z = box_height
      / 2 (computed live)"` — has `/`, `(`, `)`, digits), which then failed
      to tokenize as math and surfaced as a false-positive red squiggle
      under plain text — visible in a real screenshot the user sent. Fixed
      by having the linter parse the JSON and walk only
      `commands[].arguments` subtrees, locating each candidate string's
      real source offset via a position-anchored search scoped to its own
      command (prevents identical strings in different commands from
      colliding) rather than a blind whole-document scan.
- [x] Parameters panel in JSON mode (§6.6) — direct consequence of the bug
      above: the user pointed out that even a genuine undefined-param error
      in JSON mode had no visible way to fix it without leaving JSON mode
      entirely (Guided mode's Parameters panel isn't shown there). Docked
      the same `ParametersPanel` component beside the JSON outline;
      parameter edits here are immediate (not staged with the JSON text's
      own explicit-apply model, §6.2) since it's editing the live/applied
      session's parameters, same as Guided mode always has. Getting the
      live re-lint-on-param-change working took two attempts:
      `forceLinting()` from `@codemirror/lint` looked like the obvious API
      but turned out to be a no-op unless a lint was already
      internally-scheduled (it only fast-forwards a pending debounce timer,
      confirmed by reading the library source) — since editing a parameter
      doesn't touch the document text, no lint was ever pending, so nothing
      happened. Fixed by dispatching a custom no-op-to-the-document
      `StateEffect` that the linter's `needsRefresh` config reacts to,
      which is the correct, documented mechanism for "re-run a linter
      without a doc change." **Also found and fixed along the way**: the
      panel's name/value inputs used inline `flex: 40%`/`flex: 1` styles
      that don't fit a narrow fixed-width sidebar (240px) — the value input
      was overflowing off-screen, only reachable via horizontal scroll.
      Refactored to CSS classes so the JSON-mode sidebar can stack
      name/value vertically without affecting Guided mode's wider (and
      resizable) sidebar layout. Verified end-to-end with a realistic
      scenario (load a real session, introduce one genuine undefined-param
      error into an existing argument, leave everything else untouched):
      squiggle appeared, adding the parameter via the docked panel cleared
      it live with no Apply click and no document edit, and description
      text with `/`, `()`, digits showed zero false positives throughout.
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
      **Upgraded to CodeMirror 6** (§6.4, same day, post-v1 polish): the
      plain `<textarea>` was replaced with a real editor —
      `@codemirror/{state,view,lang-json,lint,commands}` +
      `@uiw/codemirror-theme-github` (first new dependency this doc's design
      otherwise avoided, justified since text editing is a solved problem).
      Gets real syntax highlighting, a lint gutter with live inline
      syntax-error markers (750ms debounce, no Apply click needed to see
      them), and theme-aware colors that follow Studio's dark/light toggle
      without losing document/undo state on swap. The outline panel is
      unchanged visually; only its jump-to-line implementation now uses
      CodeMirror's cursor-dispatch + `scrollIntoView` API instead of raw
      textarea selection math. `validateSessionShape`/`validateBranches`
      remain a separate Apply-time check, unaffected — CodeMirror's linter
      only understands generic JSON syntax, not session schema. Verified
      end-to-end: confirmed real syntax-highlighted tokens rendering,
      confirmed a live red lint-gutter marker appears while typing invalid
      JSON (before Apply), confirmed outline click-to-jump still selects the
      exact matching line, and confirmed the theme toggle swaps the editor's
      background color live (dark `rgb(13,17,23)` → light `rgb(255,255,255)`)
      without altering the document text.
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
      **Extended** (post-v1 polish, same day): the tree is now two-way, not
      just click-to-jump. It accepts an `activeIndex` prop and highlights
      that tick (larger radius, ring, success-color fill) whenever a command
      is expanded from the command list itself, auto-scrolling the tick into
      view if it's off-screen — previously the tree only drove the list, the
      list never drove the tree. Verified: expanding command #7 from the
      list correctly highlighted tick #7 in the tree, and the reverse
      (clicking a tree tick still correctly expands the matching list card)
      continued to work.
- [x] Fix hardcoded paths (§9) — resolved, see §9 for details.

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
