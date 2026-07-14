import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// `base` needs to differ per deploy target: the bridge server mounts
// studio/dist at its own /editor/ path (src/server.py), which needs
// root-relative asset URLs (base '/'); GitHub Pages project sites are
// served from a /<repo-name>/ subpath instead (docs/studio_design_v1.md
// §9), so a build meant for Pages needs base '/blender-mcp-n8n/' or every
// asset URL 404s. Selected via a build-time env var rather than two
// permanently-diverged config files, since everything else about the build
// is identical.
export default defineConfig({
  plugins: [react()],
  base: process.env.STUDIO_DEPLOY_TARGET === 'pages' ? '/blender-mcp-n8n/' : '/',
})
