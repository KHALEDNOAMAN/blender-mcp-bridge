# src/params.py
#
# Python port of studio/src/lib/expr.js + studio/src/lib/params.js â€” CLI-side
# resolution of a session's top-level "parameters" block and "${name}" tokens
# (bare or arithmetic expressions) embedded in command arguments. Kept as a
# small hand-written recursive-descent parser (not eval()) to match the JS
# implementation's safety-by-construction approach.
#
# floor/ceil/min/max function calls support for_each loop-bound math (e.g.
# "how many hexagons fit across this plate"). Trig/sqrt/abs let a session
# derive an angle from a parameter (e.g. a chord-to-sweep asin) rather than
# baking in a literal. Both sets are mirrored in studio/src/lib/expr.js —
# keep the two in lockstep or a session plays differently from Studio.
#
# Grammar (standard precedence, left-associative):
#   expr   := term (("+" | "-") term)*
#   term   := factor (("*" | "/") factor)*
#   factor := NUMBER | PARAM | FUNCCALL | "(" expr ")" | ("-" factor)
#   FUNCCALL := NAME "(" expr ("," expr)* ")"
#              NAME in floor/ceil/min/max/sin/cos/tan/asin/acos/atan/
#                      atan2/sqrt/abs  (trig in DEGREES)
#   PARAM  := "${" NAME "}"

import math
import re
from typing import Any

# Bare identifiers only tokenize as function-call names (floor/ceil/min/max),
# matched literally rather than as a generic \w+ pattern â€” a generic identifier
# token would make ordinary names like "Wall_Bed2-3_Center" look expression-
# shaped to looks_like_expression() (digits + a "-" + now-valid identifier
# tokens = tokenizes cleanly) and wrongly route them into the parser. See
# studio-expression-heuristic-false-positive memory: same failure class.
# Longest-first: the tokenizer alternates these literally, so "asin" must be
# tried before "sin" or "asin(x)" tokenizes as the name "a" followed by "sin".
_FUNC_NAMES = (
    "floor",
    "ceil",
    "min",
    "max",
    "asin",
    "acos",
    "atan2",
    "atan",
    "sqrt",
    "sin",
    "cos",
    "tan",
    "abs",
)
_TOKEN_RE = re.compile(
    r"\s*(\$\{[a-zA-Z_][a-zA-Z0-9_]*\}|" + "|".join(_FUNC_NAMES) + r"|\d+(?:\.\d+)?|[()+\-*/,])"
)
_PARAM_TOKEN_RE = re.compile(r"^\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}$")
_PARAM_REF_RE = re.compile(r"\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}")

# Trig works in DEGREES, matching every angle field in the tool surface
# (rotation, start_deg/end_deg, ...). A session that needs radians can always
# multiply by pi/180 itself; the reverse would silently mis-size arcs.
_FUNCTIONS = {
    "floor": lambda *a: float(math.floor(a[0])),
    "ceil": lambda *a: float(math.ceil(a[0])),
    "min": lambda *a: min(a),
    "max": lambda *a: max(a),
    "sin": lambda *a: math.sin(math.radians(a[0])),
    "cos": lambda *a: math.cos(math.radians(a[0])),
    "tan": lambda *a: math.tan(math.radians(a[0])),
    "asin": lambda *a: math.degrees(math.asin(a[0])),
    "acos": lambda *a: math.degrees(math.acos(a[0])),
    "atan": lambda *a: math.degrees(math.atan(a[0])),
    "atan2": lambda *a: math.degrees(math.atan2(a[0], a[1])),
    "sqrt": lambda *a: math.sqrt(a[0]),
    "abs": lambda *a: abs(a[0]),
}


class ExpressionError(Exception):
    pass


def _tokenize(source: str) -> list[str]:
    tokens = []
    pos = 0
    while pos < len(source):
        m = _TOKEN_RE.match(source, pos)
        if not m or m.start() != pos:
            raise ExpressionError(f"Unexpected character at position {pos}")
        tokens.append(m.group(1))
        pos = m.end()
    return tokens


def looks_like_expression(source: Any) -> bool:
    """True if `source` is expression-shaped (contains an operator or a param
    ref, and tokenizes cleanly end-to-end) rather than an ordinary literal."""
    if not isinstance(source, str):
        return False
    if not re.search(r"[+\-*/()]", source):
        return False
    if not (_PARAM_REF_RE.search(source) or re.search(r"\d", source)):
        return False
    try:
        tokens = _tokenize(source.strip())
        return len(tokens) > 0
    except ExpressionError:
        return False


def collect_param_names(source: str) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for m in _PARAM_REF_RE.finditer(source):
        name = m.group(1)
        if name not in seen:
            seen.add(name)
            names.append(name)
    return names


