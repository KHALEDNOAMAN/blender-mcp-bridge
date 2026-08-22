# blender_mcp_bridge/sessions.py

import json
from collections.abc import Collection
from dataclasses import asdict, dataclass, field
from typing import Any

from .params import evaluate_expression, resolve_args


@dataclass
class SessionMetadata:
    name: str = "Untitled Session"
    model: str = ""
    description: str = ""
    documentation_url: str = ""


@dataclass
class SessionCommand:
    tool: str
    arguments: dict[str, Any] = field(default_factory=dict)
    description: str | None = None
    execution_status: str | None = None
    # Only present when tool == "for_each": a template list of raw command
    # dicts (same shape as top-level "commands" entries, not yet parsed into
    # SessionCommand) re-emitted once per loop iteration by
    # expand_for_each_loops, with "${<var>}" substituted for the current
    # index. Not itself sent to the MCP server — for_each is expanded away
    # before playback ever calls resolve_args/call_tool on it.
    body: list[dict[str, Any]] | None = None


@dataclass
class BridgeSession:
    metadata: SessionMetadata
    commands: list[SessionCommand] = field(default_factory=list)
    branches: dict[str, Any] = field(default_factory=dict)
    parameters: dict[str, str] = field(default_factory=dict)
    # Optional per-parameter UI hints (slider/checkbox/select ranges and
    # labels) used by Studio to render richer controls than a text box.
    # Playback ignores this entirely -- it is presentation only -- but it must
    # survive a load/save round-trip or editing a session in Studio would
    # silently strip it.
    parameter_ui: dict[str, Any] = field(default_factory=dict)

    def to_dict(self):
        data = {
            "metadata": asdict(self.metadata),
            "commands": [asdict(cmd) for cmd in self.commands],
        }
        if self.branches:
            data["branches"] = self.branches
        if self.parameters:
            data["parameters"] = self.parameters
        if self.parameter_ui:
            data["parameter_ui"] = self.parameter_ui
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]):
        metadata_data = data.get("metadata", {})
        # Filter metadata keys to match class
        metadata_keys = {f.name for f in SessionMetadata.__dataclass_fields__.values()}
        metadata_clean = {k: v for k, v in metadata_data.items() if k in metadata_keys}
        metadata = SessionMetadata(**metadata_clean)

        command_list = data.get("commands", [])
        command_keys = {f.name for f in SessionCommand.__dataclass_fields__.values()}
        commands = []
        for cmd in command_list:
            clean_cmd = {k: v for k, v in cmd.items() if k in command_keys}
            commands.append(SessionCommand(**clean_cmd))

        branches = data.get("branches", {}) or {}
        parameters = data.get("parameters", {}) or {}
        parameter_ui = data.get("parameter_ui", {}) or {}

        return cls(
            metadata=metadata,
            commands=commands,
            branches=branches,
            parameters=parameters,
            parameter_ui=parameter_ui,
        )

    def resolve_branch(self, name: str) -> list[SessionCommand]:
        """Expand a branch's [start, end] (inclusive, 0-indexed) ranges into commands."""
        branch = self.branches[name]
        indices: list[int] = []
        for start, end in branch.get("ranges", []):
            indices.extend(range(start, end + 1))
        return [self.commands[i] for i in indices]

    def save(self, path: str):
        with open(path, "w") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load(cls, path: str):
        with open(path) as f:
            data = json.load(f)
        return cls.from_dict(data)


def _substitute_loop_var(value: Any, var: str, index_str: str) -> Any:
    """Replace every '${<var>}' occurrence with the current loop index
    (as a numeric-string literal) inside a raw arguments/body value, walking
    dicts/lists/strings. Runs BEFORE resolve_args, so ${var} disappears
    entirely and the result still has ordinary '${b8_length}'-style param
    refs intact for the normal per-command resolution pass that follows."""
    token = "${" + var + "}"
    if isinstance(value, str):
        return value.replace(token, index_str)
    if isinstance(value, list):
        return [_substitute_loop_var(v, var, index_str) for v in value]
    if isinstance(value, dict):
        return {k: _substitute_loop_var(v, var, index_str) for k, v in value.items()}
    return value


