//session_editor/app.js

addCommandBtn.addEventListener('click', async () => {
    if (availableTools.length === 0) { await fetchTools(); }
    const content = document.getElementById('newCommandTemplate').content.cloneNode(true);
    const catSelect = content.querySelector('#categorySelect');
    const toolSelect = content.querySelector('#toolSelect');
    const toolArgsForm = content.querySelector('#toolArgsForm');

    Object.keys(TOOL_CATEGORIES).forEach(cat => {
        const o = document.createElement('option'); o.value = cat; o.textContent = cat; catSelect.appendChild(o);
    });
    const categorizedTools = Object.values(TOOL_CATEGORIES).flat();
    if (availableTools.some(at => !categorizedTools.includes(at.name) && !HIDDEN_TOOLS.includes(at.name))) {
        const o = document.createElement('option'); o.value = 'Uncategorized'; o.textContent = 'Uncategorized'; catSelect.appendChild(o);
    }

    addToolTestingListeners(content, catSelect, toolSelect, toolArgsForm);

    const validate = () => {
        if (!toolSelect.value) { modal.alert('Required', 'Please select a tool.'); return false; }
        const inputs = toolArgsForm.querySelectorAll('[required]');
        for (const input of inputs) {
            if (!input.value.trim()) { input.style.borderColor = 'var(--danger-color)'; input.focus(); return false; }
            input.style.borderColor = '';
        }
        return true;
    };

    if (await modal.show('New Command', 'Configure parameters:', 'action', content, validate)) {
        const toolName = toolSelect.value;
        const args = {};
        toolArgsForm.querySelectorAll('[name]').forEach(i => {
            let v = i.value; if (v === '') return;
            const type = i.dataset.type;
            if (type === 'number' || type === 'integer') v = parseFloat(v);
            if (type === 'boolean') v = (v === 'true');
            if (type === 'json') { try { v = JSON.parse(v); } catch (e) { return; } }
            const parts = i.name.split('.');
            let target = args;
            for (let j = 0; j < parts.length - 1; j++) { if (!target[parts[j]]) target[parts[j]] = {}; target = target[parts[j]]; }
            target[parts[parts.length - 1]] = v;
        });
        if (!currentSession) {
            currentSession = { metadata: { name: 'New Session', model: '', description: '' }, commands: [] };
            renderSession();
        }
        const newCmd = { tool: toolName, arguments: args, description: '' };
        const expIdx = Array.from(document.querySelectorAll('.command-card')).findIndex(c => c.classList.contains('expanded'));
        let newIdx;
        if (expIdx !== -1) {
            newIdx = expIdx + 1;
            currentSession.commands.splice(newIdx, 0, newCmd);
        } else {
            currentSession.commands.push(newCmd);
            newIdx = currentSession.commands.length - 1;
        }
        saveBtn.disabled = playAllBtn.disabled = playBtn.disabled = false;
        renderCommands(newIdx);
    }
});

themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-theme'); body.classList.toggle('light-theme');
    localStorage.setItem('theme', body.classList.contains('dark-theme') ? 'dark-theme' : 'light-theme');
    themeToggle.textContent = body.classList.contains('dark-theme') ? '☀️ Light' : '🌙 Dark';
});

// Collapsible metadata panel
const metadataSection = document.getElementById('metadataSection');
const metadataToggle = document.getElementById('metadataToggle');
if (localStorage.getItem('metadataCollapsed') !== 'false') {
    metadataSection.classList.add('collapsed');
}
metadataToggle.addEventListener('click', () => {
    metadataSection.classList.toggle('collapsed');
    localStorage.setItem('metadataCollapsed', metadataSection.classList.contains('collapsed'));
});

// Collapsible commands panel
const commandsSection = document.getElementById('commandsSection');
const commandsToggle = document.getElementById('commandsToggle');
if (localStorage.getItem('commandsCollapsed') === 'true') {
    commandsSection.classList.add('collapsed');
}
commandsToggle.addEventListener('click', () => {
    commandsSection.classList.toggle('collapsed');
    localStorage.setItem('commandsCollapsed', commandsSection.classList.contains('collapsed'));
});

// Collapsible playback section
const playbackSection = document.getElementById('playbackSection');
const playbackToggle = document.getElementById('playbackToggle');
if (localStorage.getItem('playbackCollapsed') === 'true') {
    playbackSection.classList.add('collapsed');
}
playbackToggle.addEventListener('click', () => {
    playbackSection.classList.toggle('collapsed');
    localStorage.setItem('playbackCollapsed', playbackSection.classList.contains('collapsed'));
});

