/**
 * CFP refresh scheduler.
 *
 * Strategy:
 * - On dev-server startup, check if today is Mon (1) or Thu (4).
 *   If yes, and we haven't already refreshed today, kick off a scrape.
 * - Then set a recurring heartbeat every HEARTBEAT_MS to repeat the check.
 *   This covers the case where the server starts on a non-refresh day and
 *   keeps running past midnight into a refresh day.
 *
 * The last-refresh timestamp is persisted to a small JSON file in the
 * server/data directory so it survives hot-reloads.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { runScraper } from './scraper/index.js'

const _dir = path.dirname(fileURLToPath(import.meta.url))
const STATE_PATH = path.resolve(_dir, 'data/scheduler-state.json')
const REPOS_PATH = path.resolve(_dir, 'data/repos')

// ---------------------------------------------------------------------------
// Git pull helpers
// ---------------------------------------------------------------------------

function pullRepo(name: string): void {
  const repoPath = path.join(REPOS_PATH, name)
  if (!fs.existsSync(repoPath)) {
    console.warn(`[scheduler] repo "${name}" not found at ${repoPath} — skipping pull`)
    return
  }
  try {
    execSync('git pull --ff-only', { cwd: repoPath, stdio: 'pipe' })
    console.log(`[scheduler] pulled ${name}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[scheduler] git pull failed for ${name}: ${msg}`)
  }
}

export async function pullAllRepos(): Promise<void> {
  pullRepo('ai-deadlines')
  pullRepo('ccf-deadlines')
}

// Check every hour whether we've crossed into a refresh day
const HEARTBEAT_MS = 60 * 60 * 1_000  // 1 hour

// Days on which auto-refresh runs: 1 = Monday, 4 = Thursday
const REFRESH_DAYS = new Set([1, 4])

interface SchedulerState {
  lastRefreshDate: string | null  // ISO date "YYYY-MM-DD"
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadState(): SchedulerState {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')) as SchedulerState
    }
  } catch {
    // Corrupt state file — start fresh
  }
  return { lastRefreshDate: null }
}

function saveState(state: SchedulerState): void {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8')
}

let isRunning = false

async function maybeRefresh(): Promise<void> {
  const now = new Date()
  const dayOfWeek = now.getDay()  // 0=Sun, 1=Mon, ..., 4=Thu

  if (!REFRESH_DAYS.has(dayOfWeek)) {
    // Not a refresh day — nothing to do
    return
  }

  const today = todayIso()
  const state = loadState()

  if (state.lastRefreshDate === today) {
    console.log(`[scheduler] already refreshed today (${today}), skipping`)
    return
  }

  if (isRunning) {
    console.log('[scheduler] scrape already in progress, skipping duplicate trigger')
    return
  }

  console.log(`[scheduler] refresh day detected (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek]}), pulling repos + starting scrape...`)
  isRunning = true

  try {
    await pullAllRepos()
    await runScraper()
    saveState({ lastRefreshDate: today })
    console.log(`[scheduler] refresh complete, next auto-refresh: ${nextRefreshDay()}`)
  } catch (err) {
    console.error('[scheduler] scrape failed:', err instanceof Error ? err.message : err)
  } finally {
    isRunning = false
  }
}

/** Returns a human-readable string for the next scheduled refresh day */
function nextRefreshDay(): string {
  const now = new Date()
  for (let i = 1; i <= 7; i++) {
    const candidate = new Date(now)
    candidate.setDate(now.getDate() + i)
    if (REFRESH_DAYS.has(candidate.getDay())) {
      return candidate.toDateString()
    }
  }
  return 'unknown'
}

/**
 * Start the scheduler.
 * Call this once when the Vite dev server initialises.
 * Returns the interval handle (call clearInterval to stop).
 */
export function startScheduler(): ReturnType<typeof setInterval> {
  console.log('[scheduler] started — auto-refresh on Mondays and Thursdays')
  console.log(`[scheduler] next scheduled refresh: ${nextRefreshDay()}`)

  // Immediate check on startup
  maybeRefresh().catch(err =>
    console.error('[scheduler] startup check failed:', err)
  )

  // Hourly heartbeat
  const handle = setInterval(() => {
    maybeRefresh().catch(err =>
      console.error('[scheduler] heartbeat check failed:', err)
    )
  }, HEARTBEAT_MS)

  return handle
}

/**
 * Trigger a manual refresh (used by the /api/refresh endpoint).
 * Ignores the day-of-week gate but still respects the isRunning guard.
 */
export async function triggerManualRefresh(): Promise<{ ok: boolean; message: string }> {
  if (isRunning) {
    return { ok: false, message: 'Refresh already in progress' }
  }

  isRunning = true
  try {
    await pullAllRepos()
    await runScraper()
    saveState({ lastRefreshDate: todayIso() })
    return { ok: true, message: 'Refresh complete' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Refresh failed: ${msg}` }
  } finally {
    isRunning = false
  }
}

/**
 * Returns current scheduler status for the /api/refresh-status endpoint.
 */
export function getSchedulerStatus(): object {
  const state = loadState()
  const now = new Date()
  return {
    lastRefreshDate: state.lastRefreshDate,
    isRunning,
    nextRefreshDay: nextRefreshDay(),
    currentDayOfWeek: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()],
    isRefreshDay: REFRESH_DAYS.has(now.getDay()),
  }
}
