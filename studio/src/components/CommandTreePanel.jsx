// studio/src/components/CommandTreePanel.jsx

import { useEffect, useRef, useState } from 'react';
import ActionBar from './ActionBar';

/**
 * Command timeline — a visual DAG of session STRUCTURE, not geometry. See
 * docs/studio_design_v1.md §7, §7.3 (moved to a full-width dock at the
 * bottom of the window, resizable, instead of a sidebar card). Deliberately
 * NOT a 3D preview: a fake geometry proxy (primitive shapes standing in for
 * booleans/text/materials Studio can't evaluate) would risk being actively
 * misleading — this diagram only renders data Studio already has (command
 * list order + branch ranges), so it's honest by construction.
 *
 * Layout: one numbered tick per command on a horizontal spine, with a
 * colored bracket per branch below it spanning that branch's ranges (gaps
 * where it skips commands). Hand-rolled SVG, not a graph library — the
 * shape here is a simple linear spine + range overlays, not an arbitrary
 * node/edge graph.
 *
 * `activeIndex` (the currently expanded command, driven by the command list
 * OR a click on the tree itself) is highlighted with a larger, differently
 * colored tick and auto-scrolled into view — the tree is two-way now, not
 * just click-to-jump one direction.
 *
 * §7.5: three stacked regions, not two — a click-to-collapse title row
 * (`collapsed` only affects the diagram below), a permanent `ActionBar` row
 * (playback transport + branch run, always rendered regardless of
 * `collapsed`), then the collapsible SVG diagram itself. Splitting the
 * ActionBar out of the clickable title row (an earlier version embedded it
 * there) was required, not just tidier — nesting interactive controls
 * inside an `onClick`-to-toggle wrapper meant every button/select click also
 * toggled collapse state unless every single control stopped propagation.
 *
 * §7.6: individual command ranges can be collapsed into one condensed
 * marker (Excel-style column grouping), triggered by clicking a branch's
 * range bar OR the condensed marker itself to re-expand. This is a purely
 * visual, local, non-persisted `collapsedRanges` state — collapsing is
 * global to the diagram (spine + every branch row all share the same tick
 * x-positions, so a range collapses for everyone at once, not per-row) —
 * see the design doc for why a per-row-only collapse isn't representable
 * with a shared spine.
 */

const TICK_SPACING = 32;
const TICK_RADIUS = 5;
const SPINE_Y = 24;
const BRANCH_ROW_HEIGHT = 22;
const BRANCH_ROW_START = 44;
const LEFT_PADDING = 20;
const LABEL_COLUMN_WIDTH = 130;
const COLLAPSED_SEGMENT_WIDTH = 56;

const BRANCH_COLORS = ['#58a6ff', '#3fb950', '#d29922', '#f778ba', '#a371f7', '#79c0ff'];

// Merge a set of possibly-overlapping/adjacent [start,end] ranges into the
// minimal set of disjoint ranges — clicking two branch bars that touch or
// overlap should collapse as one contiguous block, not leave a 1-command
// sliver of normal ticks wedged between two collapsed markers.
function mergeRanges(ranges) {
    const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [start, end] of sorted) {
        const last = merged[merged.length - 1];
        if (last && start <= last[1] + 1) {
            last[1] = Math.max(last[1], end);
        } else {
            merged.push([start, end]);
        }
    }
    return merged;
}

// Walk 0..commandCount-1 and produce the ordered list of segments actually
// drawn on the spine: either a single command tick, or one condensed marker
// standing in for a whole collapsed range. Segments (not raw command
// indices) are what get x-positions now.
function buildSegments(commandCount, collapsedRanges) {
    const segments = [];
    let idx = 0;
    while (idx < commandCount) {
        const range = collapsedRanges.find(([s, e]) => s === idx && e >= s);
        if (range) {
            segments.push({ type: 'collapsed', start: range[0], end: range[1] });
            idx = range[1] + 1;
        } else {
            segments.push({ type: 'single', idx });
            idx += 1;
        }
    }
    return segments;
}

