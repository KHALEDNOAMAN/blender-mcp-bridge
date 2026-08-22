// Copies community/*/session.json into studio/public/community/<folder>.json
// and writes a manifest (studio/public/community/index.json) listing them,
// so the "Load Community Sample" dropdown (App.jsx) can fetch a static list
// without a directory listing — which static hosts (GitHub Pages) can't do,
// and which the bridge server doesn't expose either.
//
// Run automatically as part of `npm run build`/`npm run dev` (see
// package.json's pre* hooks) rather than committing the copies to git, so
// they can never drift from the community/ source of truth.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMUNITY_DIR = join(__dirname, '..', '..', 'community');
const OUT_DIR = join(__dirname, '..', 'public', 'community');

function titleFromReadme(dir) {
    const readmePath = join(dir, 'README.md');
    if (!existsSync(readmePath)) return null;
    const text = readFileSync(readmePath, 'utf-8');
    const match = text.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
}

function titleFromFolderName(name) {
    return name.split(/[_-]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function main() {
    if (!existsSync(COMMUNITY_DIR)) {
        console.warn('[sync-community-sessions] community/ not found, skipping.');
        return;
    }
    mkdirSync(OUT_DIR, { recursive: true });

    const entries = readdirSync(COMMUNITY_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();

    const manifest = [];
    for (const name of entries) {
        const dir = join(COMMUNITY_DIR, name);

        // A project may ship SEVERAL sessions, not just session.json —
        // modular_profile_rack splits its build across session.json (the beam),
        // keys_session.json, hubs_session.json and shelf_session.json. Copying
        // only session.json silently dropped three of the four, so the dropdown
        // offered one entry that looked like the whole rack but was just a beam.
        const sessionFiles = readdirSync(dir)
            .filter((f) => f === 'session.json' || f.endsWith('_session.json'))
            // session.json first, then the rest alphabetically.
            .sort((a, b) =>
                a === 'session.json' ? -1 : b === 'session.json' ? 1 : a.localeCompare(b),
            );
        if (sessionFiles.length === 0) continue;

        const readmeTitle = titleFromReadme(dir) || titleFromFolderName(name);

        for (const file of sessionFiles) {
            const isPrimary = file === 'session.json';
            const id = isPrimary ? name : `${name}/${file.replace(/\.json$/, '')}`;
            const destName = isPrimary
                ? `${name}.json`
                : `${name}__${file.replace(/_session\.json$/, '')}.json`;

            writeFileSync(join(OUT_DIR, destName), readFileSync(join(dir, file)));

            // Prefer the session's own metadata.name — each rack session names
            // the specific part it builds ("... - Corner & Multi-Way Hubs"),
            // which is what makes the entries distinguishable in the dropdown.
            // Fall back to the README H1 for single-session projects.
            let title = readmeTitle;
            if (sessionFiles.length > 1) {
                try {
                    const meta = JSON.parse(readFileSync(join(dir, file), 'utf-8'))?.metadata;
                    if (meta?.name) title = meta.name;
                } catch {
                    title = `${readmeTitle} (${file})`;
                }
            }

            manifest.push({ id, title, file: destName });
        }
    }

    writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(manifest, null, 2));

    // Prune copies whose source is gone. Without this the script only ever ADDS:
    // deleting or renaming a community/ folder left its old .json behind, so the
    // build kept shipping sessions for projects that no longer exist (their STL
    // export paths pointing at deleted directories).
    //
    // Deliberately NOT a blanket wipe of OUT_DIR before writing: that would also
    // delete anything unrelated dropped in here, and would briefly empty a
    // directory the dev server may be serving. Only files this script is
    // responsible for — *.json that we did not just write — are removed.
    const written = new Set([...manifest.map((m) => m.file), 'index.json']);
    const stale = readdirSync(OUT_DIR).filter((f) => f.endsWith('.json') && !written.has(f));
    for (const f of stale) rmSync(join(OUT_DIR, f));

    const prunedNote = stale.length ? `, pruned ${stale.length} stale (${stale.join(', ')})` : '';
    console.log(
        `[sync-community-sessions] wrote ${manifest.length} session(s) to studio/public/community/${prunedNote}`,
    );
}

main();
