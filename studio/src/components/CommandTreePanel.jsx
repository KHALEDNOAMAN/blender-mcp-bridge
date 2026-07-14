import { useEffect, useRef } from 'react';

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
 */

const TICK_SPACING = 32;
const TICK_RADIUS = 5;
const SPINE_Y = 24;
const BRANCH_ROW_HEIGHT = 22;
const BRANCH_ROW_START = 44;
const LEFT_PADDING = 20;
const LABEL_COLUMN_WIDTH = 130;

const BRANCH_COLORS = ['#58a6ff', '#3fb950', '#d29922', '#f778ba', '#a371f7', '#79c0ff'];

export default function CommandTreePanel({
    commands, branches, collapsed, onToggle, onJumpToCommand, activeIndex,
    dockHeight, isResizeDragging, onResizePointerDown,
}) {
    const commandCount = (commands || []).length;
    const branchEntries = Object.entries(branches || {});
    const scrollRef = useRef(null);

    const spineWidth = LEFT_PADDING * 2 + Math.max(0, commandCount - 1) * TICK_SPACING;
    const width = LABEL_COLUMN_WIDTH + spineWidth;
    const height = BRANCH_ROW_START + Math.max(1, branchEntries.length) * BRANCH_ROW_HEIGHT + 10;

    const xForIndex = (idx) => LABEL_COLUMN_WIDTH + LEFT_PADDING + idx * TICK_SPACING;

    // Auto-scroll the active tick into view when it changes (e.g. the user
    // expanded a command in the list, not by clicking the tree itself).
    useEffect(() => {
        if (activeIndex === null || activeIndex === undefined || collapsed) return;
        const container = scrollRef.current;
        if (!container) return;
        const targetX = xForIndex(activeIndex);
        const visibleLeft = container.scrollLeft;
        const visibleRight = visibleLeft + container.clientWidth;
        if (targetX < visibleLeft + LABEL_COLUMN_WIDTH || targetX > visibleRight) {
            container.scrollTo({ left: Math.max(0, targetX - container.clientWidth / 2), behavior: 'smooth' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex, collapsed]);

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
            <div className="metadata-header" onClick={onToggle} title="Toggle command timeline">
                <h2>Command Timeline</h2>
                <span className="metadata-chevron">▼</span>
            </div>
            <div className="metadata-body">
                {commandCount === 0 ? (
                    <p style={{ opacity: 0.6, fontSize: '0.85em' }}>No commands loaded.</p>
                ) : (
                    <div className="command-tree-scroll" ref={scrollRef}>
                        <svg width={width} height={height} className="command-tree-svg">
                            {/* Spine */}
                            <line
                                x1={xForIndex(0)} y1={SPINE_Y}
                                x2={xForIndex(commandCount - 1)} y2={SPINE_Y}
                                stroke="var(--glass-border)" strokeWidth={2}
                            />
                            {(commands || []).map((cmd, idx) => {
                                const isActive = idx === activeIndex;
                                return (
                                <g
                                    key={idx}
                                    className={`command-tree-tick${isActive ? ' active' : ''}`}
                                    onClick={() => onJumpToCommand(idx)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {/* Invisible larger hit-area — a 5px circle is too small a
                                        click target on its own, and SVG <g> wrappers with no fill
                                        don't reliably register as clickable hit-test targets. */}
                                    <rect
                                        x={xForIndex(idx) - TICK_SPACING / 2}
                                        y={0}
                                        width={TICK_SPACING}
                                        height={SPINE_Y + 10}
                                        fill="transparent"
                                    />
                                    {isActive && (
                                        <circle cx={xForIndex(idx)} cy={SPINE_Y} r={TICK_RADIUS + 4} fill="none" stroke="var(--success-color)" strokeWidth={2} />
                                    )}
                                    <circle
                                        cx={xForIndex(idx)} cy={SPINE_Y} r={TICK_RADIUS}
                                        fill={isActive ? 'var(--success-color)' : 'var(--accent-color)'}
                                    />
                                    <text
                                        x={xForIndex(idx)} y={SPINE_Y - 12}
                                        textAnchor="middle" fontSize="9" fill="var(--text-secondary)"
                                    >
                                        #{idx + 1}
                                    </text>
                                    <title>{`#${idx + 1} ${cmd.tool}`}</title>
                                </g>
                                );
                            })}

                            {/* Branch range brackets */}
                            {branchEntries.map(([name, branch], rowIdx) => {
                                const color = BRANCH_COLORS[rowIdx % BRANCH_COLORS.length];
                                const rowY = BRANCH_ROW_START + rowIdx * BRANCH_ROW_HEIGHT;
                                return (
                                    <g key={name}>
                                        <text x={4} y={rowY + 4} fontSize="9" fill={color}>
                                            {name.length > 20 ? name.slice(0, 19) + '…' : name}
                                            <title>{name}</title>
                                        </text>
                                        {(branch.ranges || []).map(([start, end], rangeIdx) => (
                                            <rect
                                                key={rangeIdx}
                                                x={xForIndex(start) - TICK_RADIUS}
                                                y={rowY - 5}
                                                width={xForIndex(end) - xForIndex(start) + TICK_RADIUS * 2}
                                                height={10}
                                                rx={5}
                                                fill={color}
                                                fillOpacity={0.35}
                                                stroke={color}
                                                strokeWidth={1}
                                            />
                                        ))}
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
