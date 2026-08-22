// studio/src/lib/controlTools.js

/**
 * Schemas for client-side CONTROL-FLOW constructs — commands that look like
 * tools in a session but are never dispatched to the bridge.
 *
 * `for_each` is expanded locally by lib/forEach.js before dispatch, so it
 * appears in neither the bridge's tools/list nor its demo snapshot
 * (lib/demoTools.js). Without a schema here, DynamicArgsForm had nothing to
 * render and the Edit Command modal simply refused to open a loop, sending
 * the user to raw JSON mode.
 *
 * These are hand-written (there is no server to generate them from) and are
 * merged into the available-tools list by App.jsx, which is also what lets
 * the existing expression validation in lib/expr.js apply to loop bounds:
 * start/end/step are typed as `string` because they hold EXPRESSIONS
 * ("${bin_lid_knob}", "ceil(min(1, max(0, ${x})))"), evaluated once before
 * the loop begins — not plain numbers. Typing them as `number` would make
 * SchemaField render a native number input that cannot display a "${...}"
 * token and would silently clear it.
 *
 * `body` (the loop's template command list) is deliberately NOT part of the
 * schema: it holds whole nested command objects, not scalar args, and lives
 * on the command itself rather than under `arguments`. It is preserved
 * untouched across an edit by App.jsx.
 */

export const FOR_EACH_TOOL = {
    name: 'for_each',
    description:
        'Repeat a list of commands once per index, substituting "${var}" in the body. '
        + 'Expanded client-side before dispatch; start/end/step are expressions evaluated once, end is inclusive.',
    inputSchema: {
        type: 'object',
        properties: {
            var: {
                type: 'string',
                description: 'Loop variable name, referenced as "${name}" inside the body.',
            },
            start: {
                type: 'string',
                description: 'First index, as a number or expression (default: 0).',
                default: '0',
            },
            end: {
                type: 'string',
                description: 'Last index, inclusive, as a number or expression.',
            },
            step: {
                type: 'string',
                description: 'Increment between indices; may be negative, but never 0 (default: 1).',
                default: '1',
            },
        },
        required: ['var', 'end'],
    },
};

export const CONTROL_TOOLS = [FOR_EACH_TOOL];

export const CONTROL_TOOL_NAMES = CONTROL_TOOLS.map((t) => t.name);

/** True for commands expanded client-side rather than dispatched to the bridge. */
export function isControlTool(name) {
    return CONTROL_TOOL_NAMES.includes(name);
}
