import { useEffect, useRef } from 'react';
import { updateTextareaHeight } from '../lib/uiUtils';

/**
 * Textarea that grows to fit its content, matching session_editor's
 * `auto-expand` class + initAutoExpand behavior.
 */
export default function AutoExpandTextarea({ className = '', innerRef, onInput, ...props }) {
    const localRef = useRef(null);

    useEffect(() => {
        const ta = (innerRef && innerRef.current) || localRef.current;
        updateTextareaHeight(ta);
    });

    const setRef = (el) => {
        localRef.current = el;
        if (innerRef) innerRef.current = el;
    };

    const handleInput = (e) => {
        updateTextareaHeight(e.target);
        if (onInput) onInput(e);
    };

    return (
        <textarea
            ref={setRef}
            className={`auto-expand ${className}`.trim()}
            spellCheck={false}
            onInput={handleInput}
            {...props}
        />
    );
}
