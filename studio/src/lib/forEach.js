// studio/src/lib/forEach.js

// for_each loop-command expansion — JS port of expand_for_each_loops /
// _substitute_loop_var in src/sessions.py. See that module's docstrings for
// the full rationale (parametric honeycomb grids without a fixed ceiling).
//
// A for_each command has shape:
//   { tool: 'for_each', arguments: { var, start, end, step }, body: [...] }
// `body` is a template list of raw command objects (same shape as a
// session's top-level "commands" entries) containing "${<var>}" tokens,
// re-emitted once per loop iteration with that token substituted for the
// current index. start/end/step are expressions (may reference session
// ${params} and floor/ceil/min/max) evaluated ONCE before the loop begins —
// not re-evaluated per iteration. end is inclusive.
//
// Nesting is supported: a for_each body may itself contain a for_each (e.g.
// an outer column loop containing an inner row loop) — substitution of the
// outer variable happens before recursing into the inner loop, so an inner
// loop's own start/end/step may reference the outer variable.

import { evaluateExpression } from './expr';

function substituteLoopVar(value, varName, indexStr) {
    const token = '${' + varName + '}';
    if (typeof value === 'string') {
        return value.split(token).join(indexStr);
    }
    if (Array.isArray(value)) {
        return value.map((v) => substituteLoopVar(v, varName, indexStr));
    }
    if (value && typeof value === 'object') {
        const out = {};
        Object.entries(value).forEach(([k, v]) => { out[k] = substituteLoopVar(v, varName, indexStr); });
        return out;
    }
    return value;
}

const MAX_ITERATIONS = 100_000; // guard rail against a runaway/malformed loop

/**
 * Expand every for_each command in `commands` into concrete commands,
 * evaluated against `parameters`. Non-for_each commands pass through
 * unchanged. Returns a new flat array (recursion resolves nesting).
 */
export function expandForEachLoops(commands, parameters) {
    const expanded = [];

    for (const cmd of commands) {
        if (cmd.tool !== 'for_each') {
            expanded.push(cmd);
            continue;
        }

        const args = cmd.arguments || {};
        const varName = args.var;
        if (!varName) {
            throw new Error("for_each command missing required 'var' argument");
        }
        if (!cmd.body || cmd.body.length === 0) {
            throw new Error(`for_each command (var='${varName}') has an empty or missing 'body'`);
        }
        if (args.end === undefined || args.end === null) {
            throw new Error(`for_each command (var='${varName}') missing required 'end' argument`);
        }

        const start = evaluateExpression(String(args.start ?? '0'), parameters);
        const end = evaluateExpression(String(args.end), parameters);
        const step = evaluateExpression(String(args.step ?? '1'), parameters);
        if (step === 0) {
            throw new Error(`for_each command (var='${varName}') has step=0, would loop forever`);
        }

        let i = start;
        let iterations = 0;
        while ((step > 0 && i <= end + 1e-9) || (step < 0 && i >= end - 1e-9)) {
            iterations += 1;
            if (iterations > MAX_ITERATIONS) {
                throw new Error(
                    `for_each command (var='${varName}') exceeded ${MAX_ITERATIONS} iterations `
                    + `(start=${start}, end=${end}, step=${step}) — check for a sign/bound error`
                );
            }
            const indexStr = Number.isInteger(i) ? String(i) : String(i);
            const bodyCommands = cmd.body.map((bc) => ({
                tool: bc.tool,
                arguments: substituteLoopVar(bc.arguments || {}, varName, indexStr),
                description: substituteLoopVar(bc.description ?? null, varName, indexStr),
                body: substituteLoopVar(bc.body ?? null, varName, indexStr),
            }));
            // Recurse so a nested for_each's own start/end/step (which may
            // reference THIS iteration's varName) are evaluated correctly.
            expanded.push(...expandForEachLoops(bodyCommands, parameters));
            i += step;
        }
    }

    return expanded;
}
