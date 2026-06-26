/**
 * Reads conference data from the locally-cloned paperswithcode/ai-deadlines repo.
 * Covers ~200 AI/ML venues.
 *
 * Local path: server/data/repos/ai-deadlines/_data/conferences.yml
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const _dir = path.dirname(fileURLToPath(import.meta.url))
const YAML_PATH = path.resolve(_dir, '../data/repos/ai-deadlines/_data/conferences.yml')

export interface AiDeadlineConference {
  title: string
  year: number
  id?: string
  link?: string
  deadline: string | null
  abstract_deadline?: string
  timezone?: string
  place?: string
  date?: string
  start?: string
  end?: string
  sub?: string | string[]
  note?: string
  full_name?: string
}

/** Minimal YAML parser for the flat conferences.yml structure */
function parseConferencesYaml(yaml: string): AiDeadlineConference[] {
  const results: AiDeadlineConference[] = []
  const blocks = yaml.split(/^- title:/m).slice(1)

  for (const block of blocks) {
    const lines = ('- title:' + block).split('\n')
    const entry: Record<string, unknown> = {}

    for (const line of lines) {
      const m = line.match(/^[-\s]*(\w+):\s*(.*)$/)
      if (!m) continue
      const [, key, rawVal] = m
      const val = rawVal.trim()
        .replace(/^'(.*)'$/, '$1')
        .replace(/^"(.*)"$/, '$1')
        .trim()

      if (key === 'sub') {
        entry[key] = val.startsWith('[')
          ? val.replace(/[\[\]'"\s]/g, '').split(',').filter(Boolean)
          : val
      } else if (key === 'year') {
        entry[key] = parseInt(val, 10) || 0
      } else {
        entry[key] = val
      }
    }

    if (entry['title']) {
      results.push({
        title: entry['title'] as string,
        year: (entry['year'] as number) || new Date().getFullYear(),
        id: entry['id'] as string | undefined,
        link: entry['link'] as string | undefined,
        deadline: (entry['deadline'] as string) || null,
        abstract_deadline: entry['abstract_deadline'] as string | undefined,
        timezone: entry['timezone'] as string | undefined,
        place: entry['place'] as string | undefined,
        date: entry['date'] as string | undefined,
        start: entry['start'] as string | undefined,
        end: entry['end'] as string | undefined,
        sub: entry['sub'] as string | string[] | undefined,
        note: entry['note'] as string | undefined,
        full_name: entry['full_name'] as string | undefined,
      })
    }
  }

  return results
}

export function extractIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = raw.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

let _cache: AiDeadlineConference[] | null = null

export function loadAiDeadlines(): AiDeadlineConference[] {
  if (_cache) return _cache
  if (!fs.existsSync(YAML_PATH)) {
    console.warn('[aideadlines] repo not found at', YAML_PATH, '— run npm run setup')
    return []
  }
  const yaml = fs.readFileSync(YAML_PATH, 'utf-8')
  const entries = parseConferencesYaml(yaml)
  console.log(`[aideadlines] loaded ${entries.length} entries from local repo`)
  _cache = entries
  return entries
}

/** Find all entries matching an acronym (may return multiple years) */
function findByAcronym(entries: AiDeadlineConference[], acronym: string): AiDeadlineConference[] {
  const needle = acronym.toLowerCase().replace(/\s+/g, '')
  return entries.filter(e => {
    const title = e.title.toLowerCase().replace(/\s+/g, '')
    return title === needle || title.startsWith(needle)
  })
}

/**
 * Return the most relevant entry for an acronym:
 * prefer the most recent year with a future or recent deadline.
 */
export function bestMatch(
  entries: AiDeadlineConference[],
  acronym: string,
): AiDeadlineConference | null {
  const matches = findByAcronym(entries, acronym)
  if (matches.length === 0) return null

  const today = new Date().toISOString().split('T')[0]

  const withDeadline = matches
    .filter(e => e.deadline)
    .sort((a, b) => {
      const da = extractIsoDate(a.deadline) ?? ''
      const db = extractIsoDate(b.deadline) ?? ''
      const aFuture = da >= today
      const bFuture = db >= today
      if (aFuture !== bFuture) return aFuture ? -1 : 1
      return b.year - a.year
    })

  return withDeadline[0] ?? matches.sort((a, b) => b.year - a.year)[0]
}
