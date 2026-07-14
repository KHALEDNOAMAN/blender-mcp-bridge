# Studio

Studio is the visual editor for inspecting, editing, and replaying Blender MCP
session recordings — a Vite + React app that talks directly to the MCP Bridge
Server over HTTP. See the [top-level README](../README.md#studio-visual-editor)
for setup, usage, and the session JSON format.

## Development

```bash
npm install
npm run dev
```

`npm run dev` and `npm run build` both run `scripts/sync-community-sessions.mjs`
first (via the `presync-community` script), which copies `../community/*/session.json`
into `public/community/` and writes a manifest so the "Load Community Sample"
dropdown can fetch a static list. That output directory is generated and
gitignored — never hand-edit or commit it.

```bash
npm run build    # outputs static bundle to studio/dist/
npm run preview  # preview the production build
npm run lint      # oxlint
```

Once built, the Bridge Server also serves Studio directly at
`http://localhost:8008/editor/`.
