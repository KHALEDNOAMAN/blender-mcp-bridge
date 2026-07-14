import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drag-to-resize a panel along one axis. Size persists to localStorage under
 * `storageKey`, same convention as the collapsible-panel state elsewhere in
 * Studio. Used for the Guided-view left sidebar (Metadata/Parameters/
 * Branches/Playback), the JSON-mode sidebar (outline + docked Parameters
 * panel, §6.6), and the bottom Command Timeline (§7.3, vertical axis) — each
 * with its own storage key/bounds so resizing one doesn't affect the others.
 *
 * `axis: 'horizontal'` (default) drags along clientX and produces a width;
 * `axis: 'vertical'` drags along clientY and produces a height. The dragged
 * dimension is still returned as `width` either way — callers on the
 * vertical axis just read it as a height, keeping one hook/return shape
 * instead of two near-identical ones.
 */
export function useResizableSidebar({
    storageKey = 'sidebarWidth',
    minWidth = 260,
    maxWidth = 720,
    defaultWidth = 380,
    axis = 'horizontal',
    invert = false,
} = {}) {
    const [width, setWidth] = useState(() => {
        const stored = parseInt(localStorage.getItem(storageKey), 10);
        return Number.isFinite(stored) ? Math.min(maxWidth, Math.max(minWidth, stored)) : defaultWidth;
    });
    const [isDragging, setIsDragging] = useState(false);
    const startPosRef = useRef(0);
    const startWidthRef = useRef(width);

    const handlePointerDown = useCallback((e) => {
        startPosRef.current = axis === 'vertical' ? e.clientY : e.clientX;
        startWidthRef.current = width;
        setIsDragging(true);
    }, [width, axis]);

    useEffect(() => {
        if (!isDragging) return;

        const handlePointerMove = (e) => {
            const pos = axis === 'vertical' ? e.clientY : e.clientX;
            const rawDelta = pos - startPosRef.current;
            const delta = invert ? -rawDelta : rawDelta;
            const next = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta));
            setWidth(next);
        };
        const handlePointerUp = () => {
            setIsDragging(false);
            setWidth((current) => {
                localStorage.setItem(storageKey, String(current));
                return current;
            });
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
        return () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, axis, invert]);

    return { width, isDragging, handlePointerDown };
}
