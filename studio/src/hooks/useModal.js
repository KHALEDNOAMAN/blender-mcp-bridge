// studio/src/hooks/useModal.js

import { useCallback, useRef, useState } from 'react';

/**
 * Promise-based modal hook, ported from session_editor/modal.js `modal.show`.
 * Returns { modalState, alert, confirm, show } — mount <Modal state={modalState} .../>
 * once at the app root and wire its callbacks to the returned handlers.
 */
export function useModal() {
    const [modalState, setModalState] = useState(null);
    const resolverRef = useRef(null);
    const validateRef = useRef(null);

    const show = useCallback((title, message, type = 'alert', content = null, validateFn = null, testingConfig = null) => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            validateRef.current = validateFn;
            setModalState({
                title,
                message,
                type,
                content,
                testing: testingConfig,
            });
        });
    }, []);

    const cleanup = useCallback(() => {
        setModalState(null);
        resolverRef.current = null;
        validateRef.current = null;
    }, []);

    const handleConfirm = useCallback(() => {
        if (validateRef.current && !validateRef.current()) return;
        const resolve = resolverRef.current;
        cleanup();
        if (resolve) resolve(true);
    }, [cleanup]);

    const handleCancel = useCallback(() => {
        const resolve = resolverRef.current;
        cleanup();
        if (resolve) resolve(false);
    }, [cleanup]);

    const alert = useCallback((t, m) => show(t, m, 'alert'), [show]);
    const confirm = useCallback((t, m) => show(t, m, 'confirm'), [show]);

    return {
        modalState,
        show,
        alert,
        confirm,
        handleConfirm,
        handleCancel,
        // close (X button / Escape) behaves like cancel in the original
        handleClose: handleCancel,
        // Allow callers (e.g. an open edit-modal flow that needs to update
        // testing-bar button state) to patch the current modal's testing config.
        patchTesting: (patch) => {
            setModalState((prev) => prev ? { ...prev, testing: { ...prev.testing, ...patch } } : prev);
        },
    };
}
