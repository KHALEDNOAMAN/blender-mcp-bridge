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
// Pages needs base '/blender-mcp-n8n/'. Selected via a build-time env var
// rather than two permanently-diverged config files, since everything else
// about the build is identical.
export default defineConfig({
  plugins: [react()],
  base: process.env.STUDIO_DEPLOY_TARGET === 'pages' ? '/blender-mcp-n8n/' : '/studio/',
})
