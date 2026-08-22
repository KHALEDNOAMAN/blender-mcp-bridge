// studio/src/components/CommandList.jsx

import { useEffect, useRef } from 'react';
import CommandCard from './CommandCard';

/**
 * Ported from session_editor/commands.js renderCommands() (list/filter
 * portion) + ui.js scrollToCard().
 */
export default function CommandList({
    commands,
    filter,
    expandedIdx,
    runningIdx,
    onExpand,
    onRun,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    onDescriptionChange,
    onArgumentsChange,
}) {
    const listRef = useRef(null);
    const filterLower = filter.toLowerCase();

    // Map filtered index -> original index (commands array is the source of truth).
    const filtered = commands
        .map((cmd, originalIdx) => ({ cmd, originalIdx }))
        .filter(({ cmd }) => cmd.tool.toLowerCase().includes(filterLower));

    // Scroll to the expanded card, same as scrollToCard() (waits for the
    // accordion max-height transition, with a timeout fallback).
    useEffect(() => {
        if (expandedIdx === null || expandedIdx === undefined) return;
        const list = listRef.current;
        if (!list) return;
        const card = list.querySelector(`#cmd-${expandedIdx}`);
        if (!card) return;

        const content = card.querySelector('.accordion-content');
        const doScroll = () => list.scrollTo({ top: card.offsetTop - 8, behavior: 'smooth' });

        let done = false;
        const onDone = (e) => {
            if (e.propertyName !== 'max-height') return;
            done = true;
            content && content.removeEventListener('transitionend', onDone);
            doScroll();
        };
        content && content.addEventListener('transitionend', onDone);
        const t = setTimeout(() => {
            if (done) return;
            content && content.removeEventListener('transitionend', onDone);
            doScroll();
        }, 400);

        return () => {
            clearTimeout(t);
            content && content.removeEventListener('transitionend', onDone);
        };
    }, [expandedIdx]);

    if (!commands || commands.length === 0) {
        return (
            <div id="commandList" className="command-list" ref={listRef}>
                <div className="empty-state">
                    <p>No session loaded. Start by clicking &quot;Load Session&quot;.</p>
                </div>
            </div>
        );
    }

    if (filtered.length === 0) {
        return (
            <div id="commandList" className="command-list" ref={listRef}>
                <div className="empty-state">No matching commands.</div>
            </div>
        );
    }

    return (
        <div id="commandList" className="command-list" ref={listRef}>
            {filtered.map(({ cmd, originalIdx }, displayIdx) => (
                <CommandCard
                    key={originalIdx}
                    cmd={cmd}
                    idx={originalIdx}
                    isExpanded={expandedIdx === originalIdx}
                    isActive={expandedIdx === originalIdx}
                    isRunning={runningIdx === originalIdx}
                    onExpand={onExpand}
                    onRun={onRun}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onDescriptionChange={onDescriptionChange}
                    onArgumentsChange={onArgumentsChange}
                />
            ))}
        </div>
    );
}
