import { useCallback, useEffect, useRef, useState } from 'react';
import './style.css';
import Header from './components/Header';
import MetadataPanel from './components/MetadataPanel';
import ParametersPanel from './components/ParametersPanel';
import BranchesPanel from './components/BranchesPanel';
import BranchBuilder from './components/BranchBuilder';
import CommandTreePanel from './components/CommandTreePanel';
import CommandList from './components/CommandList';
import Modal from './components/Modal';
import DynamicArgsForm from './components/DynamicArgsForm';
import NewSessionDialog from './components/NewSessionDialog';
import JsonSessionEditor from './components/JsonSessionEditor';
import AssistantPanel from './components/AssistantPanel';
import { useModal } from './hooks/useModal';
import { useResizableSidebar } from './hooks/useResizableSidebar';
import { useConnection } from './hooks/useConnection';
import { runCommand } from './lib/api';
import { simulateCommand } from './lib/demoApi';
import { buildSessionFromTemplate } from './lib/sessionTemplates';
import { resolveArgsObject } from './lib/params';
import { validateBranches, validateSessionShape } from './lib/sessionValidation';

export default function App() {
    const {
        apiBase, connectionStatus, availableTools, refetchTools,
        demoMode, enterDemoMode, exitDemoMode,
    } = useConnection();
    // §9: single choke point every dispatch goes through — swaps in the
    // demo-mode simulator instead of a real network call when demoMode is
    // on, so callers (dispatchCommand, Undo/Redo, Clear Scene, branch wipe)
    // don't each need their own demoMode check.
    const demoModeRef = useRef(demoMode);
    demoModeRef.current = demoMode;
    const run = useCallback((base, tool, args) => (
        demoModeRef.current ? simulateCommand(tool, args) : runCommand(base, tool, args)
    ), []);
    const modalApi = useModal();
    const sidebar = useResizableSidebar();
    const jsonSidebar = useResizableSidebar({ storageKey: 'jsonSidebarWidth', minWidth: 200, maxWidth: 480, defaultWidth: 260 });
    // §7.3: bottom Command Timeline dock — vertical axis, inverted (dragging
    // the handle up should grow the dock, which is the opposite sign of a
    // raw clientY delta since the dock is anchored to the bottom).
    const timeline = useResizableSidebar({ storageKey: 'timelineHeight', axis: 'vertical', invert: true, minWidth: 100, maxWidth: 400, defaultWidth: 160 });

    const [session, setSession] = useState(null);
    const [filter, setFilter] = useState('');
    const [expandedIdx, setExpandedIdx] = useState(null);
    const [runningIdx, setRunningIdx] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark-theme');
    const [metadataCollapsed, setMetadataCollapsed] = useState(() => localStorage.getItem('metadataCollapsed') !== 'false');
    const [parametersCollapsed, setParametersCollapsed] = useState(() => localStorage.getItem('parametersCollapsed') === 'true');
    const [branchesCollapsed, setBranchesCollapsed] = useState(() => localStorage.getItem('branchesCollapsed') === 'true');
    const [commandTreeCollapsed, setCommandTreeCollapsed] = useState(() => localStorage.getItem('commandTreeCollapsed') === 'true');
    const [runningBranch, setRunningBranch] = useState(null);
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [viewMode, setViewMode] = useState('guided'); // 'guided' | 'json' — §6
    const jsonModeParamsSnapshotRef = useRef(null); // §6.7: restored on Discard
    const [commandsCollapsed, setCommandsCollapsed] = useState(() => localStorage.getItem('commandsCollapsed') === 'true');
    const [playbackDelay, setPlaybackDelay] = useState(500);
    // §10: community sample sessions, fetched once from the manifest
    // scripts/sync-community-sessions.mjs generates at
    // public/community/index.json (build-time copy of community/*/session.json).
    const [communitySessions, setCommunitySessions] = useState([]);
    // AI Assistant drawer — chat panel driving Blender via /assistant/* on the bridge.
    const [assistantOpen, setAssistantOpen] = useState(() => localStorage.getItem('assistantOpen') === 'true');
    const toggleAssistant = () => setAssistantOpen((prev) => {
        const next = !prev;
        localStorage.setItem('assistantOpen', next);
        return next;
    });

    const sessionRef = useRef(session);
    sessionRef.current = session;
    const isPlayingRef = useRef(isPlaying);
    isPlayingRef.current = isPlaying;
    const expandedIdxRef = useRef(expandedIdx);
    expandedIdxRef.current = expandedIdx;
    const playbackDelayRef = useRef(playbackDelay);
    playbackDelayRef.current = playbackDelay;
    const stopRequestedRef = useRef(false);
    const fileInputRef = useRef(null);

    // Theme: apply to <body>, matching original body.classList toggling.
    useEffect(() => {
        document.body.classList.remove('dark-theme', 'light-theme');
        document.body.classList.add(theme);
    }, [theme]);

    // §10: fetch the community sample manifest once on mount — same-origin,
    // no bridge dependency, so this works connected, in demo mode, or on a
    // static host with no backend at all.
    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}community/index.json`)
            .then((res) => (res.ok ? res.json() : []))
            .then(setCommunitySessions)
            .catch(() => setCommunitySessions([]));
    }, []);

    const hasCommands = !!(session && session.commands && session.commands.length > 0);
    const hasBranches = !!(session && session.branches && Object.keys(session.branches).length > 0);
    const anyExecuted = hasCommands && session.commands.some((c) => c.execution_status === 'success');
    const activeCard = expandedIdx !== null && session && session.commands ? session.commands[expandedIdx] : null;
    const activeExecuted = activeCard && activeCard.execution_status === 'success';
    // Play resumes from (active, or active+1 if active already succeeded) —
    // disabled only once there's genuinely nothing left in that range, i.e.
    // the active command is the last one AND it already succeeded.
    const playResumeIndex = (expandedIdx ?? 0) + (activeExecuted ? 1 : 0);
    const nothingLeftToPlay = hasCommands && playResumeIndex >= session.commands.length;

    // Keep the ActionBar's branch dropdown pointed at a valid branch — reset
    // to the first one whenever branches change and the current selection
    // no longer exists (deleted, or a new session loaded).
    useEffect(() => {
        const names = session && session.branches ? Object.keys(session.branches) : [];
        if (names.length === 0) {
            if (selectedBranch !== null) setSelectedBranch(null);
        } else if (!names.includes(selectedBranch)) {
            setSelectedBranch(names[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session && session.branches]);

    // --- Command mutation helpers -------------------------------------------------

    const updateCommands = useCallback((updater) => {
        setSession((prev) => {
            if (!prev) return prev;
            const commands = updater([...prev.commands]);
            return { ...prev, commands };
        });
    }, []);

    const handleDescriptionChange = useCallback((idx, value) => {
        updateCommands((cmds) => {
            cmds[idx] = { ...cmds[idx], description: value };
            return cmds;
        });
    }, [updateCommands]);

    const handleArgumentsChange = useCallback((idx, parsed, raw, invalid) => {
        if (invalid) return; // mirror original: keep prior arguments on parse error, just flag color
        updateCommands((cmds) => {
            cmds[idx] = { ...cmds[idx], arguments: parsed };
            return cmds;
        });
    }, [updateCommands]);

    const markStatus = useCallback((idx, status) => {
        updateCommands((cmds) => {
            cmds[idx] = { ...cmds[idx], execution_status: status };
            return cmds;
        });
    }, [updateCommands]);

    // --- Parameter resolution (§4.3: substitute ${name} tokens, then dispatch) ----

    const dispatchCommand = useCallback((tool, args, extraParams = {}) => {
        const params = { ...(sessionRef.current?.parameters || {}), ...extraParams };
        const { resolved, unresolved, errors } = resolveArgsObject(args, params);
        if (unresolved.size > 0) {
            return Promise.resolve({
                error: `Undefined parameter${unresolved.size > 1 ? 's' : ''}: ${[...unresolved].map((n) => '${' + n + '}').join(', ')}. Add ${unresolved.size > 1 ? 'them' : 'it'} in the Parameters panel first.`,
            });
        }
        if (errors.length > 0) {
            return Promise.resolve({ error: `Invalid expression: ${errors.join('; ')}` });
        }
        return run(apiBase, tool, resolved);
    }, [apiBase, run]);

    // --- Single-card run -----------------------------------------------------------

    const runSingle = useCallback(async (idx) => {
        const cmd = sessionRef.current.commands[idx];
        setRunningIdx(idx);
        const res = await dispatchCommand(cmd.tool, cmd.arguments);
        setRunningIdx(null);
        if (res.error) {
            markStatus(idx, 'error');
            await modalApi.alert('Execution Error', res.error);
        } else {
            markStatus(idx, 'success');
            const nextIdx = idx + 1;
            if (sessionRef.current.commands[nextIdx]) {
                setExpandedIdx(nextIdx);
            } else {
                setExpandedIdx(idx);
            }
        }
        return res;
    }, [dispatchCommand, markStatus, modalApi]);

    // --- Playback: playNext / playNextToActive, ported from playback.js -----------

    const stopPlayback = useCallback(() => {
        stopRequestedRef.current = true;
        setIsPlaying(false);
    }, []);

    const playFrom = useCallback(async (startIndex, endIndex /* null = play to end */) => {
        if (!sessionRef.current || sessionRef.current.commands.length === 0) return;
        if (filter) setFilter('');
        stopRequestedRef.current = false;
        setIsPlaying(true);

        let index = startIndex;
        while (true) {
            if (stopRequestedRef.current) break;
            const commands = sessionRef.current.commands;
            if (index >= commands.length) break;
            if (endIndex !== null && index > endIndex) break;

            setExpandedIdx(index);
            setRunningIdx(index);
            const cmd = commands[index];
            const res = await dispatchCommand(cmd.tool, cmd.arguments);
            setRunningIdx(null);

            if (res.error) {
                markStatus(index, 'error');
                if (endIndex !== null) {
                    // playNextToActive: stop immediately on error, no confirm prompt
                    break;
                }
                const cont = await modalApi.confirm('Error #' + (index + 1), res.error + '\nContinue?');
                if (!cont) break;
            } else {
                markStatus(index, 'success');
            }

            if (index === endIndex) break;
            if (stopRequestedRef.current) break;

            await new Promise((resolve) => setTimeout(resolve, parseInt(playbackDelayRef.current, 10) || 500));
            index += 1;
        }

        stopRequestedRef.current = false;
        setIsPlaying(false);
    }, [dispatchCommand, filter, markStatus, modalApi]);

    const handlePlayAll = () => playFrom(0, null);
    // "Play" resumes from the active command through the end. If the active
    // command already succeeded (e.g. user ran "Play to Active" and stopped
    // there, or clicked back to review an earlier already-run command),
    // start from the NEXT command instead of re-running it — this is what
    // makes Play double as "continue from where I stopped," not just
    // "replay from whatever's expanded."
    const handlePlay = () => {
        const active = expandedIdxRef.current ?? 0;
        const activeCmd = sessionRef.current?.commands?.[active];
        const startIndex = activeCmd?.execution_status === 'success' ? active + 1 : active;
        playFrom(startIndex, null);
    };
    const handlePlayToActive = () => {
        const active = expandedIdxRef.current;
        if (active === null || active === undefined) return;
        playFrom(0, active);
    };
    const handleStop = () => stopPlayback();

    const resetExecutionState = useCallback(() => {
        updateCommands((cmds) => cmds.map((c) => {
            const { execution_status, ...rest } = c;
            return rest;
        }));
    }, [updateCommands]);

    // --- Branch run: auto-wipe + replay a list of [start,end] ranges --------------
    // §5.3: deterministic — always clears the scene first, then replays every
    // range in order via the same dispatchCommand path (params resolved) that
    // playFrom uses, just driven by a flat index list expanded from ranges
    // instead of one contiguous [start, endIndex] span.

    const runBranch = useCallback(async (branchName) => {
        const branch = sessionRef.current?.branches?.[branchName];
        if (!branch || !branch.ranges || branch.ranges.length === 0) return;

        // §6.3: validate this branch's ranges are in-bounds before dispatching
        // anything — closes the gap where nothing previously guarded a
        // branch's ranges at run time (BranchBuilder only produces valid
        // ranges by construction, which isn't a real guard against a
        // hand-edited or future-bugged range).
        const branchErrors = validateBranches({ commands: sessionRef.current.commands, branches: { [branchName]: branch } });
        if (branchErrors.length > 0) {
            await modalApi.alert('Invalid Branch', branchErrors.join('\n'));
            return;
        }

        const indices = [];
        branch.ranges.forEach(([start, end]) => {
            for (let i = start; i <= end; i++) indices.push(i);
        });

        if (filter) setFilter('');
        stopRequestedRef.current = false;
        setIsPlaying(true);
        setRunningBranch(branchName);

        // Auto-wipe: clear the scene before replaying, matching how most
        // session templates already start with their own delete_object call.
        const wipeRes = await run(apiBase, 'delete_object', { pattern: '*' });
        if (wipeRes.error) {
            await modalApi.alert('Branch Run Failed', `Could not clear the scene: ${wipeRes.error}`);
            setIsPlaying(false);
            setRunningBranch(null);
            return;
        }
        resetExecutionState();

        for (const index of indices) {
            if (stopRequestedRef.current) break;
            const commands = sessionRef.current.commands;
            if (index >= commands.length) continue;

            setExpandedIdx(index);
            setRunningIdx(index);
            const cmd = commands[index];
            const res = await dispatchCommand(cmd.tool, cmd.arguments);
            setRunningIdx(null);

            if (res.error) {
                markStatus(index, 'error');
                const cont = await modalApi.confirm('Error #' + (index + 1), res.error + '\nContinue?');
                if (!cont) break;
            } else {
                markStatus(index, 'success');
            }

            if (stopRequestedRef.current) break;
            await new Promise((resolve) => setTimeout(resolve, parseInt(playbackDelayRef.current, 10) || 500));
        }

        stopRequestedRef.current = false;
        setIsPlaying(false);
        setRunningBranch(null);
    }, [apiBase, dispatchCommand, filter, markStatus, modalApi, resetExecutionState, run]);

    // --- Header actions --------------------------------------------------------

    const handleThemeToggle = () => {
        const next = theme === 'dark-theme' ? 'light-theme' : 'dark-theme';
        setTheme(next);
        localStorage.setItem('theme', next);
    };

    // --- Guided / JSON view toggle, §6 ---------------------------------------

    const handleToggleViewMode = async () => {
        if (viewMode === 'json') {
            const discard = await modalApi.confirm('Discard JSON Changes?', 'Switching to Guided view without applying will discard unsaved JSON edits, including any parameter edits made in JSON mode. Proceed?');
            if (!discard) return;
            // §6.7: restore the parameter snapshot taken on entry — parameter
            // edits in JSON mode are immediate/live (§6.6), not staged like
            // the JSON text itself, so leaving without Apply must undo them too.
            if (jsonModeParamsSnapshotRef.current !== null) {
                setSession((prev) => (prev ? { ...prev, parameters: jsonModeParamsSnapshotRef.current } : prev));
            }
        } else {
            jsonModeParamsSnapshotRef.current = sessionRef.current?.parameters || {};
        }
        setViewMode((m) => (m === 'guided' ? 'json' : 'guided'));
    };

    const handleApplyJson = (parsedSession) => {
        // The docked ParametersPanel (§6.6) is the single authoritative
        // source for `parameters` — it edits session.parameters live and
        // immediately, never the pending textarea text. The parsed
        // textarea's OWN "parameters" key is stale the moment you edit the
        // panel (that's the whole point of it being live), so committing it
        // wholesale here would silently revert any panel edit made since
        // JSON mode was opened. Apply takes commands/metadata/branches from
        // the parsed text as usual, but always keeps the live parameters.
        jsonModeParamsSnapshotRef.current = null;
        setSession({ ...parsedSession, parameters: sessionRef.current?.parameters || {} });
        setExpandedIdx(null);
        setFilter('');
        setViewMode('guided');
    };

    const handleDiscardJson = () => {
        if (jsonModeParamsSnapshotRef.current !== null) {
            setSession((prev) => (prev ? { ...prev, parameters: jsonModeParamsSnapshotRef.current } : prev));
        }
        setViewMode('guided');
    };

    const handleNewSession = async () => {
        if (hasCommands) {
            const discard = await modalApi.confirm('Discard Current Session?', 'Starting a new session will discard your unsaved changes. Proceed?');
            if (!discard) return;
        }
        const templateRef = { current: 'blank' };
        const proceed = await modalApi.show(
            'New Session',
            'Create a new Blender MCP session:',
            'confirm',
            <NewSessionDialog innerRef={templateRef} />
        );
        if (!proceed) return;
        const newSession = buildSessionFromTemplate(templateRef.current);
        jsonModeParamsSnapshotRef.current = null;
        setSession(newSession);
        setExpandedIdx(0);
        setFilter('');
        setViewMode('guided');
    };

    const handleLoadClick = () => fileInputRef.current && fileInputRef.current.click();

    // Shared by file-picker loads (handleFileSelected) and community-sample
    // loads (handleLoadCommunitySession) — same reset/normalize steps either
    // way, just a different source for the raw parsed object.
    const loadSessionObject = (loaded) => {
        if (loaded.commands) {
            loaded.commands.forEach((cmd) => { delete cmd.execution_status; });
        }
        jsonModeParamsSnapshotRef.current = null;
        setSession(loaded);
        setExpandedIdx(0);
        setFilter('');
        setViewMode('guided');
    };

    const handleFileSelected = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                loadSessionObject(JSON.parse(ev.target.result));
            } catch (err) {
                modalApi.alert('Error', 'Invalid JSON');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // §10: community sample sessions are bundled into Studio's own build at
    // public/community/ (scripts/sync-community-sessions.mjs copies them
    // from ../community/*/session.json at build time) — fetched relative to
    // Studio's own origin, not the bridge, so this works identically
    // connected, in demo mode, or standalone on GitHub Pages.
    const handleLoadCommunitySession = async (id) => {
        if (!id) return;
        const entry = communitySessions.find((e) => e.id === id);
        if (!entry) return;
        if (hasCommands) {
            const discard = await modalApi.confirm('Discard Current Session?', 'Loading a community sample will discard your unsaved changes. Proceed?');
            if (!discard) return;
        }
        try {
            const sessionRes = await fetch(`${import.meta.env.BASE_URL}community/${entry.file}`);
            if (!sessionRes.ok) throw new Error(`HTTP ${sessionRes.status}`);
            const loaded = await sessionRes.json();
            loadSessionObject(loaded);
        } catch (err) {
            modalApi.alert('Load Failed', `Could not load community sample: ${err.message}`);
        }
    };

    const handleSave = () => {
        if (!session) return;
        const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'session_edited.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleMetadataChange = (field, value) => {
        setSession((prev) => {
            if (!prev) return prev;
            return { ...prev, metadata: { ...prev.metadata, [field]: value } };
        });
    };

    const handleParametersChange = (nextParameters) => {
        setSession((prev) => {
            const base = prev || { metadata: { name: 'New Session', model: '', description: '' }, commands: [] };
            return { ...base, parameters: nextParameters };
        });
    };

    // --- New Command modal -------------------------------------------------------

    const handleAddCommand = async () => {
        let tools = availableTools;
        if (tools.length === 0) {
            tools = (await refetchTools()) || [];
        }
        const formApiRef = { current: null };
        const currentParams = sessionRef.current?.parameters || {};
        const proceed = await modalApi.show(
            'New Command',
            'Configure parameters:',
            'action',
            <DynamicArgsForm
                availableTools={tools}
                parameters={currentParams}
                onReady={(api) => { formApiRef.current = api; }}
            />,
            () => {
                if (!formApiRef.current) return false;
                if (!formApiRef.current.tool) {
                    modalApi.alert('Required', 'Please select a tool.');
                    return false;
                }
                return formApiRef.current.validate();
            }
        );
        if (!proceed || !formApiRef.current) return;
        const toolName = formApiRef.current.tool;
        const args = formApiRef.current.getArgs();
        const pendingParams = formApiRef.current.pendingParams || {};

        setSession((prev) => {
            const base = prev || { metadata: { name: 'New Session', model: '', description: '' }, commands: [] };
            const newCmd = { tool: toolName, arguments: args, description: '' };
            const commands = [...base.commands];
            let newIdx;
            const expIdx = expandedIdxRef.current;
            if (expIdx !== null && expIdx !== undefined && commands[expIdx]) {
                newIdx = expIdx + 1;
                commands.splice(newIdx, 0, newCmd);
            } else {
                commands.push(newCmd);
                newIdx = commands.length - 1;
            }
            setTimeout(() => setExpandedIdx(newIdx), 0);
            return { ...base, commands, parameters: { ...(base.parameters || {}), ...pendingParams } };
        });
    };

    // --- Edit Command modal --------------------------------------------------------

    const handleEditCommand = async (cmd, idx) => {
        const formApiRef = { current: null };
        const currentParams = sessionRef.current?.parameters || {};

        const doRun = async () => {
            if (!formApiRef.current || !formApiRef.current.validate()) return;
            modalApi.patchTesting({ running: true });
            const res = await dispatchCommand(cmd.tool, formApiRef.current.getArgs(), formApiRef.current.pendingParams);
            modalApi.patchTesting({ running: false });
            if (res.error) modalApi.alert('Failed', res.error);
        };
        const doUndo = () => run(apiBase, 'undo', {});
        const doRedo = () => run(apiBase, 'redo', {});

        const proceed = await modalApi.show(
            'Edit Command',
            `Editing ${cmd.tool}:`,
            'action',
            <DynamicArgsForm
                availableTools={availableTools}
                initialTool={cmd.tool}
                initialArgs={cmd.arguments}
                lockToolSelection
                parameters={currentParams}
                onReady={(api) => { formApiRef.current = api; }}
            />,
            () => (formApiRef.current ? formApiRef.current.validate() : false),
            {
                showTesting: true,
                confirmText: 'Apply Changes',
                onRun: doRun,
                onUndo: doUndo,
                onRedo: doRedo,
                running: false,
            }
        );

        if (proceed && formApiRef.current) {
            const newArgs = formApiRef.current.getArgs();
            const pendingParams = formApiRef.current.pendingParams || {};
            setSession((prev) => {
                if (!prev) return prev;
                return { ...prev, parameters: { ...(prev.parameters || {}), ...pendingParams } };
            });
            updateCommands((cmds) => {
                cmds[idx] = { ...cmds[idx], arguments: newArgs };
                return cmds;
            });
        }
    };

    // --- Delete / move ---------------------------------------------------------

    const handleDelete = async (cmd, idx) => {
        const displayName = cmd.arguments && cmd.arguments.name ? `${cmd.tool} (${cmd.arguments.name})` : cmd.tool;
        const ok = await modalApi.confirm('Delete Command', `Are you sure you want to delete ${displayName}?`);
        if (!ok) return;
        updateCommands((cmds) => {
            cmds.splice(idx, 1);
            return cmds;
        });
        setExpandedIdx(null);
    };

    const handleMoveUp = (idx) => {
        if (idx <= 0) return;
        updateCommands((cmds) => {
            [cmds[idx], cmds[idx - 1]] = [cmds[idx - 1], cmds[idx]];
            return cmds;
        });
        setExpandedIdx(idx - 1);
    };

    const handleMoveDown = (idx) => {
        if (!sessionRef.current || idx >= sessionRef.current.commands.length - 1) return;
        updateCommands((cmds) => {
            [cmds[idx], cmds[idx + 1]] = [cmds[idx + 1], cmds[idx]];
            return cmds;
        });
        setExpandedIdx(idx + 1);
    };

    // --- Undo/redo/clear-scene ---------------------------------------------------

    const handleUndo = async () => {
        const res = await run(apiBase, 'undo', {});
        if (res.error) modalApi.alert('Undo Failed', res.error);
    };
    const handleRedo = async () => {
        const res = await run(apiBase, 'redo', {});
        if (res.error) modalApi.alert('Redo Failed', res.error);
    };
    const handleClearScene = async () => {
        const ok = await modalApi.confirm('Clear Scene', 'Delete ALL objects?');
        if (!ok) return;
        const res = await run(apiBase, 'delete_object', { pattern: '*' });
        if (res.error) modalApi.alert('Error', res.error);
        else resetExecutionState();
    };

    // --- Branches: new/delete, per §5.2 ---------------------------------------

    const handleAddBranch = async () => {
        if (!hasCommands) {
            modalApi.alert('No Commands', 'Load or create a session with commands first.');
            return;
        }
        const builderApiRef = { current: null };
        const proceed = await modalApi.show(
            'New Branch',
            'Click commands to mark range start/end:',
            'action',
            <BranchBuilder
                commands={sessionRef.current.commands}
                onReady={(api) => { builderApiRef.current = api; }}
            />,
            () => {
                if (!builderApiRef.current) return false;
                if (!builderApiRef.current.validate()) {
                    modalApi.alert('Required', 'Give the branch a name and at least one range.');
                    return false;
                }
                return true;
            }
        );
        if (!proceed || !builderApiRef.current) return;
        const { name, ranges } = builderApiRef.current;
        setSession((prev) => {
            if (!prev) return prev;
            return { ...prev, branches: { ...(prev.branches || {}), [name]: { ranges } } };
        });
    };

    const handleDeleteBranch = async (name) => {
        const ok = await modalApi.confirm('Delete Branch', `Delete branch "${name}"?`);
        if (!ok) return;
        setSession((prev) => {
            if (!prev) return prev;
            const next = { ...(prev.branches || {}) };
            delete next[name];
            return { ...prev, branches: next };
        });
    };

    // --- Keyboard shortcuts, ported from app.js ------------------------------------

    useEffect(() => {
        const handler = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

            const sessionHasBranches = !!(sessionRef.current && sessionRef.current.branches && Object.keys(sessionRef.current.branches).length > 0);

            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isPlayingRef.current && !sessionHasBranches) {
                e.preventDefault();
                handlePlay();
            }
            if (e.key === ' ' && !isPlayingRef.current && !sessionHasBranches) {
                e.preventDefault();
                handlePlayAll();
            }
            if (e.key === 'Escape' && isPlayingRef.current) stopPlayback();

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) handleRedo(); else handleUndo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleRedo();
            }
            if (e.altKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                resetExecutionState();
            }
            if (e.altKey && e.key === 'Enter') {
                e.preventDefault();
                const idx = expandedIdxRef.current;
                if (idx !== null && idx !== undefined && sessionRef.current && sessionRef.current.commands[idx]) {
                    const executed = sessionRef.current.commands[idx].execution_status === 'success';
                    if (!executed) runSingle(idx);
                }
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiBase]);

    // --- Collapsible panel toggles -------------------------------------------------

    const toggleMetadata = () => setMetadataCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('metadataCollapsed', next);
        return next;
    });
    const toggleCommands = () => setCommandsCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('commandsCollapsed', next);
        return next;
    });
    const toggleParameters = () => setParametersCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('parametersCollapsed', next);
        return next;
    });
    const toggleBranches = () => setBranchesCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('branchesCollapsed', next);
        return next;
    });
    const toggleCommandTree = () => setCommandTreeCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('commandTreeCollapsed', next);
        return next;
    });

    // Click-to-jump from the tree diagram (§7.2) reuses the same expand
    // interaction as the command list itself.
    const handleJumpToCommand = (idx) => setExpandedIdx(idx);

    const filteredCount = hasCommands
        ? session.commands.filter((c) => c.tool.toLowerCase().includes(filter.toLowerCase())).length
        : 0;

    return (
        <div className="app-container">
            <Header
                connectionStatus={connectionStatus}
                theme={theme}
                onThemeToggle={handleThemeToggle}
                onNewSession={handleNewSession}
                onLoadClick={handleLoadClick}
                onFileSelected={handleFileSelected}
                onAddCommand={handleAddCommand}
                onSave={handleSave}
                saveDisabled={!hasCommands}
                fileInputRef={fileInputRef}
                viewMode={viewMode}
                onToggleViewMode={handleToggleViewMode}
                viewModeToggleDisabled={!session}
                demoMode={demoMode}
                onToggleDemoMode={demoMode ? exitDemoMode : enterDemoMode}
                communitySessions={communitySessions}
                onLoadCommunitySession={handleLoadCommunitySession}
                assistantOpen={assistantOpen}
                onToggleAssistant={toggleAssistant}
            />

            {viewMode === 'json' ? (
                <main>
                    <JsonSessionEditor
                        session={session}
                        onApply={handleApplyJson}
                        onDiscard={handleDiscardJson}
                        theme={theme}
                        parameters={(session && session.parameters) || {}}
                        onParametersChange={handleParametersChange}
                        sidebarWidth={jsonSidebar.width}
                        isSidebarDragging={jsonSidebar.isDragging}
                        onSidebarPointerDown={jsonSidebar.handlePointerDown}
                    />
                </main>
            ) : (
            <div className="guided-body">
                <main>
                    <div className="left-sidebar" style={{ flexBasis: sidebar.width }}>
                        <MetadataPanel
                            session={session}
                            collapsed={metadataCollapsed}
                            onToggle={toggleMetadata}
                            onChange={handleMetadataChange}
                        />
                        <ParametersPanel
                            parameters={(session && session.parameters) || {}}
                            collapsed={parametersCollapsed}
                            onToggle={toggleParameters}
                            onChange={handleParametersChange}
                        />
                        <BranchesPanel
                            branches={(session && session.branches) || {}}
                            collapsed={branchesCollapsed}
                            onToggle={toggleBranches}
                            onNewBranch={handleAddBranch}
                            onDeleteBranch={handleDeleteBranch}
                        />
                    </div>

                    <div
                        className={`sidebar-resize-handle${sidebar.isDragging ? ' dragging' : ''}`}
                        onPointerDown={sidebar.handlePointerDown}
                        title="Drag to resize"
                    />

                    <section id="commandsSection" className={`card glass commands-collapsible${commandsCollapsed ? ' collapsed' : ''}`}>
                        <div className="commands-header" onClick={toggleCommands} title="Toggle commands list">
                            <div className="commands-header-left">
                                <h2>Commands <span className="badge">{filteredCount}</span></h2>
                            </div>
                            <span className="commands-chevron">▼</span>
                        </div>
                        <div className="commands-body">
                            <div className="search-bar-container">
                                <input
                                    type="text"
                                    placeholder="Filter tools..."
                                    spellCheck={false}
                                    className="search-bar"
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                />
                            </div>

                            <CommandList
                                commands={hasCommands ? session.commands : []}
                                filter={filter}
                                expandedIdx={expandedIdx}
                                runningIdx={runningIdx}
                                onExpand={setExpandedIdx}
                                onRun={runSingle}
                                onEdit={handleEditCommand}
                                onDelete={handleDelete}
                                onMoveUp={handleMoveUp}
                                onMoveDown={handleMoveDown}
                                onDescriptionChange={handleDescriptionChange}
                                onArgumentsChange={handleArgumentsChange}
                            />
                        </div>
                    </section>
                </main>

                <CommandTreePanel
                    commands={hasCommands ? session.commands : []}
                    branches={(session && session.branches) || {}}
                    collapsed={commandTreeCollapsed}
                    onToggle={toggleCommandTree}
                    onJumpToCommand={handleJumpToCommand}
                    activeIndex={expandedIdx}
                    dockHeight={timeline.width}
                    isResizeDragging={timeline.isDragging}
                    onResizePointerDown={timeline.handlePointerDown}
                    actionBarProps={{
                        isPlaying,
                        playAllDisabled: isPlaying || !hasCommands || anyExecuted || hasBranches,
                        playDisabled: isPlaying || !hasCommands || nothingLeftToPlay || hasBranches,
                        playToActiveDisabled: isPlaying || !hasCommands || expandedIdx === null || !!activeExecuted || hasBranches,
                        stopDisabled: !isPlaying,
                        hasBranches,
                        branches: (session && session.branches) || {},
                        selectedBranch,
                        onSelectedBranchChange: setSelectedBranch,
                        runningBranch,
                        onRunBranch: runBranch,
                        playbackDelay,
                        onDelayChange: setPlaybackDelay,
                        onUndo: handleUndo,
                        onRedo: handleRedo,
                        onPlayAll: handlePlayAll,
                        onPlay: handlePlay,
                        onPlayToActive: handlePlayToActive,
                        onStop: handleStop,
                        onReset: resetExecutionState,
                        onClearScene: handleClearScene,
                    }}
                />
            </div>
            )}

            {assistantOpen && (
                <AssistantPanel
                    apiBase={apiBase}
                    connected={connectionStatus.connected}
                    demoMode={demoMode}
                    onClose={toggleAssistant}
                />
            )}

            <footer>
                <p>Blender MCP &bull; n8n Powered</p>
            </footer>

            <Modal
                state={modalApi.modalState}
                onConfirm={modalApi.handleConfirm}
                onCancel={modalApi.handleCancel}
                onClose={modalApi.handleClose}
            />
        </div>
    );
}
