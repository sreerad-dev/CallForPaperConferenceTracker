import type { Conference, Format, Ranking, RollingVenue, SubmissionModel } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip markdown formatting → plain text */
function stripMarkdown(cell: string): string {
  return cell
    .replace(/\*\*([^*]+)\*\*/g, '$1')        // **bold**
    .replace(/\*([^*]+)\*/g, '$1')             // *italic*
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [text](url) → text
    .replace(/~~([^~]+)~~/g, '$1')             // ~~strikethrough~~
    .replace(/⚠️/g, '')
    .replace(/🔄/g, '')
    .replace(/🏆/g, '')
    .replace(/🥇/g, '')
    .replace(/🥈/g, '')
    .replace(/✅/g, '')
    .replace(/🏢/g, '')
    .trim()
}

/** Extract href from a markdown link [text](url) */
function extractHref(cell: string): string {
  const m = cell.match(/\[([^\]]+)\]\(([^)]+)\)/)
  return m ? m[2] : '#'
}

/**
 * Determine if a cell's deadline has passed (strikethrough syntax).
 * ~~date~~ means passed.
 */
function isCellPassed(raw: string): boolean {
  // Cell is passed if the date content is wrapped in ~~...~~
  return /~~[^~]+~~/.test(raw)
}

/**
 * Determine if a cell has the ⚠️ upcoming marker.
 */
function isCellUpcoming(raw: string): boolean {
  return raw.includes('⚠️')
}

/**
 * Parse a date string from a cell.
 * Handles:
 *   "~~Sep 16, 2025~~"           → "2025-09-16"
 *   "⚠️ May 25, 2026 (ARR)"     → "2026-05-25"
 *   "May 25, 2026 (ARR)"         → "2026-05-25"
 *   "Rolling (by Jun 15, 2026)"  → "2026-06-15"
 *   "Jul 15, 2026 (Cycle C)"     → "2026-07-15"
 *   "Sep 16, 2026 (est.)"        → "2026-09-16"
 *   "TBA", "N/A", "Rolling ..." → null
 */
function parseDate(raw: string): string | null {
  // Strip all markdown/emoji decoration
  let s = raw
    .replace(/~~([^~]*)~~/g, '$1')   // unwrap strikethrough
    .replace(/⚠️/g, '')
    .replace(/\*\*/g, '')
    .trim()

  if (!s || s.startsWith('TBA') || s.startsWith('N/A')) return null

  // Rolling with an embedded "by <date>" → extract it
  const rollingBy = s.match(/by\s+([A-Za-z]+ \d{1,2},?\s*\d{4})/i)
  if (rollingBy) {
    const d = new Date(rollingBy[1])
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }

  if (s.startsWith('Rolling') || s.startsWith('~2 months')) return null

  // Strip trailing parentheticals like "(ARR)", "(est.)", "(Cycle C)", "(Fall)"
  s = s.replace(/\([^)]*\)/g, '').trim()

  // Date range "Feb 24–26, 2026" or "Aug 31–Sep 4, 2026" → take first date
  const rangeA = s.match(/^([A-Za-z]+ \d{1,2})[–\-]\d{1,2},\s*(\d{4})/)
  if (rangeA) {
    const d = new Date(`${rangeA[1]}, ${rangeA[2]}`)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  const rangeB = s.match(/^([A-Za-z]+ \d{1,2})\s*[–\-]\s*[A-Za-z]+ \d{1,2},\s*(\d{4})/)
  if (rangeB) {
    const d = new Date(`${rangeB[1]}, ${rangeB[2]}`)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }

  // Direct parse
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]

  // Extract "Month Day, Year" pattern as fallback
  const m = s.match(/([A-Za-z]+ \d{1,2},?\s*\d{4})/)
  if (m) {
    const d2 = new Date(m[1])
    if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0]
  }

  return null
}

function parseRanking(raw: string): Ranking {
  if (raw.includes('🏆') || raw.includes('A*')) return 'A*'
  if (raw.includes('🥇') || raw.match(/\bA\b/)) return 'A'
  if (raw.includes('🥈') || raw.match(/\bB\b/)) return 'B'
  const lower = raw.toLowerCase()
  if (lower.includes('workshop')) return 'Workshop'
  if (lower.includes('industry')) return 'Industry'
  if (lower.includes('tutorial')) return 'Tutorial'
  if (lower.includes('new venue')) return 'New venue'
  return 'Unknown'
}

function parseFormat(raw: string): Format {
  if (raw.includes('✅') || raw.toLowerCase().includes('hybrid')) return 'Hybrid'
  if (raw.includes('🏢') || raw.toLowerCase().includes('in-person')) return 'In-person'
  return 'Unknown'
}

function parseSubmissionModel(raw: string): SubmissionModel {
  const lower = raw.toLowerCase()
  if (lower.includes('🔄') || lower.includes('rolling') || lower.includes('monthly') || lower.includes('quarterly')) return 'Rolling'
  if (lower.includes('arr')) return 'ARR'
  if (lower.includes('talk')) return 'Talk proposals'
  if (lower.includes('fixed')) return 'Fixed'
  return 'Unknown'
}

// ---------------------------------------------------------------------------
// Row parser — splits pipe-delimited rows, respecting parentheses depth
// ---------------------------------------------------------------------------

function parseRow(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let depth = 0
  for (const ch of line) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === '|' && depth === 0) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  // Remove the empty first and last cells from outer pipes
  return cells.filter((_, i) => i > 0 && i < cells.length - 1)
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s\-|:]+\|$/.test(line.trim())
}

