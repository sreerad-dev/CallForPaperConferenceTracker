/**
 * Live data pipeline.
 *
 * For each conference in watchlist.json:
 *   1. Try aideadlin.es YAML (primary — covers most AI/CS venues)
 *   2. Fall back to WikiCFP search (secondary — broader but slower)
 *   3. If both miss, emit a placeholder row marked TBA
 *
 * The watchlist only needs: acronym, area, ranking, format, submissionModel.
 * Everything else (deadlines, location, event date, CFP URL) comes from live sources.
 */

import type { ConferenceRecord, RollingVenueRecord, Ranking, Format, SubmissionModel } from './types.js'
import { loadAiDeadlines, bestMatch, extractIsoDate } from '../sources/aideadlines.js'
import { loadCcfDeadlines, findCcfMatch } from '../sources/ccfdeadlines.js'
import { isPast, isWithin30Days, computeNextDeadline } from './deadlines.js'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const _dir = path.dirname(fileURLToPath(import.meta.url))
const WATCHLIST_PATH = path.resolve(_dir, '../data/watchlist.json')

// ---------------------------------------------------------------------------
// Watchlist schema
// ---------------------------------------------------------------------------

interface WatchEntry {
  acronym: string
  ccfKey?: string        // override lookup key for ccf-deadlines when title differs
  area: string
  ranking: Ranking
  hostOrg: string
  format: Format
  submissionModel: SubmissionModel
}

interface RollingWatchEntry {
  acronym: string
  displayName?: string
  hostOrg?: string
  area?: string
  cycle: string
  strategy: 'monthly-first' | 'monthly-day' | 'quarterly'
  quarterlyMonths?: number[]
  quarterlyDay?: number
  quarterlyEndOfMonth?: boolean
  monthlyDay?: number
  cfpUrl: string
}

interface Watchlist {
  conferences: WatchEntry[]
  rollingVenues: RollingWatchEntry[]
}

function loadWatchlist(): Watchlist {
  return JSON.parse(fs.readFileSync(WATCHLIST_PATH, 'utf-8')) as Watchlist
}

// ---------------------------------------------------------------------------
// Deadline flag helpers
// ---------------------------------------------------------------------------

function computeFlags(abstractDeadline: string | null, fullPaperDeadline: string | null) {
  const isPassed =
    isPast(fullPaperDeadline) ||
    (!fullPaperDeadline && isPast(abstractDeadline))

  const isUpcoming =
    !isPassed &&
    (isWithin30Days(fullPaperDeadline) || isWithin30Days(abstractDeadline))

  return { isPassed, isUpcoming }
}

// ---------------------------------------------------------------------------
// Build a ConferenceRecord from aideadlin.es data + watchlist metadata
// ---------------------------------------------------------------------------

function fromAiDeadlines(
  id: number,
  watch: WatchEntry,
  ai: NonNullable<ReturnType<typeof bestMatch>>,
): ConferenceRecord {
  const abstractDeadline = extractIsoDate(ai.abstract_deadline)
  const fullPaperDeadline = extractIsoDate(ai.deadline)
  const { isPassed, isUpcoming } = computeFlags(abstractDeadline, fullPaperDeadline)

  return {
    id,
    name: `${ai.title} ${ai.year}`,
    hostOrg: watch.hostOrg,
    area: watch.area,
    ranking: watch.ranking,
    format: watch.format,
    submissionModel: watch.submissionModel,
    location: ai.place ?? 'TBA',
    abstractDeadline,
    fullPaperDeadline,
    notification: null,
    cameraReady: null,
    eventDate: ai.date ?? 'TBA',
    cfpUrl: ai.link ?? '#',
    isRolling: watch.submissionModel === 'Rolling',
    isPassed,
    isUpcoming,
  }
}

// ---------------------------------------------------------------------------
// Build a ConferenceRecord from ccfddl data + watchlist metadata
// ---------------------------------------------------------------------------

function fromCcf(
  id: number,
  watch: WatchEntry,
  ccf: NonNullable<ReturnType<typeof findCcfMatch>>,
): ConferenceRecord {
  const { isPassed, isUpcoming } = computeFlags(ccf.abstractDeadline, ccf.deadline)

  return {
    id,
    name: ccf.title,
    hostOrg: watch.hostOrg,
    area: watch.area,
    ranking: watch.ranking,
    format: watch.format,
    submissionModel: watch.submissionModel,
    location: ccf.place,
    abstractDeadline: ccf.abstractDeadline,
    fullPaperDeadline: ccf.deadline,
    notification: null,
    cameraReady: null,
    eventDate: ccf.date,
    cfpUrl: ccf.link,
    isRolling: watch.submissionModel === 'Rolling',
    isPassed,
    isUpcoming,
  }
}

