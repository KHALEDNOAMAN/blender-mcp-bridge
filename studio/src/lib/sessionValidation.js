// Shared session shape validation — see docs/studio_design_v1.md §6.3.
// Not JSON-mode-only: runBranch() also calls validateBranches() before
// dispatching, since nothing previously guarded a branch's ranges against
// out-of-bounds indices at run time (the click-to-pick BranchBuilder only
// ever produces valid ranges by construction, but that's not a real guard).

/**
 * Validate every branch's every [start, end] range against a commands array.
 * Returns a list of human-readable error strings — empty array means valid.
 */
export function validateBranches(session) {
    const errors = [];
    const branches = (session && session.branches) || {};
    const commandCount = (session && session.commands && session.commands.length) || 0;

    Object.entries(branches).forEach(([branchName, branch]) => {
        const ranges = (branch && branch.ranges) || [];
        if (ranges.length === 0) {
            errors.push(`Branch "${branchName}" has no ranges.`);
            return;
        }
        ranges.forEach((range, i) => {
            if (!Array.isArray(range) || range.length !== 2) {
                errors.push(`Branch "${branchName}" range #${i + 1} must be a [start, end] pair.`);
                return;
            }
            const [start, end] = range;
            if (!Number.isInteger(start) || !Number.isInteger(end)) {
                errors.push(`Branch "${branchName}" range #${i + 1} must contain integers, got [${start}, ${end}].`);
                return;
            }
            if (start < 0 || end < 0 || start >= commandCount || end >= commandCount) {
                errors.push(`Branch "${branchName}" range #${i + 1} [${start}, ${end}] is out of bounds for ${commandCount} command(s).`);
                return;
            }
            if (start > end) {
                errors.push(`Branch "${branchName}" range #${i + 1} [${start}, ${end}] has start > end.`);
            }
        });
    });

    return errors;
}

/**
 * Validate the overall session shape (used by the JSON-mode Apply flow,
 * §6.3). Checks structural requirements beyond plain JSON syntax; does NOT
 * check ${param} references — those resolve lazily at dispatch time (§4),
 * same as guided-UI-typed commands, so a JSON-pasted command referencing a
 * not-yet-created param is not an apply-time error.
 */
export function validateSessionShape(session) {
    const errors = [];
    if (!session || typeof session !== 'object') {
        return ['Session must be a JSON object.'];
    }
    if (!Array.isArray(session.commands)) {
        errors.push('Session must have a "commands" array.');
    }
    if (session.branches && typeof session.branches !== 'object') {
        errors.push('"branches" must be an object.');
    } else if (session.branches) {
        errors.push(...validateBranches(session));
    }
    return errors;
}
