import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// `base` needs to differ per deploy target: the bridge server mounts
// studio/dist at the /studio/ SUBPATH (src/server.py, Mount("/studio", ...)),
// so asset URLs need the /studio/ prefix (base '/studio/') or every asset
// 404s against a root-relative URL, which is not where the bridge actually
// serves them from (confirmed live: base '/' produced a blank page with
// every /assets/*.js and *.css request 404ing). GitHub Pages project sites
// are served from a /<repo-name>/ subpath instead, so a build meant for
// Pages needs base '/blender-mcp-bridge/'. Selected via a build-time env var
// rather than two permanently-diverged config files, since everything else
// about the build is identical.
export default defineConfig({
  plugins: [react()],
  base: process.env.STUDIO_DEPLOY_TARGET === 'pages' ? '/blender-mcp-bridge/' : '/studio/',
  build: {
    // The entry bundle is ~335 kB; the only chunks above Vite's 500 kB default
    // are the two lazy-loaded panels, which is exactly where we want the weight:
    //   ModelViewer       ~555 kB — three.js, fetched only when the STL viewer opens
    //   JsonSessionEditor ~343 kB — codemirror, fetched only in JSON view
    // three.js can't usefully shrink further (WebGLRenderer transitively needs
    // the core shader/material/math library — switching `import * as THREE` to
    // 12 named imports produced a byte-identical chunk). So the warning has no
    // remaining action behind it; raised just above that chunk so it stays
    // meaningful and fires again if something genuinely regresses.
    chunkSizeWarningLimit: 600,
  },
})