def expand_for_each_loops(
    commands: list[SessionCommand], parameters: dict[str, str]
) -> list[SessionCommand]:
    """Expand every 'for_each' command in a command list into concrete
    commands, substituting its loop variable per iteration. Recurses into
    nested for_each bodies (e.g. an outer column loop containing an inner
    row loop), so N-dimensional grids (like a honeycomb pattern driven by
    plate length/depth) can be authored as a small template instead of one
    hardcoded command per cell.

    start/end/step are expressions (may reference session ${params} and the
    floor/ceil/min/max functions) evaluated ONCE before the loop begins —
    not re-evaluated per iteration, so they must not depend on the loop's
    own variable. end is inclusive, matching a plain range-with-endpoint
    for-loop rather than Python's half-open range().
    """
    expanded: list[SessionCommand] = []
    for cmd in commands:
        if cmd.tool != "for_each":
            expanded.append(cmd)
            continue

        args = cmd.arguments or {}
        var = args.get("var")
        if not var:
            raise ValueError("for_each command missing required 'var' argument")
        if not cmd.body:
            raise ValueError(f"for_each command (var='{var}') has an empty or missing 'body'")

        end_raw = args.get("end")
        if end_raw is None:
            raise ValueError(f"for_each command (var='{var}') missing required 'end' argument")
        start = evaluate_expression(str(args.get("start", "0")), parameters)
        end = evaluate_expression(str(end_raw), parameters)
        step = evaluate_expression(str(args.get("step", "1")), parameters)
        if step == 0:
            raise ValueError(f"for_each command (var='{var}') has step=0, would loop forever")

        i = start
        iterations = 0
        max_iterations = 100_000  # guard rail against a runaway/malformed loop
        while (step > 0 and i <= end + 1e-9) or (step < 0 and i >= end - 1e-9):
            iterations += 1
            if iterations > max_iterations:
                raise ValueError(
                    f"for_each command (var='{var}') exceeded {max_iterations} iterations "
                    f"(start={start}, end={end}, step={step}) — check for a sign/bound error"
                )
            index_str = repr(i) if i != int(i) else str(int(i))
            body_commands = [
                SessionCommand(
                    tool=bc["tool"],
                    arguments=_substitute_loop_var(bc.get("arguments", {}), var, index_str),
                    description=_substitute_loop_var(bc.get("description"), var, index_str),
                    body=_substitute_loop_var(bc.get("body"), var, index_str),
                )
                for bc in cmd.body
            ]
            # Nested for_each inside this body: recurse so inner loop bounds
            # (which may themselves reference ${var} from this outer loop)
            # are evaluated with THIS iteration's value already substituted.
            expanded.extend(expand_for_each_loops(body_commands, parameters))
            i += step

    return expanded


class SessionRecorder:
    def __init__(self, path: str, metadata: SessionMetadata):
        self.path = path
        self.session = BridgeSession(metadata=metadata)

    def record_command(self, tool: str, arguments: dict[str, Any], description: str | None = None):
        command = SessionCommand(tool=tool, arguments=arguments, description=description)
        self.session.commands.append(command)
        # Auto-save after each command to prevent data loss
        self.session.save(self.path)


