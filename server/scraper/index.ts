/**
 * Main scraper entry point.
 * Watchlist → live sources (aideadlin.es + WikiCFP) → render → write md.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildConferenceData } from './pipeline.js'
import { renderMarkdown } from './renderer.js'

const _dir = path.dirname(fileURLToPath(import.meta.url))

// Output path — lives in public/ so Vite serves it directly as /cfp-tracker.md
const OUTPUT_PATH = path.resolve(_dir, '../../public/cfp-tracker.md')

export async function runScraper(): Promise<void> {
  console.log('[scraper] starting refresh...')

  const { conferences, rollingVenues } = await buildConferenceData()

  const markdown = renderMarkdown(conferences, rollingVenues)

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, markdown, 'utf-8')

  const urgentCount = conferences.filter((c: ConferenceRecord) => c.isUpcoming).length
  console.log(
    `[scraper] done — ${conferences.length} conferences, ${urgentCount} upcoming, written to ${OUTPUT_PATH}`
  )
}

// Run directly when invoked as a script (npm run scrape)
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
if (isMain || process.argv[1]?.includes('index')) {
  runScraper().catch(err => {
    console.error('[scraper] fatal error:', err)
    process.exit(1)
  })
}
import type { ConferenceRecord } from './types.js'
