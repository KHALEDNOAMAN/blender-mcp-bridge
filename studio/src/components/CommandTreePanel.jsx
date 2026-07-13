/**
 * Command tree / branch diagram — a visual DAG of session STRUCTURE, not
 * geometry. See docs/studio_design_v1.md §7. Deliberately NOT a 3D preview:
 * a fake geometry proxy (primitive shapes standing in for booleans/text/
 * materials Studio can't evaluate) would risk being actively misleading —
 * this diagram only renders data Studio already has (command list order +
 * branch ranges), so it's honest by construction.
 *
 * Layout: one numbered tick per command on a horizontal spine, with a
 * colored bracket per branch below it spanning that branch's ranges (gaps
 * where it skips commands). Hand-rolled SVG, not a graph library — the
 * shape here is a simple linear spine + range overlays, not an arbitrary
 * node/edge graph.
 */

const TICK_SPACING = 32;
const TICK_RADIUS = 5;
const SPINE_Y = 24;
const BRANCH_ROW_HEIGHT = 22;
const BRANCH_ROW_START = 44;
const LEFT_PADDING = 20;
const LABEL_COLUMN_WIDTH = 130;

const BRANCH_COLORS = ['#58a6ff', '#3fb950', '#d29922', '#f778ba', '#a371f7', '#79c0ff'];

export default function CommandTreePanel({ commands, branches, collapsed, onToggle, onJumpToCommand }) {
    const commandCount = (commands || []).length;
    const branchEntries = Object.entries(branches || {});

    const spineWidth = LEFT_PADDING * 2 + Math.max(0, commandCount - 1) * TICK_SPACING;
    const width = LABEL_COLUMN_WIDTH + spineWidth;
    const height = BRANCH_ROW_START + Math.max(1, branchEntries.length) * BRANCH_ROW_HEIGHT + 10;

    const xForIndex = (idx) => LABEL_COLUMN_WIDTH + LEFT_PADDING + idx * TICK_SPACING;

    return (
        <section id="commandTreeSection" className={`card glass metadata-collapsible${collapsed ? ' collapsed' : ''}`}>
            <div className="metadata-header" onClick={onToggle} title="Toggle command tree">
                <h2>Command Tree</h2>
                <span className="metadata-chevron">▼</span>
            </div>
            <div className="metadata-body">
                {commandCount === 0 ? (
                    <p style={{ opacity: 0.6, fontSize: '0.85em' }}>No commands loaded.</p>
                ) : (
                    <div className="command-tree-scroll">
                        <svg width={width} height={height} className="command-tree-svg">
                            {/* Spine */}
                            <line
                                x1={xForIndex(0)} y1={SPINE_Y}
                                x2={xForIndex(commandCount - 1)} y2={SPINE_Y}
                                stroke="var(--glass-border)" strokeWidth={2}
                            />
                            {(commands || []).map((cmd, idx) => (
                                <g
                                    key={idx}
                                    className="command-tree-tick"
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
                                    <circle cx={xForIndex(idx)} cy={SPINE_Y} r={TICK_RADIUS} fill="var(--accent-color)" />
                                    <text
                                        x={xForIndex(idx)} y={SPINE_Y - 12}
                                        textAnchor="middle" fontSize="9" fill="var(--text-secondary)"
                                    >
                                        #{idx + 1}
                                    </text>
                                    <title>{`#${idx + 1} ${cmd.tool}`}</title>
                                </g>
                            ))}

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
