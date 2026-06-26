import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// The generated md file lives inside the project — served by Vite at /api/cfp-tracker.md
// and also available as the static fallback at /cfp-tracker.md
const CFP_MD_PATH = path.resolve('./public/cfp-tracker.md')

/**
 * Vite plugin that:
 * - Serves GET  /api/cfp-tracker.md   — the live markdown file
 * - Serves POST /api/refresh          — triggers a manual scrape
 * - Serves GET  /api/refresh-status   — returns scheduler status
 * - Starts the Mon/Thu refresh scheduler when the dev server boots
 * - Triggers HMR when the md file changes
 * - Copies the md file into public/ on production build
 */
function cfpTrackerPlugin() {
  let schedulerHandle: ReturnType<typeof setInterval> | null = null

  return {
    name: 'cfp-tracker-md',

    async configureServer(server: any) {
      // ── Start the scheduler (Mon/Thu auto-refresh) ──────────────────────
      // Dynamic import so Vite's module graph doesn't try to bundle server code
      const { startScheduler, triggerManualRefresh, getSchedulerStatus } =
        await import('./server/scheduler')

      schedulerHandle = startScheduler()

      // ── /api/cfp-tracker.md ─────────────────────────────────────────────
      server.middlewares.use('/api/cfp-tracker.md', (_req: any, res: any) => {
        try {
          const content = fs.readFileSync(CFP_MD_PATH, 'utf-8')
          res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(content)
        } catch {
          res.statusCode = 404
          res.end('cfp_tracker.md not found')
        }
      })

      // ── /api/refresh  (POST) ────────────────────────────────────────────
      server.middlewares.use('/api/refresh', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed — use POST' }))
          return
        }
        res.setHeader('Content-Type', 'application/json')
        const result = await triggerManualRefresh()
        res.statusCode = result.ok ? 200 : 503
        res.end(JSON.stringify(result))
      })

      // ── /api/refresh-status  (GET) ──────────────────────────────────────
      server.middlewares.use('/api/refresh-status', (_req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(getSchedulerStatus()))
      })

      // ── File watcher — trigger HMR when the md changes ──────────────────
      if (fs.existsSync(CFP_MD_PATH)) {
        fs.watch(CFP_MD_PATH, () => {
          server.ws.send({ type: 'full-reload' })
          console.log('[cfp-plugin] md file changed — triggering HMR reload')
        })
      }
    },

    buildEnd() {
      if (schedulerHandle) {
        clearInterval(schedulerHandle)
        schedulerHandle = null
      }
    },

    // On production build, public/cfp-tracker.md is already in place — nothing to copy.
    // Vite includes public/ contents in the build output automatically.
    buildStart() {
      if (!fs.existsSync(CFP_MD_PATH)) {
        console.warn('[cfp-plugin] public/cfp-tracker.md not found — run `npm run scrape` first')
      }
    },
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    cfpTrackerPlugin(),
  ],
})
