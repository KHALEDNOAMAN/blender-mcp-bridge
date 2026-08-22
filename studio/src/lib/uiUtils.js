// studio/src/lib/uiUtils.js

export function stringifyCompact(obj) {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/\[\s+([^[{\]]+)\s+\]/g, (match, p1) => {
        return "[" + p1.replace(/\s+/g, ' ').trim() + "]";
    });
}

/**
 * Placeholder text for an UNSET optional schema field — the "ghost default".
 *
 * A field the user hasn't set must never render its schema default as if it
 * were a chosen value: doing so made the Edit Command modal show three
 * populated fields for a command whose JSON held only one, and (because
 * getArgs() keeps a displayed value but skips an empty one) opening the
 * modal and pressing Apply silently rewrote the command with args the user
 * never entered. Showing the default as placeholder/ghost text instead keeps
 * the form an honest view of the underlying JSON and makes the round trip an
 * identity.
 *
 * Falls back to parsing a trailing "(default: X)" out of the description for
 * tools that document their default only in prose rather than emitting a
 * real JSON-Schema `default` (e.g. repair_mesh's merge_distance).
 */
export function defaultLabel(prop, isRequired = false) {
    if (prop.default !== undefined) return `default: ${prop.default}`;
    const m = prop.description && prop.description.match(/\(default:\s*([^)]+)\)/i);
    if (m) return `default: ${m[1].trim()}`;
    return isRequired ? '' : 'optional';
}

export function updateTextareaHeight(ta) {
    if (!ta) return;
    if (!ta.classList.contains('auto-expand')) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
}
