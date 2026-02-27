const modal = {
    overlay: document.getElementById('modalOverlay'),
    title: document.getElementById('modalTitle'),
    message: document.getElementById('modalMessage'),
    content: document.getElementById('modalCustomContent'),
    confirmBtn: document.getElementById('modalConfirm'),
    cancelBtn: document.getElementById('modalCancel'),
    closeBtn: document.getElementById('modalClose'),
    testingBar: document.getElementById('modalTestingBar'),
    undoBtn: document.getElementById('modalUndo'),
    redoBtn: document.getElementById('modalRedo'),
    runBtn: document.getElementById('modalRun'),

    show(titleText, msgText, type = 'alert', customHTML = null, validateFn = null, testingConfig = null) {
        return new Promise((resolve) => {
            this.title.textContent = titleText;
            this.message.textContent = msgText;
            this.content.innerHTML = '';
            if (customHTML) {
                if (typeof customHTML === 'string') this.content.innerHTML = customHTML;
                else this.content.appendChild(customHTML);
            }

            this.confirmBtn.style.display = 'block';
            this.cancelBtn.style.display = type !== 'alert' ? 'block' : 'none';
            this.confirmBtn.textContent = 'OK';
            this.cancelBtn.textContent = 'Cancel';

            if (testingConfig && testingConfig.showTesting) {
                this.testingBar.hidden = false;
                this.confirmBtn.textContent = testingConfig.confirmText || 'Apply';
                const newRun = this.runBtn.cloneNode(true);
                const newUndo = this.undoBtn.cloneNode(true);
                const newRedo = this.redoBtn.cloneNode(true);
                this.runBtn.replaceWith(newRun);
                this.undoBtn.replaceWith(newUndo);
                this.redoBtn.replaceWith(newRedo);
                this.runBtn = newRun; this.undoBtn = newUndo; this.redoBtn = newRedo;

                if (testingConfig.onRun) this.runBtn.addEventListener('click', testingConfig.onRun);
                if (testingConfig.onUndo) this.undoBtn.addEventListener('click', testingConfig.onUndo);
                if (testingConfig.onRedo) this.redoBtn.addEventListener('click', testingConfig.onRedo);
            } else {
                this.testingBar.hidden = true;
            }

            const cleanup = () => {
                this.overlay.hidden = true;
                this.confirmBtn.onclick = this.cancelBtn.onclick = this.closeBtn.onclick = null;
                document.removeEventListener('keydown', handleEsc);
            };
            const handleEsc = (e) => { if (e.key === 'Escape') { cleanup(); resolve(false); } };
            this.confirmBtn.onclick = () => { if (validateFn && !validateFn()) return; cleanup(); resolve(true); };
            this.cancelBtn.onclick = () => { cleanup(); resolve(false); };
            this.closeBtn.onclick = () => { cleanup(); resolve(false); };
            document.addEventListener('keydown', handleEsc);
            this.overlay.hidden = false;
        });
    },
    alert(t, m) { return this.show(t, m, 'alert'); },
    confirm(t, m) { return this.show(t, m, 'confirm'); }
};