export default function CommandTreePanel({
    commands, branches, collapsed, onToggle, onJumpToCommand, activeIndex,
    dockHeight, isResizeDragging, onResizePointerDown,
    actionBarProps,
}) {
    const commandCount = (commands || []).length;
    const branchEntries = Object.entries(branches || {});
    const scrollRef = useRef(null);

    // §7.6: collapsed command ranges, e.g. [[0,2]] collapses #1-#3 into one
    // marker. Purely a view preference, not part of the session — resets on
    // reload/new-session load. Ranges pointing past a shrunk commandCount
    // (e.g. after deleting commands) are simply skipped by buildSegments,
    // no explicit cleanup needed.
    const [collapsedRanges, setCollapsedRanges] = useState([]);

    const toggleRangeCollapsed = (start, end) => {
        if (start === end) return; // nothing to condense for a single command
        setCollapsedRanges((prev) => {
            const already = prev.some(([s, e]) => s === start && e === end);
            if (already) return prev.filter(([s, e]) => !(s === start && e === end));
            return mergeRanges([...prev, [start, end]]);
        });
    };

    // A branch range that's been merged into a larger collapsed marker (e.g.
    // three branches' adjacent ranges collapsed one at a time, ending up as
    // one #1-#10 marker) no longer has its OWN [start,end] present in
    // collapsedRanges — only the merged superset does. Without this lookup,
    // clicking that branch's bar called toggleRangeCollapsed with its
    // original sub-range, which is a silent no-op once absorbed (not equal
    // to, and already a subset of, the merged entry) — the bug reported:
    // clicking a bar after several collapses stacked together did nothing,
    // with no way back to the expanded ticks except realizing you had to
    // click the spine marker itself instead.
    const enclosingCollapsedRange = (start, end) => (
        collapsedRanges.find(([s, e]) => s <= start && end <= e)
    );

    const segments = buildSegments(commandCount, collapsedRanges);
    // idx -> segment-array-position, so branch ranges (defined in raw
    // command indices) and activeIndex can be located on the segment-based
    // spine. Indices swallowed by a collapsed range all map to that same
    // marker's segment position.
    const segmentPosForIdx = new Array(commandCount);
    segments.forEach((seg, segIdx) => {
        if (seg.type === 'single') {
            segmentPosForIdx[seg.idx] = segIdx;
        } else {
            for (let i = seg.start; i <= seg.end; i++) segmentPosForIdx[i] = segIdx;
        }
    });

    const segmentWidth = (seg) => (seg.type === 'collapsed' ? COLLAPSED_SEGMENT_WIDTH : TICK_SPACING);
    // Cumulative x for the CENTER of each segment, respecting each
    // segment's own width (collapsed markers are wider than a single tick).
    const segmentCenterX = [];
    {
        let x = LABEL_COLUMN_WIDTH + LEFT_PADDING;
        segments.forEach((seg) => {
            segmentCenterX.push(x);
            x += segmentWidth(seg);
        });
    }

    const xForIndex = (idx) => segmentCenterX[segmentPosForIdx[idx]];
    const xForSegment = (segIdx) => segmentCenterX[segIdx];

    // For a branch range's *start*/*end* endpoints specifically: a single
    // command tick's center is fine (matches the old behavior exactly), but
    // when the endpoint lands inside a collapsed marker the bar must reach
    // that marker's outer edge, not its center — otherwise a branch range
    // that collapsed onto itself (or fully overlaps a collapsed range)
    // degenerates into a zero/near-zero-width sliver instead of spanning
    // the whole marker.
    const xStartForIndex = (idx) => {
        const segIdx = segmentPosForIdx[idx];
        const seg = segments[segIdx];
        if (seg.type === 'collapsed') return xForSegment(segIdx) - COLLAPSED_SEGMENT_WIDTH / 2 + 4;
        return xForSegment(segIdx);
    };
    const xEndForIndex = (idx) => {
        const segIdx = segmentPosForIdx[idx];
        const seg = segments[segIdx];
        if (seg.type === 'collapsed') return xForSegment(segIdx) + COLLAPSED_SEGMENT_WIDTH / 2 - 4;
        return xForSegment(segIdx);
    };

    const spineWidth = segments.length > 0
        ? (segmentCenterX[segments.length - 1] - (LABEL_COLUMN_WIDTH + LEFT_PADDING)) + LEFT_PADDING
        : 0;
    const width = LABEL_COLUMN_WIDTH + LEFT_PADDING + spineWidth;
    const height = BRANCH_ROW_START + Math.max(1, branchEntries.length) * BRANCH_ROW_HEIGHT + 10;

    // Auto-scroll the active tick into view when it changes (e.g. the user
    // expanded a command in the list, not by clicking the tree itself).
    useEffect(() => {
        if (activeIndex === null || activeIndex === undefined || collapsed) return;
        const container = scrollRef.current;
        if (!container) return;
        const targetX = xForIndex(activeIndex);
        if (targetX === undefined) return;
        const visibleLeft = container.scrollLeft;
        const visibleRight = visibleLeft + container.clientWidth;
        if (targetX < visibleLeft + LABEL_COLUMN_WIDTH || targetX > visibleRight) {
            container.scrollTo({ left: Math.max(0, targetX - container.clientWidth / 2), behavior: 'smooth' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex, collapsed, collapsedRanges]);

    return (
        <section
            id="commandTreeSection"
            className={`card glass command-timeline-dock metadata-collapsible${collapsed ? ' collapsed' : ''}`}
            style={collapsed ? undefined : { height: dockHeight }}
        >
            {!collapsed && (
                <div
                    className={`sidebar-resize-handle vertical${isResizeDragging ? ' dragging' : ''}`}
                    onPointerDown={onResizePointerDown}
                    title="Drag to resize"
                />
            )}
            <div className="metadata-header command-timeline-titlebar" onClick={onToggle} title="Toggle command timeline">
                <h2>Command Timeline</h2>
                <span className="metadata-chevron">▼</span>
            </div>
            <ActionBar {...actionBarProps} />
            <div className="metadata-body">
                {commandCount === 0 ? (
                    <p style={{ opacity: 0.6, fontSize: '0.85em' }}>No commands loaded.</p>
                ) : (
                    <div className="command-tree-scroll" ref={scrollRef}>
                        <svg width={width} height={height} className="command-tree-svg">
                            {/* Spine */}
                            <line
                                x1={xForSegment(0)} y1={SPINE_Y}
                                x2={xForSegment(segments.length - 1)} y2={SPINE_Y}
                                stroke="var(--glass-border)" strokeWidth={2}
                            />
                            {segments.map((seg, segIdx) => {
                                const x = xForSegment(segIdx);
                                if (seg.type === 'collapsed') {
                                    const label = `#${seg.start + 1}–#${seg.end + 1}`;
                                    // §7.7: a collapsed marker hides its individual ticks,
                                    // so it needs its own summary of what's inside — border
                                    // reflects the range's execution state (all succeeded /
                                    // any errored / not yet run) so collapsing a fully-run
                                    // range doesn't erase that signal.
                                    const rangeStatuses = commands.slice(seg.start, seg.end + 1).map((c) => c.execution_status);
                                    const anyError = rangeStatuses.includes('error');
                                    const allSuccess = rangeStatuses.every((s) => s === 'success');
                                    const borderColor = anyError ? 'var(--danger-color)'
                                        : allSuccess ? 'var(--success-color)'
                                        : 'var(--glass-border)';
                                    return (
                                        <g
                                            key={`c-${seg.start}-${seg.end}`}
                                            className="command-tree-collapsed-marker"
                                            onClick={() => toggleRangeCollapsed(seg.start, seg.end)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <title>{`Collapsed ${label} — click to expand`}</title>
                                            <rect
                                                x={x - COLLAPSED_SEGMENT_WIDTH / 2 + 4}
                                                y={SPINE_Y - 8}
                                                width={COLLAPSED_SEGMENT_WIDTH - 8}
                                                height={16}
                                                rx={8}
                                                fill="var(--input-bg)"
                                                stroke={borderColor}
                                                strokeWidth={1}
                                            />
                                            <text
                                                x={x} y={SPINE_Y + 3}
                                                textAnchor="middle" fontSize="8" fill="var(--text-secondary)"
                                            >
                                                {label}
                                            </text>
                                        </g>
                                    );
                                }
                                const idx = seg.idx;
                                const cmd = commands[idx];
                                const isActive = idx === activeIndex;
                                // §7.7: execution status (green=success/red=error) is
                                // independent of "active" (the ring/halo showing which
                                // card is currently expanded for review) — previously
                                // these were conflated into one isActive-driven color,
                                // so reviewing an earlier command (e.g. #24) after
                                // playback had moved on to #33 made #24's tick look
                                // identical to every other not-yet-run tick, with no
                                // trace that #1-33 had actually executed.
                                const status = cmd.execution_status;
                                const tickColor = status === 'success' ? 'var(--success-color)'
                                    : status === 'error' ? 'var(--danger-color)'
                                    : 'var(--accent-color)';
                                return (
                                <g
                                    key={idx}
                                    className={`command-tree-tick${isActive ? ' active' : ''}${status ? ` ${status}` : ''}`}
                                    onClick={() => onJumpToCommand(idx)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {/* Invisible larger hit-area — a 5px circle is too small a
                                        click target on its own, and SVG <g> wrappers with no fill
                                        don't reliably register as clickable hit-test targets. */}
                                    <rect
                                        x={x - TICK_SPACING / 2}
                                        y={0}
                                        width={TICK_SPACING}
                                        height={SPINE_Y + 10}
                                        fill="transparent"
                                    />
                                    {isActive && (
                                        <circle cx={x} cy={SPINE_Y} r={TICK_RADIUS + 4} fill="none" stroke="var(--accent-color)" strokeWidth={2} />
                                    )}
                                    <circle cx={x} cy={SPINE_Y} r={TICK_RADIUS} fill={tickColor} />
                                    <text
                                        x={x} y={SPINE_Y - 12}
                                        textAnchor="middle" fontSize="9" fill="var(--text-secondary)"
                                    >
                                        #{idx + 1}
                                    </text>
                                    <title>{`#${idx + 1} ${cmd.tool}${status ? ` (${status})` : ''}`}</title>
                                </g>
                                );
                            })}

                            {/* Branch range brackets — click a bar to collapse/expand its
                                range (§7.6). Bar endpoints are clamped to the segment
                                x-positions so a range that partially overlaps an
                                already-collapsed marker still draws sensibly. */}
                            {branchEntries.map(([name, branch], rowIdx) => {
                                const color = BRANCH_COLORS[rowIdx % BRANCH_COLORS.length];
                                const rowY = BRANCH_ROW_START + rowIdx * BRANCH_ROW_HEIGHT;
                                return (
                                    <g key={name}>
                                        <text x={4} y={rowY + 4} fontSize="9" fill={color}>
                                            {name.length > 20 ? name.slice(0, 19) + '…' : name}
                                            <title>{name}</title>
                                        </text>
                                        {(branch.ranges || []).map(([start, end], rangeIdx) => {
                                            const x1 = xStartForIndex(start);
                                            const x2 = xEndForIndex(end);
                                            const enclosing = enclosingCollapsedRange(start, end);
                                            const isCollapsed = !!enclosing;
                                            // Clicking always toggles whatever range is ACTUALLY
                                            // collapsed right now (the merged superset, if this
                                            // bar's own range has been absorbed into one) — not
                                            // this bar's original [start,end], which may no
                                            // longer have any direct entry in collapsedRanges.
                                            const [toggleStart, toggleEnd] = enclosing || [start, end];
                                            const label = enclosing
                                                ? `#${enclosing[0] + 1}–#${enclosing[1] + 1}`
                                                : `#${start + 1}–#${end + 1}`;
                                            return (
                                                <rect
                                                    key={rangeIdx}
                                                    className={`command-tree-branch-bar${start === end ? '' : ' collapsible'}`}
                                                    x={x1 - TICK_RADIUS}
                                                    y={rowY - 5}
                                                    width={x2 - x1 + TICK_RADIUS * 2}
                                                    height={10}
                                                    rx={5}
                                                    fill={color}
                                                    fillOpacity={isCollapsed ? 0.6 : 0.35}
                                                    stroke={color}
                                                    strokeWidth={1}
                                                    onClick={() => toggleRangeCollapsed(toggleStart, toggleEnd)}
                                                >
                                                    <title>{start === end ? '' : `${isCollapsed ? 'Expand' : 'Collapse'} ${label}`}</title>
                                                </rect>
                                            );
                                        })}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                )}
            </div>
        </section>
    );
}
