// studio/src/lib/jsonExprLinter.js

// Parametric expression linter for the JSON editor — see docs/studio_design_v1.md §6.5.
// A second CodeMirror lint source alongside the plain JSON-syntax linter,
// same lint gutter. Scoped to commands[].arguments values ONLY — NOT a
// blind whole-document string scan (that was the v1 bug: looksLikeExpression()'s
// loose heuristic — "has an operator char and a digit or ${...}" — matches
// ordinary prose in a description field too, e.g. "location.z = box_height / 2
// (computed live)", producing false-positive syntax-error squiggles under
// plain text). Only strings actually inside an argument value are checked.

import { extractParamName, isParametric } from './params';
import { looksLikeExpression, collectParamNames, evaluateExpression, collectStringLeaves } from './expr';

// Matches a JSON string literal, used to locate a known string's exact
// source position within a bounded search window (a single command's
// source text), not the whole document — avoids collisions between
// identical string values used in different commands.
function findStringLiteralOffset(text, targetValue, searchFrom) {
    const needle = JSON.stringify(targetValue);
    const idx = text.indexOf(needle, searchFrom);
    if (idx === -1) return null;
    return { from: idx + 1, to: idx + needle.length - 1 }; // exclude quotes
}

/**
 * Scan `docText` for problems in commands[].arguments values only. Returns
 * an array of { from, to, message } in character-offset terms. Returns []
 * if the document doesn't parse as JSON, or has no commands array — the
 * plain JSON-syntax linter already owns reporting a parse failure.
 */
export function findExpressionProblems(docText, parameters) {
    let session;
    try {
        session = JSON.parse(docText);
    } catch {
        return [];
    }
    const commands = Array.isArray(session && session.commands) ? session.commands : [];
    if (commands.length === 0) return [];

    const problems = [];
    let cursor = 0;

    commands.forEach((cmd) => {
        if (!cmd || typeof cmd !== 'object' || !cmd.arguments) return;

        // Locate this command's own source slice first (search from where
        // the previous command left off), so string lookups for THIS
        // command's argument values never accidentally match an identical
        // string belonging to an earlier command.
        const cmdNeedle = JSON.stringify(cmd.tool ?? '');
        const cmdToolIdx = cmdNeedle.length > 2 ? docText.indexOf(cmdNeedle, cursor) : cursor;
        const cmdSearchStart = cmdToolIdx === -1 ? cursor : cmdToolIdx;

        const candidates = collectStringLeaves(cmd.arguments);
        let localCursor = cmdSearchStart;

        candidates.forEach((value) => {
            if (!isParametric(value)) return;

            const loc = findStringLiteralOffset(docText, value, localCursor);
            if (!loc) return; // shouldn't happen for valid JSON, but don't crash the linter if it does
            localCursor = loc.to;

            const bareName = extractParamName(value);
            if (bareName !== null) {
                if (!(bareName in parameters)) {
                    problems.push({ ...loc, message: `Undefined parameter: ${bareName}` });
                }
                return;
            }

            if (!looksLikeExpression(value)) return;
            const refs = collectParamNames(value);
            const missing = refs.filter((n) => !(n in parameters));
            if (missing.length > 0) {
                problems.push({
                    ...loc,
                    message: `Undefined parameter${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
                });
                return;
            }
            try {
                evaluateExpression(value, parameters);
            } catch (err) {
                problems.push({ ...loc, message: err.message });
            }
        });

        cursor = Math.max(localCursor, cmdSearchStart);
    });

    return problems;
}
