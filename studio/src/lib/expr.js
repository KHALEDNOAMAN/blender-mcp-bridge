// studio/src/lib/expr.js

// Minimal arithmetic expression evaluator for parametric arg fields.
// See docs/studio_design_v1.md §4.4. Grammar: numeric literals, ${name}
// references, + - * / and parens only. Deliberately NOT eval()/Function() —
// a small hand-written recursive-descent parser instead, so the grammar is
// safe by construction rather than relying on sandboxing a real JS evaluator.
//
// floor/ceil/min/max function calls added to support for_each loop-bound
// math (see lib/forEach.js) — ported from src/params.py's identical
// addition. Trig/sqrt/abs added so a session can derive an angle from a
// parameter (e.g. a chord-to-sweep asin) instead of baking in a literal.
// Bare identifiers only tokenize as one of these literal
// function names, NOT a generic \w+ pattern — a generic identifier token
// would make ordinary strings like "Wall_Bed2-3_Center" look
// expression-shaped to looksLikeExpression() (digits + a "-" + now-valid
// identifier tokens = tokenizes cleanly) and wrongly route them into the
// parser. See studio-expression-heuristic-false-positive memory: same
// failure class, hit once already fixing looksLikeExpression() itself.
//
// Grammar (standard precedence, left-associative):
//   expr     := term (("+" | "-") term)*
//   term     := factor (("*" | "/") factor)*
//   factor   := NUMBER | PARAM | FUNCCALL | "(" expr ")" | ("-" factor)
//   funccall := FUNCNAME "(" expr ("," expr)* ")"
//   PARAM    := "${" NAME "}"
//   FUNCNAME := "floor" | "ceil" | "min" | "max" | "sin" | "cos"
//             | "tan" | "asin" | "acos" | "atan" | "atan2" | "sqrt" | "abs"

// Longest-first: the tokenizer alternates these literally, so "asin" must be
// tried before "sin" or "asin(x)" tokenizes as the name "a" followed by "sin".
const FUNC_NAMES = [
    'floor', 'ceil', 'min', 'max',
    'asin', 'acos', 'atan2', 'atan', 'sqrt', 'sin', 'cos', 'tan', 'abs',
];
// Trig works in DEGREES, matching every angle field in the tool surface
// (rotation, start_deg/end_deg, ...). Keep in lockstep with src/params.py.
const DEG = Math.PI / 180;
const FUNCTIONS = {
    floor: (...a) => Math.floor(a[0]),
    ceil: (...a) => Math.ceil(a[0]),
    min: (...a) => Math.min(...a),
    max: (...a) => Math.max(...a),
    sin: (...a) => Math.sin(a[0] * DEG),
    cos: (...a) => Math.cos(a[0] * DEG),
    tan: (...a) => Math.tan(a[0] * DEG),
    asin: (...a) => Math.asin(a[0]) / DEG,
    acos: (...a) => Math.acos(a[0]) / DEG,
    atan: (...a) => Math.atan(a[0]) / DEG,
    atan2: (...a) => Math.atan2(a[0], a[1]) / DEG,
    sqrt: (...a) => Math.sqrt(a[0]),
    abs: (...a) => Math.abs(a[0]),
};

const TOKEN_RE = new RegExp(
    `\\s*(\\$\\{[a-zA-Z_][a-zA-Z0-9_]*\\}|${FUNC_NAMES.join('|')}|\\d+(?:\\.\\d+)?|[()+\\-*/,])`,
    'g'
);

function tokenize(source) {
    const tokens = [];
    let lastIndex = 0;
    TOKEN_RE.lastIndex = 0;
    let match;
    while ((match = TOKEN_RE.exec(source))) {
        if (match.index !== lastIndex) {
            throw new Error(`Unexpected character at position ${lastIndex}`);
        }
        tokens.push(match[1]);
        lastIndex = TOKEN_RE.lastIndex;
    }
    if (lastIndex !== source.length) {
        throw new Error(`Unexpected character at position ${lastIndex}`);
    }
    return tokens;
}

/**
 * True if `source` looks like it's meant to be an expression at all (contains
 * an operator or a param reference beyond a single bare token) — used to
 * decide whether a field's raw string should go through the expression path
 * versus being treated as an ordinary literal. A bare "${name}" alone is
 * still handled by the plain single-token substitution path in lib/params.js
 * for backward compatibility / simplicity; this only needs to catch
 * genuinely-expression-shaped strings.
 *
 * Must tokenize cleanly under TOKEN_RE (the same tokenizer evaluateExpression
 * uses) end-to-end, not just contain an operator character somewhere — a
 * plain identifier like "Wall_Bed2-3_Center" contains a digit and a "-" but
 * is not expression-shaped, and a substring/regex check alone would wrongly
 * route it into the parser and throw "Unexpected character at position 0".
 */
export function looksLikeExpression(source) {
    if (typeof source !== 'string') return false;
    if (!/[+\-*/()]/.test(source) || !/\$\{[a-zA-Z_][a-zA-Z0-9_]*\}|\d/.test(source)) return false;
    try {
        const tokens = tokenize(source.trim());
        return tokens.length > 0;
    } catch {
        return false;
    }
}

