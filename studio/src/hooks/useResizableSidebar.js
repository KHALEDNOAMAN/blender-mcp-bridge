import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_WIDTH = 260;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 380;
const STORAGE_KEY = 'sidebarWidth';

/**
 * Drag-to-resize the left sidebar (Metadata/Parameters/Branches/Command
 * Tree/Playback column). Width persists to localStorage, same convention as
 * the collapsible-panel state elsewhere in Studio.
 */
export function useResizableSidebar() {
    const [width, setWidth] = useState(() => {
        const stored = parseInt(localStorage.getItem(STORAGE_KEY), 10);
        return Number.isFinite(stored) ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, stored)) : DEFAULT_WIDTH;
    });
    const [isDragging, setIsDragging] = useState(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(width);

    const handlePointerDown = useCallback((e) => {
        startXRef.current = e.clientX;
        startWidthRef.current = width;
        setIsDragging(true);
    }, [width]);

    useEffect(() => {
        if (!isDragging) return;

        const handlePointerMove = (e) => {
            const delta = e.clientX - startXRef.current;
            const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
            setWidth(next);
        };
        const handlePointerUp = () => {
            setIsDragging(false);
            setWidth((current) => {
                localStorage.setItem(STORAGE_KEY, String(current));
                return current;
            });
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
        return () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging]);

    return { width, isDragging, handlePointerDown };
}
