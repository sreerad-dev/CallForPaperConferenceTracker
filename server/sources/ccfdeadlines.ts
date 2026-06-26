/**
 * Reads conference data from the locally-cloned ccfddl/ccf-deadlines repo.
 * Covers systems, databases, distributed systems, security, and networking venues
 * that are not in aideadlin.es.
 *
 * Local path: server/data/repos/ccf-deadlines/conference/**\/*.yml
 *
 * Schema per file:
 *   title, description, sub, rank.core, dblp
 *   confs[]:
 *     year, id, link
 *     timeline[]: deadline, abstract_deadline, comment
 *     timezone, date, place
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { extractIsoDate } from './aideadlines.js'

const _dir = path.dirname(fileURLToPath(import.meta.url))
const REPO_PATH = path.resolve(_dir, '../data/repos/ccf-deadlines/conference')

export interface CcfConference {
  title: string
  description: string
  coreRank: string        // "A*" | "A" | "B" | "C" | "Unknown"
  year: number
  link: string
  deadline: string | null
  abstractDeadline: string | null
  timezone: string
  date: string
  place: string
}

// ---------------------------------------------------------------------------
// YAML helpers
// ---------------------------------------------------------------------------

/**
 * Extract a scalar value from a YAML-ish text block.
 * Matches lines like:
 *   "- title: FAST"   (top-level list item)
 *   "  description: ..."
 *   "      link: ..."
 */
