// studio/src/App.jsx

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import './style.css';
import Header from './components/Header';
import MetadataPanel from './components/MetadataPanel';
import ParametersPanel from './components/ParametersPanel';
import ViewsPanel from './components/ViewsPanel';
import BranchesPanel from './components/BranchesPanel';
import BranchBuilder from './components/BranchBuilder';
import CommandTreePanel from './components/CommandTreePanel';
import CommandList from './components/CommandList';
import Modal from './components/Modal';
import DynamicArgsForm from './components/DynamicArgsForm';
import NewSessionDialog from './components/NewSessionDialog';
import AssistantPanel from './components/AssistantPanel';

// Code-split the two heaviest dependencies out of the entry bundle. Both are
// behind a toggle (STL viewer / JSON view), so a user who never opens them
// never downloads them:
//   ModelViewer       -> three (~25MB on disk, the bulk of the bundle)
//   JsonSessionEditor -> codemirror + @codemirror/* (~2.8MB on disk)
const ModelViewer = lazy(() => import('./components/ModelViewer'));
const JsonSessionEditor = lazy(() => import('./components/JsonSessionEditor'));
import { useModal } from './hooks/useModal';
import { usePersistentToggle } from './hooks/usePersistentToggle';
import { useResizableSidebar } from './hooks/useResizableSidebar';
import { useConnection } from './hooks/useConnection';
import { runCommand } from './lib/api';
import { simulateCommand } from './lib/demoApi';
import { buildSessionFromTemplate } from './lib/sessionTemplates';
import { resolveArgsObject } from './lib/params';
import { validateBranches, validateSessionShape } from './lib/sessionValidation';
import { expandForEachLoops } from './lib/forEach';

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
    // min/default must fit title bar + ActionBar + the SVG diagram (~98px with
    // 2 branch rows) — the old 100/160 values crushed the diagram to just its
    // scrollbar on any browser with fresh localStorage, which looked like a
    // rendering bug. The hook clamps stored values on load, so stale
    // too-small heights persisted in existing browsers self-heal to >= min.
    const timeline = useResizableSidebar({ storageKey: 'timelineHeight', axis: 'vertical', invert: true, minWidth: 220, maxWidth: 520, defaultWidth: 300 });

    const [session, setSession] = useState(null);
    const [filter, setFilter] = useState('');
    const [expandedIdx, setExpandedIdx] = useState(null);
    const [runningIdx, setRunningIdx] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark-theme');
    // Collapsible panels: localStorage-backed booleans. Note metadata defaults
    // to COLLAPSED (true) while the rest default to expanded.
    const [metadataCollapsed, toggleMetadata] = usePersistentToggle('metadataCollapsed', true);
    const [parametersCollapsed, toggleParameters] = usePersistentToggle('parametersCollapsed');
    const [mainTab, setMainTabState] = useState(() => localStorage.getItem('mainTab') || 'commands');
    const setMainTab = (t) => { localStorage.setItem('mainTab', t); setMainTabState(t); };
    const [branchesCollapsed, toggleBranches] = usePersistentToggle('branchesCollapsed');
    const [commandTreeCollapsed, toggleCommandTree] = usePersistentToggle('commandTreeCollapsed');
    const [runningBranch, setRunningBranch] = useState(null);
    const [selectedBranch, setSelectedBranch] = useState(null);
    // Reactive mirror of fileHandleRef.current?.name — the ref alone can't
    // drive a re-render, so the Save button label/title (in-place vs.
    // download) needs this alongside it.
    const [openFileName, setOpenFileName] = useState(null);
    const [viewMode, setViewMode] = useState('guided'); // 'guided' | 'json' — §6
    const jsonModeParamsSnapshotRef = useRef(null); // §6.7: restored on Discard
    const [commandsCollapsed, toggleCommands] = usePersistentToggle('commandsCollapsed');
    const [playbackDelay, setPlaybackDelay] = useState(500);
    // §10: community sample sessions, fetched once from the manifest
    // scripts/sync-community-sessions.mjs generates at
    // public/community/index.json (build-time copy of community/*/session.json).
    const [communitySessions, setCommunitySessions] = useState([]);
    // AI Assistant drawer — chat panel driving Blender via /assistant/* on the bridge.
    const [assistantOpen, toggleAssistant] = usePersistentToggle('assistantOpen');

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
    // File System Access API handle for the currently-open file (Chromium
    // only — see handleLoadClick/handleSave). null whenever the session came
    // from the classic <input type="file"> picker, a community sample, or
    // "New Session" — Save then falls back to a download, same as before.
    const fileHandleRef = useRef(null);
    // Best-effort filename to seed the download fallback (community samples,
    // or File System Access-unsupported browsers) — cosmetic only.
    const loadedFileNameRef = useRef(null);
    // Monotonic across every load for the lifetime of the page. Argument-textarea
    // remount keys must never repeat between sessions: a freshly loaded file has
    // no _argsRevision, so a per-command `(cmd._argsRevision || 0) + 1` always
    // yields 1 and a same-index card from the previous session gets reused,
    // leaving its uncontrolled textarea showing the OLD session's arguments.
    const argsRevisionSeqRef = useRef(0);
    const supportsFileSystemAccess = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

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

    const dispatchTool = useCallback((tool, args, extraParams = {}) => {
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

    // dispatchCommand takes a full command object (not just tool/args) so it
    // can see cmd.body — needed for the for_each case below. A for_each
    // command isn't a real MCP tool; it expands into its body's commands
    // (see lib/forEach.js) and runs every iteration sequentially, folding
    // the outcome into ONE result for the card that dispatched it — the
    // command list shows one card/one status per loop, not one row per
    // expanded iteration (unlike the CLI's session player, which prints
    // every expanded command — Studio's UI model is index/card-based, so a
    // loop expanding to hundreds of rows would break scrubbing/resume).
    const dispatchCommand = useCallback(async (cmd, extraParams = {}) => {
        if (cmd.tool !== 'for_each') {
            return dispatchTool(cmd.tool, cmd.arguments, extraParams);
        }
        const params = { ...(sessionRef.current?.parameters || {}), ...extraParams };
        let expandedBody;
        try {
            expandedBody = expandForEachLoops([cmd], params);
        } catch (err) {
            return { error: `for_each: ${err.message}` };
        }
        for (const bodyCmd of expandedBody) {
            const res = await dispatchCommand(bodyCmd, extraParams);
            if (res.error) return res;
        }
        return { ok: true, iterationCount: expandedBody.length };
    }, [dispatchTool]);

    // --- Single-card run -----------------------------------------------------------

    const runSingle = useCallback(async (idx) => {
        const cmd = sessionRef.current.commands[idx];
        setRunningIdx(idx);
        const res = await dispatchCommand(cmd);
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
            const res = await dispatchCommand(cmd);
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
            const res = await dispatchCommand(cmd);
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
        // Parameters can be edited two ways while in JSON mode: live via the
        // docked ParametersPanel (§6.6, takes effect immediately, independent
        // of Apply), or directly in the JSON text's own "parameters" key
        // (only takes effect on Apply, like every other field). Both must
        // actually stick — previously this always discarded a text edit in
        // favor of whatever was already in memory, so typing a new
        // "parameters" block by hand and clicking Apply silently reverted it.
        // The parsed text's "parameters" key wins if present (it's what the
        // user explicitly asked to apply); otherwise fall back to whatever
        // the live panel already has, so panel-only edits still work.
        jsonModeParamsSnapshotRef.current = null;
        setSession({
            ...parsedSession,
            parameters: parsedSession.parameters ?? sessionRef.current?.parameters ?? {},
        });
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
        fileHandleRef.current = null; // not tied to any file on disk
        loadedFileNameRef.current = null;
        setOpenFileName(null);
        setSession(newSession);
        setExpandedIdx(0);
        setFilter('');
        setViewMode('guided');
    };

    // On Chromium browsers, showOpenFilePicker() returns a live
    // FileSystemFileHandle we keep for Save (createWritable() overwrites the
    // exact file in place — a real editor round-trip, not download-a-copy).
    // Elsewhere (Firefox/Safari, no File System Access API support) this
    // falls back to the classic hidden <input type="file"> + FileReader.
    const handleLoadClick = async () => {
        if (supportsFileSystemAccess) {
            let handle;
            try {
                [handle] = await window.showOpenFilePicker({
                    types: [{ description: 'Session JSON', accept: { 'application/json': ['.json'] } }],
                });
            } catch (err) {
                if (err && err.name === 'AbortError') return; // user cancelled the picker
                modalApi.alert('Load Failed', `Could not open file picker: ${err.message}`);
                return;
            }
            try {
                const file = await handle.getFile();
                const text = await file.text();
                loadSessionObject(JSON.parse(text), file.name, handle);
            } catch (err) {
                modalApi.alert('Error', 'Invalid JSON');
            }
            return;
        }
        fileInputRef.current && fileInputRef.current.click();
    };

    // Shared by file-picker loads (handleFileSelected/handleLoadClick),
    // community-sample loads (handleLoadCommunitySession), and "New Session"
    // — same reset/normalize steps either way, just a different source for
    // the raw parsed object. `sourceName` seeds the download filename Save
    // falls back to when there's no live handle; `handle` is the
    // FileSystemFileHandle Save writes back to in place (Chromium file-picker
    // loads only — every other source always clears it, so Save never writes
    // to a stale handle from a previously-open file).
    const loadSessionObject = (loaded, sourceName = null, handle = null) => {
        if (loaded.commands) {
            // One fresh revision shared by every command in this load. Taken from
            // a page-lifetime counter rather than each command's own value, which
            // is absent in a just-parsed file and would restart at 1 every load.
            const revision = ++argsRevisionSeqRef.current;
            loaded.commands.forEach((cmd) => {
                delete cmd.execution_status;
                // Force each CommandCard's Arguments textarea (an uncontrolled
                // input keyed on _argsRevision) to remount with this session's
                // actual data, instead of showing whatever a same-index card
                // had mounted with from a previously loaded/edited session.
                cmd._argsRevision = revision;
            });
        }
        jsonModeParamsSnapshotRef.current = null;
        loadedFileNameRef.current = sourceName;
        fileHandleRef.current = handle;
        setOpenFileName(handle ? handle.name : null);
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
                loadSessionObject(JSON.parse(ev.target.result), file.name); // no handle: classic picker can't write back
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
            loadSessionObject(loaded, `${entry.id}.json`); // no handle: fetched sample, not a local file
        } catch (err) {
            modalApi.alert('Load Failed', `Could not load community sample: ${err.message}`);
        }
    };

    const handleSave = async () => {
        if (!session) return;
        const json = JSON.stringify(session, null, 2);

        if (fileHandleRef.current) {
            try {
                // Re-request write permission if the browser dropped it (e.g.
                // after a long idle period) — queryPermission/requestPermission
                // are part of the File System Access API on the handle itself.
                if ((await fileHandleRef.current.queryPermission({ mode: 'readwrite' })) !== 'granted') {
                    const granted = await fileHandleRef.current.requestPermission({ mode: 'readwrite' });
                    if (granted !== 'granted') throw new Error('Write permission denied');
                }
                const writable = await fileHandleRef.current.createWritable();
                await writable.write(json);
                await writable.close();
                modalApi.alert('Saved', `Saved in place to "${fileHandleRef.current.name}".`);
                return;
            } catch (err) {
                modalApi.alert(
                    'Save Failed',
                    `Could not write to "${fileHandleRef.current.name}": ${err.message}. Falling back to download.`
                );
                // fall through to the download path below
            }
        }

        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = loadedFileNameRef.current || 'session_edited.json';
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
            // Spread `cmd` rather than rebuilding {tool, arguments}: a
            // for_each carries its template command list on `cmd.body`,
            // which is not part of `arguments` and would otherwise be lost
            // here — dispatching a loop with no body to run.
            const res = await dispatchCommand(
                { ...cmd, arguments: formApiRef.current.getArgs() },
                formApiRef.current.pendingParams
            );
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
                cmds[idx] = {
                    ...cmds[idx],
                    arguments: newArgs,
                    // Same page-lifetime counter the load path uses, so an edit
                    // here can never collide with a revision handed out by a load.
                    _argsRevision: ++argsRevisionSeqRef.current,
                };
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

    // Collapsible panel toggles now come from usePersistentToggle above.

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
                saveInPlace={!!openFileName}
                openFileName={openFileName}
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
                    <Suspense fallback={<div className="lazy-loading">Loading editor…</div>}>
                        <JsonSessionEditor
                            session={session}
                            onApply={handleApplyJson}
                            onDiscard={handleDiscardJson}
                            theme={theme}
                            parameters={(session && session.parameters) || {}}
                            parameterUi={(session && session.parameter_ui) || {}}
                            onParametersChange={handleParametersChange}
                            sidebarWidth={jsonSidebar.width}
                            isSidebarDragging={jsonSidebar.isDragging}
                            onSidebarPointerDown={jsonSidebar.handlePointerDown}
                        />
                    </Suspense>
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
                            parameterUi={(session && session.parameter_ui) || {}}
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
                        {/* Commands / Views are TABS in the main pane. Views
                            started life as a sidebar card, but a 130px
                            thumbnail is too small to inspect a render — out
                            here they get the full width. */}
                        <div className="commands-header">
                            <div className="commands-header-left main-tabs">
                                <button
                                    type="button"
                                    className={`main-tab${mainTab === 'commands' ? ' active' : ''}`}
                                    onClick={() => setMainTab('commands')}
                                >
                                    Commands <span className="badge">{filteredCount}</span>
                                </button>
                                <button
                                    type="button"
                                    className={`main-tab${mainTab === 'views' ? ' active' : ''}`}
                                    onClick={() => setMainTab('views')}
                                >
                                    Views
                                </button>
                                <button
                                    type="button"
                                    className={`main-tab${mainTab === 'model' ? ' active' : ''}`}
                                    onClick={() => setMainTab('model')}
                                >
                                    3D
                                </button>
                            </div>
                            <span
                                className="commands-chevron"
                                onClick={toggleCommands}
                                title="Toggle panel"
                            >▼</span>
                        </div>
                        <div className="commands-body">
                            {mainTab === 'commands' ? (
                                <>
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
                                </>
                            ) : mainTab === 'views' ? (
                                <ViewsPanel
                                    apiBase={apiBase}
                                    embedded
                                    sessionName={session?.metadata?.name}
                                />
                            ) : (
                                <Suspense
                                    fallback={<div className="lazy-loading">Loading viewer…</div>}
                                >
                                    <ModelViewer apiBase={apiBase} session={session} />
                                </Suspense>
                            )}
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
                <p>Blender MCP Bridge</p>
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
