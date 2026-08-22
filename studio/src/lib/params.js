// studio/src/lib/params.js

// Global parameter resolution — see docs/studio_design_v1.md §4.
// A "${name}" token inside a string arg value is substituted with the
// matching parameter's raw string value, then coerced to the arg's
// schema-declared type. Resolution never mutates the stored command
// arguments — it only affects what gets sent to the MCP bridge at dispatch.
//
// Two forms of parametric string are supported (§4.4):
//   - a bare token, the entire field value is exactly "${name}" — substituted
//     with the param's raw string value (untouched, no numeric coercion here).
//   - an expression, the entire field value is an arithmetic expression over
//     one or more ${name} refs (e.g. "${a} + ${b} / 2") — evaluated to a
//     number via lib/expr.js.

import { evaluateExpression, looksLikeExpression, collectParamNames } from './expr';

const PARAM_TOKEN = /^\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}$/;

export function extractParamName(value) {
    if (typeof value !== 'string') return null;
    const match = value.match(PARAM_TOKEN);
    return match ? match[1] : null;
}

export function isParametric(value) {
    // The third clause covers string interpolation ("bolt_M${bolt_major}.stl"):
    // such a string is neither a bare token nor expression-shaped, but it still
    // has to be routed through resolveValue() rather than passed through raw.
    // Mirrors is_parametric() in src/params.py.
    return (
        extractParamName(value) !== null ||
        (typeof value === 'string' && looksLikeExpression(value)) ||
        (typeof value === 'string' && /\$\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(value))
    );
}

/**
 * Resolve a single string value that may be a bare "${name}" token or an
 * arithmetic expression. Returns { ok: true, value } on success — `value` is
 * the param's raw string for a bare token, or a number for an expression —
 * or { ok: false, unresolved: [names] } if any referenced param is missing,
 * or { ok: false, error } for a genuine syntax/type error in an expression.
 * Non-parametric strings resolve to themselves unchanged.
 */
export function resolveValue(raw, parameters) {
    const bareName = extractParamName(raw);
    if (bareName !== null) {
        if (bareName in parameters) return { ok: true, value: parameters[bareName] };
        return { ok: false, unresolved: [bareName] };
    }
    if (typeof raw === 'string' && looksLikeExpression(raw)) {
        const refs = collectParamNames(raw);
        const missing = refs.filter((n) => !(n in parameters));
        if (missing.length > 0) return { ok: false, unresolved: missing };
        try {
            return { ok: true, value: evaluateExpression(raw, parameters) };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }
    // Last resort: string interpolation, e.g. "bolt_M${bolt_major}_L${bolt_length}.stl".
    // Mirrors resolve_value() in src/params.py. Deliberately AFTER the two numeric
    // paths so nothing that already resolved as a bare token or an expression changes
    // behaviour — a string only reaches here if looksLikeExpression() rejected it,
    // i.e. it does not tokenize as arithmetic. Note "${a}-${b}" DOES tokenize (as
    // subtraction) and is evaluated above; use "_" as a filename separator, not "-".
    // Numeric values are trimmed ("6.0" -> "6") so filenames read M6, not M6.0.
    if (typeof raw === 'string' && /\$\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(raw)) {
        const missing = collectParamNames(raw).filter((n) => !(n in parameters));
        if (missing.length > 0) return { ok: false, unresolved: missing };
        const value = raw.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_m, name) => {
            const v = String(parameters[name]);
            // Match src/params.py exactly: any numeric value that is a whole
            // number renders without its fraction, so "6.0" -> "6" and a
            // filename reads M6 in Studio and the CLI alike. Comparing
            // String(f) === v instead would leave "6.0" untrimmed in JS only.
            const f = Number(v);
            return v.trim() !== '' && Number.isFinite(f) ? String(f) : v;
        });
        return { ok: true, value };
    }
    return { ok: true, value: raw };
}

function coerce(rawString, type) {
    if (type === 'number' || type === 'integer') return parseFloat(rawString);
    if (type === 'boolean') return rawString === 'true';
    if (type === 'json') return JSON.parse(rawString);
    return rawString;
}

/**
 * Resolve parametric strings inside an already-built args object (used by
 * the raw-JSON command-card path, which has no per-field schema type map —
 * only string/number/boolean/array/object values as JSON.parse produced
 * them). Bare-token results fall back to "parse as JSON if it looks like
 * one, else leave as string" since there's no schema to consult; expression
 * results are already numbers and pass through as-is.
 */
export function resolveArgsObject(args, parameters) {
    const unresolved = new Set();
    const errors = [];

    const walk = (value) => {
        if (typeof value === 'string' && isParametric(value)) {
            const result = resolveValue(value, parameters);
            if (!result.ok) {
                if (result.unresolved) result.unresolved.forEach((n) => unresolved.add(n));
                if (result.error) errors.push(result.error);
                return value;
            }
            if (typeof result.value === 'number') return result.value;
            try { return JSON.parse(result.value); } catch { return result.value; }
        }
        if (Array.isArray(value)) return value.map(walk);
        if (value && typeof value === 'object') {
            const out = {};
            Object.entries(value).forEach(([k, v]) => { out[k] = walk(v); });
            return out;
        }
        return value;
    };

    const resolved = walk(args);
    return { resolved, unresolved, errors };
}

export { coerce as coerceByType };
