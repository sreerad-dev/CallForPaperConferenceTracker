/**
 * Renders enriched conference data into the exact cfp-tracker.md format
 * that the UI's parseMarkdown.ts expects.
 */

import type { ConferenceRecord, RollingVenueRecord } from './types.js'
import { formatDate, daysUntil } from './deadlines.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RANKING_EMOJI: Record<string, string> = {
  'A*': '🏆 A*',
  'A': '🥇 A',
  'B': '🥈 B',
  'Workshop': 'Workshop',
  'Industry': 'Industry',
  'Tutorial': 'Tutorial',
  'New venue': 'New venue',
  'Unknown': 'Unknown',
}

const FORMAT_EMOJI: Record<string, string> = {
  'Hybrid': '✅ Hybrid',
  'In-person': '🏢 In-person',
  'Unknown': 'TBA',
}

function rankingEmoji(r: string): string {
  return RANKING_EMOJI[r] ?? r
}

function formatEmoji(f: string): string {
  return FORMAT_EMOJI[f] ?? f
}

/**
 * Renders a deadline cell:
 * - null / undefined     → "TBA"
 * - past date            → "~~Mon DD, YYYY~~"
 * - within 30 days       → "⚠️ Mon DD, YYYY"
 * - future               → "Mon DD, YYYY"
 *
 * @param iso    ISO date string or null
 * @param suffix optional suffix like "(ARR)" or "(est.)"
 */
function deadlineCell(
  iso: string | null,
  suffix = '',
  rollingNote?: string,
): string {
  if (rollingNote) {
    // e.g. "Rolling (1st of month)" with embedded cutoff shown separately
    return `${rollingNote}`
  }
  if (!iso) return 'TBA'

  const days = daysUntil(iso)
  const label = formatDate(iso) + (suffix ? ` ${suffix}` : '')

  if (days < 0) return `~~${label}~~`
  if (days <= 30) return `⚠️ ${label}`
  return label
}

function notifCell(iso: string | null): string {
  if (!iso) return 'TBA'
  return formatDate(iso)
}

// ---------------------------------------------------------------------------
// Urgent deadlines section
// ---------------------------------------------------------------------------

function buildUrgentSection(conferences: ConferenceRecord[]): string {
  const urgent = conferences
    .filter(c => c.isUpcoming)
    .flatMap(c => {
      const rows: { name: string; type: string; iso: string }[] = []
      if (c.abstractDeadline && daysUntil(c.abstractDeadline) >= 0 && daysUntil(c.abstractDeadline) <= 30) {
        rows.push({ name: c.name, type: 'Abstract', iso: c.abstractDeadline })
      }
      if (c.fullPaperDeadline && daysUntil(c.fullPaperDeadline) >= 0 && daysUntil(c.fullPaperDeadline) <= 30) {
        rows.push({ name: c.name, type: 'Full Paper', iso: c.fullPaperDeadline })
      }
      return rows
    })
    .sort((a, b) => a.iso.localeCompare(b.iso))

  if (urgent.length === 0) {
    return `## ⚠️ Urgent — Deadlines Within 30 Days\n\n_No deadlines in the next 30 days._\n`
  }

  const header = `## ⚠️ Urgent — Deadlines Within 30 Days\n\n| Conference | Deadline Type | Date | Days Remaining |\n|---|---|---|---|\n`
  const rows = urgent
    .map(u => {
      const days = daysUntil(u.iso)
      return `| ${u.name} | ${u.type} | ${formatDate(u.iso)} | ${days} day${days !== 1 ? 's' : ''} |`
    })
    .join('\n')

  return header + rows + '\n'
}

// ---------------------------------------------------------------------------
// Main CFP table
// ---------------------------------------------------------------------------