// ---------------------------------------------------------------------------
// TBA placeholder when no source has data
// ---------------------------------------------------------------------------

function placeholder(id: number, watch: WatchEntry): ConferenceRecord {
  return {
    id,
    name: watch.acronym,
    hostOrg: watch.hostOrg,
    area: watch.area,
    ranking: watch.ranking,
    format: watch.format,
    submissionModel: watch.submissionModel,
    location: 'TBA',
    abstractDeadline: null,
    fullPaperDeadline: null,
    notification: null,
    cameraReady: null,
    eventDate: 'TBA',
    cfpUrl: '#',
    isRolling: watch.submissionModel === 'Rolling',
    isPassed: false,
    isUpcoming: false,
  }
}

// ---------------------------------------------------------------------------
// Rolling venues
// ---------------------------------------------------------------------------

function buildRollingVenues(watchlist: Watchlist): RollingVenueRecord[] {
  return watchlist.rollingVenues.map(rv => {
    let nextDeadline: string

    if (rv.strategy === 'quarterly' && rv.quarterlyEndOfMonth && rv.quarterlyMonths) {
      // End-of-month quarterly (e.g. PETS): compute last day of each target month
      const today = new Date()
      const todayIso = today.toISOString().split('T')[0]
      const upcoming: string[] = []
      for (let y = today.getFullYear(); y <= today.getFullYear() + 2; y++) {
        for (const month of rv.quarterlyMonths) {
          const lastDay = new Date(y, month, 0).getDate()
          const iso = `${y}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
          if (iso >= todayIso) upcoming.push(iso)
        }
      }
      upcoming.sort()
      const next = upcoming[0]
      nextDeadline = next
        ? new Date(next + 'T12:00:00Z').toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
          })
        : 'TBA'
    } else {
      nextDeadline = computeNextDeadline({
        strategy: rv.strategy,
        monthlyDay: rv.monthlyDay,
        quarterlyMonths: rv.quarterlyMonths,
        quarterlyDay: rv.quarterlyDay,
      })
    }

    return {
      venue: rv.displayName ?? rv.acronym,
      hostOrg: rv.hostOrg ?? '',
      area: rv.area ?? '',
      cycle: rv.cycle,
      cfpUrl: rv.cfpUrl,
      nextDeadline,
    } satisfies RollingVenueRecord
  })
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function buildConferenceData(): Promise<{
  conferences: ConferenceRecord[]
  rollingVenues: RollingVenueRecord[]
}> {
  const watchlist = loadWatchlist()

  // Load both local repos (synchronous file reads, no network)
  const aiEntries = loadAiDeadlines()
  loadCcfDeadlines()  // warm the index

  const conferences: ConferenceRecord[] = []
  let id = 1

  for (const watch of watchlist.conferences) {
    // Rolling venues get a placeholder in the main table — shown in the rolling section
    if (watch.submissionModel === 'Rolling') {
      conferences.push(placeholder(id++, watch))
      continue
    }

    // 1. Try aideadlin.es (AI/ML venues)
    const aiMatch = bestMatch(aiEntries, watch.acronym)
    if (aiMatch) {
      conferences.push(fromAiDeadlines(id++, watch, aiMatch))
      continue
    }

    // 2. Try ccfddl (systems, DB, security, networking) — use ccfKey override if set
    const ccfMatch = findCcfMatch(watch.ccfKey ?? watch.acronym)
    if (ccfMatch) {
      conferences.push(fromCcf(id++, watch, ccfMatch))
      continue
    }

    // 3. Placeholder — conference not yet in either repo
    console.warn(`[pipeline] no data found for "${watch.acronym}" — using placeholder`)
    conferences.push(placeholder(id++, watch))
  }

  const rollingVenues = buildRollingVenues(watchlist)

  const found = conferences.filter(c => c.cfpUrl !== '#').length
  console.log(`[pipeline] matched ${found}/${conferences.length} conferences from local repos`)

  return { conferences, rollingVenues }
}