class SessionPlayer:
    def __init__(self, transport: str = "stateful", host: str = "http://localhost:8008"):
        self.transport = transport
        self.host = host
        self._client: Any = None

    async def _get_client(self):
        if self._client:
            return self._client

        if self.transport == "stateful":
            from tests.utils.stateful_mcp_client import StatefulMCPClient

            self._client = StatefulMCPClient(base_url=self.host)
        else:
            from tests.utils.mcp_client import MCPClient

            self._client = MCPClient(base_url=self.host)
        return self._client

    @staticmethod
    def _select_branch(
        session: BridgeSession, branch: str | None
    ) -> tuple[list, str | None, str | None]:
        """Resolve which commands to play. Returns (commands, branch, note)."""
        cyan = "\033[96m"
        yellow = "\033[93m"

        if not session.branches:
            if branch is not None:
                raise ValueError(f"Session defines no branches; cannot play branch '{branch}'.")
            return session.commands, None, None

        note = None
        if branch is None:
            branch = next(iter(session.branches))
            note = (
                f"No --branch given; this session defines branches — "
                f"defaulting to first branch {cyan}'{branch}'{yellow}."
            )
        if branch not in session.branches:
            raise ValueError(f"Unknown branch '{branch}'. Available: {', '.join(session.branches)}")
        return session.resolve_branch(branch), branch, note

    @staticmethod
    def _resolve_params(
        session: BridgeSession, params: dict[str, str] | None
    ) -> tuple[dict[str, str], list[str]]:
        """Merge session defaults with --param overrides.

        If the session declares a parameter block it has a known vocabulary,
        so an override that matches nothing in it is a typo (or a renamed
        param) and we fail fast. Silently accepting it is worse than useless:
        playback still reports 100% success while quietly building the
        default geometry, and the mistake only surfaces when the mesh is
        eyeballed. Sessions with NO parameters block keep the permissive
        behaviour, so they can still be driven ad hoc (mirrors Studio's
        "add a parameter" flow).

        Returns (resolved, names_that_were_overridden).
        """
        resolved = dict(session.parameters)
        if session.parameters:
            unknown = sorted(set(params or {}) - set(session.parameters))
            if unknown:
                known = ", ".join(sorted(session.parameters))
                raise ValueError(
                    f"Unknown parameter(s): {', '.join(unknown)}.\n"
                    f"This session declares: {known}.\n"
                    "Check the spelling — an unrecognised --param would "
                    "otherwise be ignored and the session would play with its "
                    "default values."
                )
        overridden = []
        for name, value in (params or {}).items():
            if name in resolved and resolved[name] != value:
                overridden.append(name)
            resolved[name] = value
        return resolved, overridden

    @staticmethod
    def _print_header(
        session: "BridgeSession",
        branch: str | None,
        branch_note: str | None,
        resolved_params: dict[str, str],
        overridden: Collection[str],
    ) -> None:
        """Print the pre-playback banner (name, description, branch, params).

        Split out of play() purely to keep it under the McCabe 12 limit that CI
        enforces — this is all conditional printing with no logic of its own.
        """
        cyan = "\033[96m"
        yellow = "\033[93m"
        reset = "\033[0m"
        bold = "\033[1m"

        print(f"\n{bold}Playing session:{reset} {cyan}{session.metadata.name}{reset}")
        if session.metadata.description:
            print(f"{bold}Description:{reset} {session.metadata.description}")
        if branch is not None:
            print(f"{bold}Branch:{reset} {cyan}{branch}{reset}")
        if branch_note:
            print(f"{yellow}{branch_note}{reset}")
        if resolved_params:
            print(f"{bold}Parameters:{reset}")
            for name, value in resolved_params.items():
                tag = f" {yellow}(overridden){reset}" if name in overridden else ""
                print(f"  {name} = {value}{tag}")
        print("-" * 60)

    @staticmethod
    def _print_summary(branch: str | None, total: int, success_count: int, fail_count: int) -> None:
        green = "\033[92m"
        red = "\033[91m"
        reset = "\033[0m"
        bold = "\033[1m"

        label_width = 16
        print(f"\n{bold}Playback Summary:{reset}")
        if branch is not None:
            print(f"  {'Branch:':<{label_width}} {branch}")
        print(f"  {'Total Commands:':<{label_width}} {total}")
        print(f"  {green}{'Successes:':<{label_width}} {success_count}{reset}")

        fail_color = red if fail_count > 0 else green
        print(f"  {fail_color}{'Failures:':<{label_width}} {fail_count}{reset}")

        print(f"\n{bold}{green if fail_count == 0 else red}Playback finished.{reset}")

    async def play(
        self,
        session: BridgeSession,
        branch: str | None = None,
        params: dict[str, str] | None = None,
    ):
        client = await self._get_client()

        # ANSI Color codes
        green = "\033[92m"
        red = "\033[91m"
        cyan = "\033[96m"
        yellow = "\033[93m"
        reset = "\033[0m"
        bold = "\033[1m"

        commands, branch, branch_note = self._select_branch(session, branch)
        resolved_params, overridden = self._resolve_params(session, params)

        # Expand any for_each loop commands into concrete commands now that
        # params are finalized — loop bounds (start/end/step expressions) are
        # evaluated against the actual playback params, so e.g. a honeycomb
        # grid's column/row count is computed for the real ${b8_length}/
        # ${b8_depth} instead of being baked in at authoring time.
        pre_expand_count = len(commands)
        commands = expand_for_each_loops(commands, resolved_params)
        if len(commands) != pre_expand_count:
            print(
                f"{yellow}Expanded for_each loops: {pre_expand_count} -> "
                f"{len(commands)} commands.{reset}"
            )

        self._print_header(session, branch, branch_note, resolved_params, overridden)

        success_count = 0
        fail_count = 0

        try:
            for i, cmd in enumerate(commands):
                # Print command and header
                print(f"{bold}[{i + 1}/{len(commands)}]{reset} Calling {cyan}{cmd.tool}{reset}...")

                # Print description if available
                if cmd.description:
                    # Indent and prefix descriptions for readability
                    indented_desc = "\n".join(
                        [f"  | {line}" for line in cmd.description.splitlines()]
                    )
                    print(f"{indented_desc}")

                try:
                    args = resolve_args(cmd.arguments, resolved_params)

                    # Use the async version of call_tool to avoid loop nesting issues
                    if hasattr(client, "call_tool_async"):
                        result = await client.call_tool_async(cmd.tool, args)
                    else:
                        result = client.call_tool(cmd.tool, args)

                    # A tool can complete its round-trip and still refuse to do the
                    # work: generate_views returns {"success": false, "error": "No
                    # visible mesh objects to render"} on an empty scene. Only
                    # catching transport exceptions counted that as a success and
                    # printed a green tick, which is how this project accumulated a
                    # history of "26/26 passed" runs that produced wrong geometry.
                    #
                    # Note the payload also carries status="success" and
                    # message="... completed successfully." alongside success=False —
                    # those two are envelope-level (the CALL worked), so they must not
                    # be consulted here. The tool-level "success" key is the authority.
                    tool_error = None
                    if isinstance(result, dict) and result.get("success") is False:
                        tool_error = result.get("error") or "tool reported success=false"
                    if tool_error:
                        raise RuntimeError(tool_error)

                    # Success indicator
                    print(f"  {bold}{green}✓ SUCCESS{reset}")
                    success_count += 1
                except Exception as e:
                    # Failure indicator. Plain ASCII "x": Windows consoles
                    # default to cp1252, which cannot encode "✘" — printing it
                    # raised UnicodeEncodeError from inside the error handler,
                    # destroying the very message it was trying to report.
                    print(f"  {bold}{red}x ERROR:{reset} {e}")
                    fail_count += 1

                print("-" * 60)

            self._print_summary(branch, len(commands), success_count, fail_count)
        finally:
            if hasattr(client, "aclose"):
                await client.aclose()