/** Collect every ${name} reference in an expression string, in source order, de-duplicated. */
export function collectParamNames(source) {
    const names = [];
    const seen = new Set();
    const re = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    let m;
    while ((m = re.exec(source))) {
        if (!seen.has(m[1])) { seen.add(m[1]); names.push(m[1]); }
    }
    return names;
}

class Parser {
    constructor(tokens, parameters) {
        this.tokens = tokens;
        this.pos = 0;
        this.parameters = parameters;
    }

    peek() { return this.tokens[this.pos]; }
    next() { return this.tokens[this.pos++]; }

    parseExpr() {
        let value = this.parseTerm();
        while (this.peek() === '+' || this.peek() === '-') {
            const op = this.next();
            const rhs = this.parseTerm();
            value = op === '+' ? value + rhs : value - rhs;
        }
        return value;
    }

    parseTerm() {
        let value = this.parseFactor();
        while (this.peek() === '*' || this.peek() === '/') {
            const op = this.next();
            const rhs = this.parseFactor();
            value = op === '*' ? value * rhs : value / rhs;
        }
        return value;
    }

    parseFactor() {
        const tok = this.peek();
        if (tok === undefined) throw new Error('Unexpected end of expression');
        if (tok === '-') { this.next(); return -this.parseFactor(); }
        if (tok === '(') {
            this.next();
            const value = this.parseExpr();
            if (this.next() !== ')') throw new Error('Expected closing ")"');
            return value;
        }
        if (/^\$\{/.test(tok)) {
            this.next();
            const name = tok.slice(2, -1);
            if (!(name in this.parameters)) {
                throw new Error(`Undefined parameter: ${name}`);
            }
            const raw = this.parameters[name];
            const num = parseFloat(raw);
            if (Number.isNaN(num)) {
                throw new Error(`Parameter "${name}" is not numeric (value: "${raw}")`);
            }
            return num;
        }
        if (/^\d/.test(tok)) {
            this.next();
            return parseFloat(tok);
        }
        if (FUNC_NAMES.includes(tok)) {
            this.next();
            if (this.peek() !== '(') throw new Error(`Expected "(" after function name "${tok}"`);
            this.next();
            const args = [this.parseExpr()];
            while (this.peek() === ',') {
                this.next();
                args.push(this.parseExpr());
            }
            if (this.next() !== ')') throw new Error('Expected closing ")"');
            const result = FUNCTIONS[tok](...args);
            // JS returns NaN rather than throwing for asin/acos outside
            // [-1,1] and sqrt of a negative. Surface it as an error naming
            // the offending call, matching src/params.py's ExpressionError,
            // instead of letting NaN flow into a coordinate.
            if (Number.isNaN(result) && !args.some(Number.isNaN)) {
                throw new Error(`${tok}(${args.join(', ')}): argument out of domain`);
            }
            return result;
        }
        throw new Error(`Unexpected token: ${tok}`);
    }
}

/**
 * Evaluate an arithmetic expression string against a { name: rawStringValue }
 * parameter map. Throws on syntax errors, undefined params, or non-numeric
 * param values — callers should catch and surface these as validation errors
 * rather than letting a malformed expression silently dispatch.
 */
export function evaluateExpression(source, parameters) {
    const tokens = tokenize(source.trim());
    if (tokens.length === 0) throw new Error('Empty expression');
    const parser = new Parser(tokens, parameters);
    const value = parser.parseExpr();
    if (parser.pos !== tokens.length) {
        throw new Error(`Unexpected token: ${parser.peek()}`);
    }
    if (!Number.isFinite(value)) {
        const kind = Number.isNaN(value) ? 'NaN' : 'Infinity';
        throw new Error(`Expression evaluates to ${kind}: divide by zero or invalid math`);
    }
    return value;
}

/**
 * Recursively collect every string found inside a JSON-ish value (walks
 * arrays/objects) — shared by any caller that needs to check parametric
 * strings possibly nested inside an array/object-typed form field (e.g.
 * `location: [0, 0, "${h} / 2"]`), not just a bare scalar field value.
 */
export function collectStringLeaves(value, out = []) {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach((v) => collectStringLeaves(v, out));
    else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStringLeaves(v, out));
    return out;
}

/**
 * Given a raw field value (which may be a bare scalar string, or JSON text
 * for an array/object-typed field), return every string worth checking for
 * parametric problems: if the value parses as JSON array/object, every
 * string leaf inside it; otherwise the raw value itself (covers scalar
 * fields, and array JSON that isn't valid yet mid-edit).
 */
export function candidateStringsForField(rawFieldValue) {
    try {
        const parsed = JSON.parse(rawFieldValue);
        if (Array.isArray(parsed) || (parsed && typeof parsed === 'object')) {
            return collectStringLeaves(parsed);
        }
    } catch {
        // Not valid JSON yet — fall through to treating the raw text as
        // the one candidate (correct for scalar fields; for array fields
        // mid-edit, best-effort until it's valid JSON again).
    }
    return [rawFieldValue];
}