newSessionBtn.addEventListener('click', async () => {
    if (currentSession && currentSession.commands && currentSession.commands.length > 0) {
        const discard = await modal.confirm('Discard Current Session?', 'Starting a new session will discard your unsaved changes. Proceed?');
        if (!discard) return;
    }

    const customContent = document.createElement('div');
    customContent.className = 'new-session-dialog';
    customContent.innerHTML = `
        <div class="form-group" style="margin-top: 1rem;">
            <label for="templateSelect">Choose a Template</label>
            <select id="templateSelect" class="form-select" style="width: 100%; padding: 0.8rem; background: var(--input-bg); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary); margin-top: 0.5rem;">
                <option value="blank">Blank Session (Start from Scratch)</option>
                <option value="3d_print">3D Printing Template (Sets units to mm, scale to 0.001)</option>
                <option value="stl_edit">STL Edit Template (Set units & Import STL)</option>
            </select>
        </div>
    `;

    if (await modal.show('New Session', 'Create a new Blender MCP session:', 'confirm', customContent)) {
        const template = customContent.querySelector('#templateSelect').value;

        if (template === 'blank') {
            currentSession = {
                metadata: {
                    name: 'New Blank Session',
                    model: '',
                    description: 'A new session started from scratch.'
                },
                commands: []
            };
        } else if (template === '3d_print') {
            currentSession = {
                metadata: {
                    name: '3D Printing Session',
                    model: '',
                    description: '3D printing workflow in millimeters.'
                },
                commands: [
                    {
                        tool: 'set_scene_units',
                        arguments: {
                            system: 'METRIC',
                            length_unit: 'MILLIMETERS',
                            scale: 0.001
                        },
                        description: 'Configure scene units to millimeters and set unit scale to 0.001 (divide by 1000).'
                    }
                ]
            };
        } else if (template === 'stl_edit') {
            currentSession = {
                metadata: {
                    name: 'STL Edit Session',
                    model: '',
                    description: 'Import STL and prepare for editing.'
                },
                commands: [
                    {
                        tool: 'set_scene_units',
                        arguments: {
                            system: 'METRIC',
                            length_unit: 'MILLIMETERS',
                            scale: 0.001
                        },
                        description: 'Configure scene units to millimeters and set unit scale to 0.001 (divide by 1000).'
                    },
                    {
                        tool: 'import_model',
                        arguments: {
                            filepath: 'assets/3DBenchy.stl'
                        },
                        description: 'Import the base STL model to modify.'
                    }
                ]
            };
        }

        renderSession();
        resetExecutionState();
        saveBtn.disabled = playAllBtn.disabled = playBtn.disabled = false;
    }
});

loadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            currentSession = JSON.parse(ev.target.result);
            if (currentSession.commands) {
                currentSession.commands.forEach(cmd => {
                    delete cmd.execution_status;
                });
            }
            renderSession();
            resetExecutionState();
            saveBtn.disabled = playAllBtn.disabled = playBtn.disabled = false;
        } catch (err) {
            modal.alert('Error', 'Invalid JSON');
        }
    };
    reader.readAsText(file);
});

commandFilter.addEventListener('input', renderCommands);

sessionName.addEventListener('input', (e) => {
    if (currentSession && currentSession.metadata) currentSession.metadata.name = e.target.value;
});
sessionModel.addEventListener('input', (e) => {
    if (currentSession && currentSession.metadata) currentSession.metadata.model = e.target.value;
});
sessionDescription.addEventListener('input', (e) => {
    if (currentSession && currentSession.metadata) currentSession.metadata.description = e.target.value;
});
saveBtn.addEventListener('click', () => {
    if (!currentSession) return;
    const blob = new Blob([JSON.stringify(currentSession, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'session_edited.json'; a.click();
});

undoBtn.addEventListener('click', async () => {
    const res = await runCommand('undo', {});
    if (res.error) modal.alert('Undo Failed', res.error);
});

redoBtn.addEventListener('click', async () => {
    const res = await runCommand('redo', {});
    if (res.error) modal.alert('Redo Failed', res.error);
});

clearSceneBtn.addEventListener('click', async () => {
    if (!(await modal.confirm('Clear Scene', 'Delete ALL objects?'))) return;
    const res = await runCommand('delete_object', { pattern: '*' });
    if (res.error) modal.alert('Error', res.error);
    else resetExecutionState();
});

document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isPlaying) {
        e.preventDefault();
        playBtn.click();
    }
    if (e.key === ' ' && !isPlaying) {
        e.preventDefault();
        playAllBtn.click();
    }
    if (e.key === 'Escape' && isPlaying) stopPlayback();

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoBtn.click();
        else undoBtn.click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redoBtn.click();
    }
    if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        resetStateBtn.click();
    }
    if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        const activeCard = document.querySelector('.command-card.expanded');
        if (activeCard) {
            const btn = activeCard.querySelector('.run-cmd');
            if (btn && !btn.disabled) btn.click();
        }
    }
});
