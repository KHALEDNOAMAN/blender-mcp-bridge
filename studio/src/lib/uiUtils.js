// Ported from session_editor/ui.js (non-DOM-construction helpers)

export function stringifyCompact(obj) {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/\[\s+([^[{\]]+)\s+\]/g, (match, p1) => {
        return "[" + p1.replace(/\s+/g, ' ').trim() + "]";
    });
}

export function updateTextareaHeight(ta) {
    if (!ta) return;
    if (!ta.classList.contains('auto-expand')) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
}
