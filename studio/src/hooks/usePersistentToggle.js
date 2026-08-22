// studio/src/hooks/usePersistentToggle.js

import { useCallback, useState } from 'react';

/**
 * Boolean UI state that survives a reload, backed by localStorage.
 *
 * Studio has many collapsible panels, each of which was hand-rolling the same
 * three things: a lazy useState initialiser that parsed localStorage, a toggle
 * that flipped the value, and a setItem call to write it back. That triple was
 * duplicated once per panel, and the read/write string keys had to be kept in
 * sync by hand.
 *
 * @param {string} key            localStorage key.
 * @param {boolean} defaultValue  value when nothing is stored yet.
 * @returns {[boolean, () => void, (v: boolean) => void]}
 *          [value, toggle, set] — `toggle` is stable, for passing as a prop.
 */
export function usePersistentToggle(key, defaultValue = false) {
    const [value, setValue] = useState(() => {
        const stored = localStorage.getItem(key);
        // Nothing stored yet -> caller's default. Anything else is compared as
        // a string, matching how these were written (setItem coerces booleans).
        return stored === null ? defaultValue : stored === 'true';
    });

    const set = useCallback(
        (next) => {
            setValue(() => {
                localStorage.setItem(key, next);
                return next;
            });
        },
        [key],
    );

    const toggle = useCallback(() => {
        setValue((prev) => {
            const next = !prev;
            localStorage.setItem(key, next);
            return next;
        });
    }, [key]);

    return [value, toggle, set];
}
