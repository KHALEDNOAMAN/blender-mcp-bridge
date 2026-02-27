async function playNext(index, continuous = true) {
    if (!isPlaying || index >= currentSession.commands.length) {
        stopPlayback();
        return;
    }
    const cards = document.querySelectorAll('.command-card');
    const card = cards[index];

    // Expand this card and scroll to it after the transition finishes
    expandCard(card);
    scrollToCard(card);

    const cmd = currentSession.commands[index];
    const res = await runCommand(cmd.tool, cmd.arguments);

    const btn = card.querySelector('.run-cmd');
    if (res.error) {
        cmd.execution_status = 'error';
        card.style.borderColor = 'var(--danger-color)';
        if (btn) {
            btn.textContent = '✗ Error';
            btn.style.color = '#fff';
            btn.style.backgroundColor = 'var(--danger-color)';
            btn.style.borderColor = 'var(--danger-color)';
        }
        if (!(await modal.confirm('Error #' + (index + 1), res.error + '\nContinue?'))) {
            stopPlayback();
            return;
        }
    } else {
        cmd.execution_status = 'success';
        card.style.borderColor = 'var(--success-color)';
        card.classList.add('cmd-executed');
        if (btn) {
            btn.textContent = '✓ Done';
            btn.style.color = '';
            btn.style.backgroundColor = '';
            btn.style.borderColor = '';
        }
        if (!continuous) {
            stopPlayback();
            return;
        }
    }
    playbackTimeout = setTimeout(() => playNext(index + 1, continuous), parseInt(playbackDelay.value) || 500);
}

function findExpandedCommandIndex() {
    const activeCard = document.querySelector('.command-card.expanded');
    if (!activeCard) return 0;
    const cards = Array.from(document.querySelectorAll('.command-card'));
    return cards.indexOf(activeCard);
}

function startPlayback(startIndex = null, continuous = true) {
    if (!currentSession || currentSession.commands.length === 0) return;

    if (startIndex === null) {
        startIndex = findExpandedCommandIndex();
        if (startIndex === -1) startIndex = 0;
    }

    if (commandFilter.value) {
        commandFilter.value = '';
        renderCommands(startIndex);
    }

    isPlaying = true;
    playAllBtn.disabled = true;
    playBtn.disabled = true;
    stopBtn.disabled = false;
    playNext(startIndex, continuous);
}

function stopPlayback() {
    isPlaying = false;
    clearTimeout(playbackTimeout);
    stopBtn.disabled = true;
    updatePlaybackButtonsState();
}

function updatePlaybackButtonsState() {
    if (isPlaying) return;
    const anyExecuted = !!document.querySelector('.command-card.cmd-executed');
    playAllBtn.disabled = anyExecuted;

    const expandedCard = document.querySelector('.command-card.expanded');
    if (expandedCard) {
        playBtn.disabled = expandedCard.classList.contains('cmd-executed');
    } else {
        playBtn.disabled = false;
    }
}

playAllBtn.addEventListener('click', () => startPlayback(0, true));
playBtn.addEventListener('click', () => startPlayback(null, true));
stopBtn.addEventListener('click', stopPlayback);

function resetExecutionState() {
    if (currentSession) {
        currentSession.commands.forEach(cmd => delete cmd.execution_status);
    }
    document.querySelectorAll('.command-card').forEach(card => {
        card.classList.remove('cmd-executed');
        card.style.borderColor = '';
        const btn = card.querySelector('.run-cmd');
        btn.disabled = false;
        btn.textContent = '▶ Run';
        btn.style.color = '';
        btn.style.backgroundColor = '';
        btn.style.borderColor = '';
    });
    updatePlaybackButtonsState();
}

resetStateBtn.addEventListener('click', resetExecutionState);
