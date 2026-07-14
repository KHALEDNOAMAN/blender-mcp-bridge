// Copies community/*/session.json into studio/public/community/<folder>.json
// and writes a manifest (studio/public/community/index.json) listing them,
// so the "Load Community Sample" dropdown (App.jsx) can fetch a static list
// without a directory listing — which static hosts (GitHub Pages) can't do,
// and which the bridge server doesn't expose either.
//
// Run automatically as part of `npm run build`/`npm run dev` (see
// package.json's pre* hooks) rather than committing the copies to git, so
// they can never drift from the community/ source of truth.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
        const sessionPath = join(dir, 'session.json');
        if (!existsSync(sessionPath)) continue;

        const destName = `${name}.json`;
        writeFileSync(join(OUT_DIR, destName), readFileSync(sessionPath));

        manifest.push({
            id: name,
            title: titleFromReadme(dir) || titleFromFolderName(name),
            file: destName,
        });
    }

    writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(manifest, null, 2));
    console.log(`[sync-community-sessions] wrote ${manifest.length} session(s) to studio/public/community/`);
}

main();