function buildMainTable(conferences: ConferenceRecord[]): string {
  const header = [
    '## Comprehensive CFP Table',
    '',
    '| # | Conference/Workshop | Host Org | Research Area | Location | Abstract Deadline | Full Paper Deadline | Notification | Camera-Ready | Event Date | Ranking | Submission Model | CFP URL | Format |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ].join('\n')

  const rows = conferences.map(c => {
    const isArr = c.submissionModel === 'ARR'
    const arrSuffix = isArr ? '(ARR)' : ''

    // For rolling venues, show rollingNote in deadline cells
    const isRolling = c.submissionModel === 'Rolling'

    const abstractCell = isRolling && c.rollingNote
      ? c.rollingNote
      : deadlineCell(c.abstractDeadline, arrSuffix)

    const fullPaperCell = isRolling && c.rollingNote
      ? `Rolling (by ${c.fullPaperDeadline ? formatDate(c.fullPaperDeadline) : 'TBA'})`
      : deadlineCell(c.fullPaperDeadline, arrSuffix)

    const submissionDisplay = isRolling
      ? '🔄 Rolling'
      : c.submissionModel === 'ARR'
      ? 'ARR'
      : c.submissionModel

    return [
      `| ${c.id}`,
      c.name,
      c.hostOrg,
      c.area,
      c.location,
      abstractCell,
      fullPaperCell,
      notifCell(c.notification),
      notifCell(c.cameraReady),
      c.eventDate,
      rankingEmoji(c.ranking),
      submissionDisplay,
      `[CFP](${c.cfpUrl})`,
      `${formatEmoji(c.format)} |`,
    ].join(' | ')
  })

  return header + '\n' + rows.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Rolling venues table
// ---------------------------------------------------------------------------

function buildRollingTable(venues: RollingVenueRecord[]): string {
  const header = [
    '## 🔄 Rolling/Continuous Submission Venues',
    '',
    '| Venue | Host Org | Area | Submission Cycle | Next Deadline | CFP URL |',
    '|---|---|---|---|---|---|',
  ].join('\n')

  const rows = venues.map(v =>
    `| ${v.venue} | ${v.hostOrg} | ${v.area} | ${v.cycle} | ${v.nextDeadline} | [CFP](${v.cfpUrl}) |`
  )

  return header + '\n' + rows.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Area reference section (static — won't change with data)
// ---------------------------------------------------------------------------

const AREA_REFERENCE = `## Quick Reference by Research Area

- **Data Engineering**: ICDE, VLDB, SIGMOD, KDD, IEEE BigData, DEEM
- **Distributed Systems**: OSDI, SOSP, NSDI, EuroSys, USENIX ATC, SoCC, Middleware
- **ML Systems**: MLSys, ICML, NeurIPS, ICLR, COLM
- **LLM Infrastructure**: COLM, NeurIPS, ICML, EMNLP, ACL
- **NLP**: ACL, EMNLP, NAACL, COLM
- **AI Engineering**: AAAI, NeurIPS, ICML, KDD
- **AI/Cyber Security**: IEEE S&P, USENIX Security, ACM CCS, NDSS
- **Privacy Engineering**: PETS, IEEE S&P, NDSS, CCS
- **Cloud Computing**: SoCC, USENIX ATC, EuroSys, NSDI
- **Big Data**: IEEE BigData, KDD, VLDB, ICDE
- **Database Systems**: VLDB, SIGMOD, ICDE, CIKM
- **RAG / Knowledge Graphs**: CIKM, SIGIR, WSDM
- **MLOps**: MLSys, KDD
- **Streaming Systems**: ICDE, VLDB, USENIX ATC, IEEE BigData
- **Observability & Reliability**: ISSRE, USENIX ATC, OSDI
- **Information Retrieval**: SIGIR, CIKM, WSDM
- **Software Engineering**: ICSE, FSE, ASE, ISSTA, ICSME, MSR, SANER, ESEM, ICPC, ICST
- **Programming Languages**: PLDI, OOPSLA, ECOOP, POPL
- **Model-Driven Engineering**: MoDELS
- **Requirements Engineering**: RE
- **Systems Software**: HotOS, Middleware, SOSP, OSDI`

// ---------------------------------------------------------------------------
// Notes section
// ---------------------------------------------------------------------------

const NOTES = `## Notes

- **VLDB/SIGMOD (PACMMOD)**: Rolling monthly submission — for VLDB 2026, papers accepted by Jun 15, 2026 appear at the conference.
- **PETS 2027**: Rolling quarterly — 4 issues/year. Submit via [submit.petsymposium.org](https://submit.petsymposium.org/).
- **EMNLP/ACL/NAACL**: All use ACL Rolling Review (ARR). Submit via [aclrollingreview.org](https://aclrollingreview.org/).
- **NDSS 2027**: Two-cycle system (Summer + Fall). Fall cycle deadline: Aug 19, 2026.
- **IEEE S&P 2027**: Two-cycle system. Cycle 1 abstract due Jun 5, full paper Jun 12.
- **Deadline Aggregators**: [aideadlin.es](https://aideadlin.es/) · [sec-deadlines.github.io](https://sec-deadlines.github.io/) · [WikiCFP](http://www.wikicfp.com/cfp/)
- All deadlines are AoE (Anywhere on Earth) unless otherwise noted.`

// ---------------------------------------------------------------------------
// Top-level render
// ---------------------------------------------------------------------------

export function renderMarkdown(
  conferences: ConferenceRecord[],
  rollingVenues: RollingVenueRecord[],
): string {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]

  const header = [
    '# 📅 Call for Papers (CFP) Tracker — Data Engineering, AI & Large-Scale Systems',
    '',
    `> **Last Refreshed:** ${dateStr}`,
    `> **Scope:** Data Engineering · Distributed Systems · ML Systems · LLM Infrastructure · NLP · AI Engineering · AI/Cyber Security · Privacy · Cloud · Big Data · Databases · RAG · MLOps · Vector DBs · Knowledge Graphs · Streaming · Observability & Reliability · Software Engineering · Programming Languages`,
    `> **Coverage:** May 2026 – Sep 2027`,
    `> **Total Records:** ${conferences.length}`,
    '',
    '---',
    '',
    '## Legend',
    '',
    '| Symbol | Meaning |',
    '|--------|---------|',
    '| ⚠️ | Deadline within the next 30 days |',
    '| 🆕 | Newly added since last refresh |',
    '| 🔄 | Rolling/continuous submission |',
    '| 🏆 | A* ranked (CORE) |',
    '| 🥇 | A ranked (CORE) |',
    '| 🥈 | B ranked (CORE) |',
    '| ✅ | Hybrid/virtual option confirmed |',
    '| 🏢 | In-person only |',
    '| ARR | ACL Rolling Review model |',
    '| TBA | To Be Announced |',
    '',
    '---',
    '',
  ].join('\n')

  const sections = [
    buildUrgentSection(conferences),
    '',
    '---',
    '',
    buildMainTable(conferences),
    '',
    '---',
    '',
    buildRollingTable(rollingVenues),
    '',
    '---',
    '',
    AREA_REFERENCE,
    '',
    '---',
    '',
    NOTES,
    '',
    '---',
    '',
    `*Tracker auto-generated by CFP Monitor. Sources: Official conference websites, USENIX, ACM, IEEE, ISOC, aideadlin.es. Auto-refreshed Mon + Thu at 8:00 AM CDT.*`,
    '',
  ].join('\n')

  return header + sections
}