// ---------------------------------------------------------------------------
// Exported types & main parser
// ---------------------------------------------------------------------------

export interface ParsedData {
  conferences: Conference[]
  rollingVenues: RollingVenue[]
  lastRefreshed: string
  totalRecords: number
  urgentDeadlines: { name: string; deadlineType: string; date: string; daysRemaining: string }[]
}

export function parseCfpMarkdown(markdown: string): ParsedData {
  const lines = markdown.split('\n')

  // --- Metadata ---
  const refreshMatch = markdown.match(/\*\*Last Refreshed:\*\*\s*([^\n>]+)/)
  const lastRefreshed = refreshMatch ? refreshMatch[1].trim() : ''

  const totalMatch = markdown.match(/\*\*Total Records:\*\*\s*(\d+)/)
  const totalRecords = totalMatch ? parseInt(totalMatch[1], 10) : 0

  const conferences: Conference[] = []
  const rollingVenues: RollingVenue[] = []
  const urgentDeadlines: ParsedData['urgentDeadlines'] = []

  const today = new Date()
  const in30Days = new Date(today)
  in30Days.setDate(today.getDate() + 30)

  type Section = 'none' | 'urgent' | 'main' | 'rolling'
  let section: Section = 'none'
  let headerParsed = false

  for (const line of lines) {
    const trimmed = line.trim()

    // --- Section detection ---
    if (trimmed.startsWith('## ')) {
      headerParsed = false
      if (trimmed.includes('Urgent') || trimmed.includes('⚠️')) {
        section = 'urgent'
      } else if (trimmed.includes('Comprehensive CFP Table')) {
        section = 'main'
      } else if (trimmed.includes('Rolling') || trimmed.includes('🔄')) {
        section = 'rolling'
      } else {
        section = 'none'
      }
      continue
    }

    // --- Separator row marks end of header ---
    if (isSeparatorRow(trimmed)) {
      headerParsed = true
      continue
    }

    if (!headerParsed || !trimmed.startsWith('|')) continue

    // --- Urgent deadlines table ---
    // Columns: Conference | Deadline Type | Date | Days Remaining
    if (section === 'urgent') {
      const cells = parseRow(trimmed)
      if (cells.length >= 4) {
        urgentDeadlines.push({
          name: stripMarkdown(cells[0]),
          deadlineType: stripMarkdown(cells[1]),
          date: stripMarkdown(cells[2]),
          daysRemaining: stripMarkdown(cells[3]),
        })
      }
      continue
    }

    // --- Main CFP table ---
    // Columns (14): # | Conference/Workshop | Host Org | Research Area | Location |
    //               Abstract Deadline | Full Paper Deadline | Notification |
    //               Camera-Ready | Event Date | Ranking | Submission Model | CFP URL | Format
    if (section === 'main') {
      const cells = parseRow(trimmed)
      if (cells.length < 14) continue

      const [
        idCell,
        nameCell,
        hostCell,
        areaCell,
        locationCell,
        abstractCell,
        fullPaperCell,
        notificationCell,
        cameraReadyCell,
        eventDateCell,
        rankingCell,
        submissionCell,
        cfpCell,
        formatCell,
      ] = cells

      const id = parseInt(idCell, 10)
      if (isNaN(id)) continue

      const abstractDeadline = parseDate(abstractCell)
      const fullPaperDeadline = parseDate(fullPaperCell)

      // Passed: full paper cell is struck-through (or abstract if no full paper)
      const passed = isCellPassed(fullPaperCell) ||
        (!fullPaperDeadline && isCellPassed(abstractCell))

      // Upcoming: ⚠️ marker present, or deadline falls within 30 days and not passed
      const deadlineDate = fullPaperDeadline
        ? new Date(fullPaperDeadline)
        : abstractDeadline
        ? new Date(abstractDeadline)
        : null

      const upcoming = !passed && (
        isCellUpcoming(fullPaperCell) ||
        isCellUpcoming(abstractCell) ||
        (deadlineDate !== null && deadlineDate >= today && deadlineDate <= in30Days)
      )

      const submissionRaw = submissionCell.trim()
      const isRolling =
        submissionRaw.includes('🔄') ||
        submissionRaw.toLowerCase().includes('rolling')

      conferences.push({
        id,
        name: stripMarkdown(nameCell),
        hostOrg: stripMarkdown(hostCell),
        area: stripMarkdown(areaCell),
        location: stripMarkdown(locationCell),
        abstractDeadline,
        fullPaperDeadline,
        notification: parseDate(notificationCell),
        cameraReady: parseDate(cameraReadyCell),
        eventDate: stripMarkdown(eventDateCell),
        ranking: parseRanking(rankingCell),
        rankingRaw: stripMarkdown(rankingCell),
        submissionModel: parseSubmissionModel(submissionRaw),
        cfpUrl: extractHref(cfpCell),
        format: parseFormat(formatCell),
        isUpcoming: upcoming,
        isPassed: passed,
        isRolling,
      })
      continue
    }

    // --- Rolling venues table ---
    // Columns (6): Venue | Host Org | Area | Submission Cycle | Next Deadline | CFP URL
    if (section === 'rolling') {
      const cells = parseRow(trimmed)
      if (cells.length >= 6) {
        rollingVenues.push({
          venue: stripMarkdown(cells[0]),
          cycle: stripMarkdown(cells[3]),
          nextDeadline: stripMarkdown(cells[4]),
          notes: stripMarkdown(cells[2]),
        })
      }
      continue
    }
  }

  return { conferences, rollingVenues, lastRefreshed, totalRecords, urgentDeadlines }
}