function getField(text: string, key: string): string {
  const m = text.match(new RegExp(`^[\\s-]*${key}:\\s*(.+)$`, 'm'))
  if (!m) return ''
  return m[1].trim().replace(/^['"]|['"]$/g, '')
}

// ---------------------------------------------------------------------------
// Per-file YAML parser
// ---------------------------------------------------------------------------

interface RawConf {
  year: number
  id?: string
  link?: string
  timeline: Array<{ deadline: string; abstract_deadline?: string; comment?: string }>
  timezone?: string
  date?: string
  place?: string
}

interface RawEntry {
  title: string
  description: string
  sub: string
  coreRank: string
  confs: RawConf[]
}

function parseSingleEntry(block: string): RawEntry | null {
  const title = getField(block, 'title')
  if (!title) return null

  const description = getField(block, 'description')
  const sub = getField(block, 'sub')
  const coreRank = block.match(/\s+core:\s*(\S+)/)?.[1] ?? ''

  // Each conf entry starts with 4-space "    - year:"
  const confs: RawConf[] = []
  const confBlocks = block.split(/^\s{4}- year:/m).slice(1)

  for (const cb of confBlocks) {
    const firstLine = cb.split('\n')[0]
    const year = parseInt(firstLine.trim(), 10)
    if (!year) continue

    const link = getField(cb, 'link')
    const timezone = getField(cb, 'timezone')
    const date = getField(cb, 'date')
    const place = getField(cb, 'place')

    // Each timeline entry is a list item at 8-space indent.
    // Two possible orderings:
    //   "        - deadline: '...'"           (FAST style)
    //   "        - abstract_deadline: '...'"  (NSDI style, deadline is a sibling key)
    const timeline: RawConf['timeline'] = []

    // Split on any 8-space list item marker
    const tlBlocks = cb.split(/^\s{8}- /m).slice(1)
    for (const tb of tlBlocks) {
      // Extract deadline — either on the first line ("deadline: '...'") or as a sub-key
      const dlMatch = tb.match(/(?:^|\n)\s*deadline:\s*['"]?([^'"\n]+)['"]?/)
      if (!dlMatch) continue
      const deadlineRaw = dlMatch[1].trim().replace(/\s/g, '')
      if (!deadlineRaw) continue

      const abMatch = tb.match(/(?:^|\n)\s*abstract_deadline:\s*['"]?([^'"\n]+)['"]?/)
      const abstract = abMatch ? abMatch[1].trim().replace(/\s/g, '') : undefined
      const commentMatch = tb.match(/(?:^|\n)\s*comment:\s*(.+)/)
      const comment = commentMatch ? commentMatch[1].trim().replace(/^['"]|['"]$/g, '') : undefined

      timeline.push({ deadline: deadlineRaw, abstract_deadline: abstract, comment })
    }

    confs.push({ year, id: getField(cb, 'id') || undefined, link: link || undefined, timeline, timezone: timezone || undefined, date: date || undefined, place: place || undefined })
  }

  return { title, description, sub, coreRank, confs }
}

function parseCcfYaml(yaml: string): RawEntry[] {
  const results: RawEntry[] = []
  const blocks = yaml.split(/^- title:/m).slice(1)
  for (const block of blocks) {
    const entry = parseSingleEntry('- title:' + block)
    if (entry) results.push(entry)
  }
  return results
}

// ---------------------------------------------------------------------------
// Rank normalisation
// ---------------------------------------------------------------------------

function normaliseCoreRank(raw: string): string {
  const r = raw.trim().toUpperCase()
  if (r === 'A*' || r === 'ASTAR') return 'A*'
  if (r === 'A') return 'A'
  if (r === 'B') return 'B'
  if (r === 'C') return 'C'
  return raw || 'Unknown'
}

// ---------------------------------------------------------------------------
// Index builder: acronym (lowercase) → CcfConference[]
// ---------------------------------------------------------------------------

let _index: Map<string, CcfConference[]> | null = null

function buildIndex(): Map<string, CcfConference[]> {
  if (!fs.existsSync(REPO_PATH)) {
    console.warn('[ccfdeadlines] repo not found at', REPO_PATH, '— run npm run setup')
    return new Map()
  }

  const index = new Map<string, CcfConference[]>()
  const today = new Date().toISOString().split('T')[0]
  let fileCount = 0

  const categories = fs.readdirSync(REPO_PATH).filter(d =>
    fs.statSync(path.join(REPO_PATH, d)).isDirectory()
  )

  for (const cat of categories) {
    const catPath = path.join(REPO_PATH, cat)
    const files = fs.readdirSync(catPath).filter(f => f.endsWith('.yml'))

    for (const file of files) {
      try {
        const yaml = fs.readFileSync(path.join(catPath, file), 'utf-8')
        const entries = parseCcfYaml(yaml)
        fileCount++

        for (const entry of entries) {
          if (!entry.title) continue
          const key = entry.title.toLowerCase()
          const records: CcfConference[] = []

          for (const conf of entry.confs) {
            if (!conf.timeline || conf.timeline.length === 0) continue

            // Sort timeline entries by deadline date
            const sorted = [...conf.timeline].sort((a, b) =>
              (extractIsoDate(a.deadline) ?? '').localeCompare(extractIsoDate(b.deadline) ?? '')
            )

            // Prefer a future deadline; fall back to most recent past one
            const future = sorted.filter(t => (extractIsoDate(t.deadline) ?? '') >= today)
            const chosen = future[0] ?? sorted[sorted.length - 1]

            records.push({
              title: `${entry.title} ${conf.year}`,
              description: entry.description,
              coreRank: normaliseCoreRank(entry.coreRank),
              year: conf.year,
              link: conf.link ?? '#',
              deadline: extractIsoDate(chosen.deadline),
              abstractDeadline: extractIsoDate(chosen.abstract_deadline),
              timezone: conf.timezone ?? 'AoE',
              date: conf.date ?? 'TBA',
              place: conf.place ?? 'TBA',
            })
          }

          if (records.length > 0) {
            const existing = index.get(key) ?? []
            index.set(key, [...existing, ...records])
          }
        }
      } catch (err) {
        console.warn(`[ccfdeadlines] failed to parse ${cat}/${file}:`, err instanceof Error ? err.message : err)
      }
    }
  }

  console.log(`[ccfdeadlines] indexed ${index.size} acronyms from ${fileCount} files`)
  return index
}

export function loadCcfDeadlines(): Map<string, CcfConference[]> {
  if (!_index) _index = buildIndex()
  return _index
}

/**
 * Find the best matching entry for a conference acronym.
 * Prefers a future deadline, then most recent year.
 */
export function findCcfMatch(acronym: string): CcfConference | null {
  const index = loadCcfDeadlines()
  const needle = acronym.toLowerCase().replace(/[^a-z0-9]/g, '')

  let candidates: CcfConference[] = []

  // Exact key match first (handles ccfKey overrides like "sp", "atc", "sec")
  const exactKey = index.get(acronym.toLowerCase())
  if (exactKey) {
    candidates = exactKey
  } else {
    // Fuzzy prefix/subset match for everything else
    for (const [key, records] of index) {
      const normKey = key.replace(/[^a-z0-9]/g, '')
      if (normKey === needle || normKey.startsWith(needle) || needle.startsWith(normKey)) {
        candidates = candidates.concat(records)
      }
    }
  }

  if (candidates.length === 0) return null

  const today = new Date().toISOString().split('T')[0]
  return candidates.sort((a, b) => {
    const aFuture = (a.deadline ?? '') >= today
    const bFuture = (b.deadline ?? '') >= today
    if (aFuture !== bFuture) return aFuture ? -1 : 1
    return b.year - a.year
  })[0]
}