class _Parser:
    def __init__(self, tokens: list[str], parameters: dict[str, str]):
        self.tokens = tokens
        self.pos = 0
        self.parameters = parameters

    def peek(self) -> str | None:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def next(self) -> str:
        tok = self.tokens[self.pos]
        self.pos += 1
        return tok

    def parse_expr(self) -> float:
        value = self.parse_term()
        while self.peek() in ("+", "-"):
            op = self.next()
            rhs = self.parse_term()
            value = value + rhs if op == "+" else value - rhs
        return value

    def parse_term(self) -> float:
        value = self.parse_factor()
        while self.peek() in ("*", "/"):
            op = self.next()
            rhs = self.parse_factor()
            value = value * rhs if op == "*" else value / rhs
        return value

    def _parse_param(self, tok: str) -> float:
        """`${name}` -> its numeric value. Assumes tok is already consumed."""
        name = tok[2:-1]
        if name not in self.parameters:
            raise ExpressionError(f"Undefined parameter: {name}")
        raw = self.parameters[name]
        try:
            return float(raw)
        except (TypeError, ValueError) as err:
            raise ExpressionError(f'Parameter "{name}" is not numeric (value: "{raw}")') from err

    def _parse_call(self, tok: str) -> float:
        """`name(arg, ...)` -> the function's result. Assumes tok is consumed."""
        if self.peek() != "(":
            raise ExpressionError(f'Expected "(" after function name "{tok}"')
        self.next()
        args = [self.parse_expr()]
        while self.peek() == ",":
            self.next()
            args.append(self.parse_expr())
        if self.next() != ")":
            raise ExpressionError('Expected closing ")"')
        try:
            return _FUNCTIONS[tok](*args)
        except (ValueError, ZeroDivisionError) as err:
            # asin/acos outside [-1,1], sqrt of a negative, ... Surface these
            # as ExpressionError so a bad parameter reports the offending call
            # instead of escaping as an unhandled ValueError mid-playback.
            arglist = ", ".join(f"{a:g}" for a in args)
            raise ExpressionError(f"{tok}({arglist}): {err}") from err
        except IndexError as err:
            raise ExpressionError(f"{tok}(): wrong number of arguments") from err

    def parse_factor(self) -> float:
        tok = self.peek()
        if tok is None:
            raise ExpressionError("Unexpected end of expression")
        if tok == "-":
            self.next()
            return -self.parse_factor()
        if tok == "(":
            self.next()
            value = self.parse_expr()
            if self.next() != ")":
                raise ExpressionError('Expected closing ")"')
            return value
        if tok.startswith("${"):
            self.next()
            return self._parse_param(tok)
        if tok[0].isdigit():
            self.next()
            return float(tok)
        if tok in _FUNC_NAMES:
            self.next()
            return self._parse_call(tok)
        raise ExpressionError(f"Unexpected token: {tok}")


def evaluate_expression(source: str, parameters: dict[str, str]) -> float:
    tokens = _tokenize(source.strip())
    if not tokens:
        raise ExpressionError("Empty expression")
    parser = _Parser(tokens, parameters)
    value = parser.parse_expr()
    if parser.pos != len(tokens):
        raise ExpressionError(f"Unexpected token: {parser.peek()}")
    if value != value or value in (float("inf"), float("-inf")):  # NaN or +/-Infinity
        kind = "NaN" if value != value else "Infinity"
        raise ExpressionError(f"Expression evaluates to {kind}: divide by zero or invalid math")
    return value


def extract_param_name(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    m = _PARAM_TOKEN_RE.match(value)
    return m.group(1) if m else None


def is_parametric(value: Any) -> bool:
    # The third clause covers string interpolation ("bolt_M${bolt_major}.stl"):
    # such a string is neither a bare token nor expression-shaped, but it still
    # has to be routed through resolve_value() rather than passed through raw.
    return (
        extract_param_name(value) is not None
        or looks_like_expression(value)
        or (isinstance(value, str) and bool(_PARAM_REF_RE.search(value)))
    )


def resolve_value(raw: Any, parameters: dict[str, str]) -> Any:
    """Resolve a single value that may be a bare '${name}' token or an
    arithmetic expression. Returns the param's raw string for a bare token,
    or a float for an expression. Non-parametric values pass through
    unchanged. Raises ExpressionError on an unresolved/undefined param or a
    genuine syntax/type error."""
    bare_name = extract_param_name(raw)
    if bare_name is not None:
        if bare_name in parameters:
            return parameters[bare_name]
        raise ExpressionError(f"Undefined parameter: {bare_name}")
    if isinstance(raw, str) and looks_like_expression(raw):
        refs = collect_param_names(raw)
        missing = [n for n in refs if n not in parameters]
        if missing:
            raise ExpressionError(f"Undefined parameter(s): {', '.join(missing)}")
        return evaluate_expression(raw, parameters)
    # Last resort: string interpolation, e.g. "bolt_M${bolt_major}_L${bolt_length}.stl".
    # Deliberately AFTER the two numeric paths so nothing that already resolved as a
    # bare token or an expression changes behaviour. A string only reaches here if it
    # failed looks_like_expression(), i.e. it does not tokenize as arithmetic.
    # Note "${a}-${b}" DOES tokenize (as subtraction) and is evaluated above â€” keep
    # separators like "_" in filenames, not "-", or you get a number.
    # Numeric-looking values are trimmed ("6.0" -> "6") so filenames read M6, not M6.0.
    if isinstance(raw, str) and _PARAM_REF_RE.search(raw):

        def _sub(m: re.Match) -> str:
            name = m.group(1)
            if name not in parameters:
                raise ExpressionError(f"Undefined parameter: {name}")
            val = str(parameters[name])
            try:
                f = float(val)
                return str(int(f)) if f == int(f) else str(f)
            except ValueError:
                return val

        return _PARAM_REF_RE.sub(_sub, raw)
    return raw


def resolve_args(args: Any, parameters: dict[str, str]) -> Any:
    """Recursively resolve every '${name}' token / expression string inside a
    command's arguments (walks dicts/lists), matching Studio's
    resolveArgsObject. A resolved bare-token string is JSON-parsed if it looks
    like JSON (array/object/number/bool), else left as a string â€” there's no
    per-field schema to consult on this path, same as the JS version."""
    if isinstance(args, str) and is_parametric(args):
        value = resolve_value(args, parameters)
        if isinstance(value, float):
            return value
        import json

        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return value
    if isinstance(args, list):
        return [resolve_args(v, parameters) for v in args]
    if isinstance(args, dict):
        return {k: resolve_args(v, parameters) for k, v in args.items()}
    return args
