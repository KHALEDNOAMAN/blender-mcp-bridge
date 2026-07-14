// Minimal arithmetic expression evaluator for parametric arg fields.
// See docs/studio_design_v1.md §4.4. Grammar: numeric literals, ${name}
// references, + - * / and parens only. Deliberately NOT eval()/Function() —
// a small hand-written recursive-descent parser instead, so the grammar is
// safe by construction rather than relying on sandboxing a real JS evaluator.
//
// Grammar (standard precedence, left-associative):
//   expr   := term (("+" | "-") term)*
//   term   := factor (("*" | "/") factor)*
//   factor := NUMBER | PARAM | "(" expr ")" | ("-" factor)
//   PARAM  := "${" NAME "}"

const TOKEN_RE = /\s*(\$\{[a-zA-Z_][a-zA-Z0-9_]*\}|\d+(?:\.\d+)?|[()+\-*/])/g;

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
 */
export function looksLikeExpression(source) {
    if (typeof source !== 'string') return false;
    return /[+\-*/()]/.test(source) && /\$\{[a-zA-Z_][a-zA-Z0-9_]*\}|\d/.test(source);
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
