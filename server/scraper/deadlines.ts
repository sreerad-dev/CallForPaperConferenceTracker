/**
 * Deadline computation utilities.
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** Format an ISO date string as "Mon DD, YYYY" */
export function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

/** Return today's date at UTC midnight */
function today(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

/** Days between today and a future ISO date. Negative if in the past. */
export function daysUntil(iso: string): number {
  const t = today()
  const target = new Date(iso + 'T00:00:00Z')
  return Math.round((target.getTime() - t.getTime()) / 86_400_000)
}

/** True if ISO date is in the past (strictly before today) */
export function isPast(iso: string | null): boolean {
  if (!iso) return false
  return daysUntil(iso) < 0
}

/** True if ISO date is within [0, 30] days from today */
export function isWithin30Days(iso: string | null): boolean {
  if (!iso) return false
  const d = daysUntil(iso)
  return d >= 0 && d <= 30
}

export interface RollingSchedule {
  strategy: 'monthly-first' | 'monthly-day' | 'quarterly'
  monthlyDay?: number
  quarterlyMonths?: number[]
  quarterlyDay?: number
}

/**
 * Compute the next upcoming deadline for a rolling schedule.
 */
export function computeNextDeadline(schedule: RollingSchedule): string {
  const t = today()

  if (schedule.strategy === 'monthly-day' && schedule.monthlyDay) {
    let candidate = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), schedule.monthlyDay))
    if (candidate < t) {
      candidate = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, schedule.monthlyDay))
    }
    return formatDate(candidate.toISOString().split('T')[0])
  }

  if (schedule.strategy === 'monthly-first') {
    let candidate = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))
    if (candidate < t) {
      candidate = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1))
    }
    return formatDate(candidate.toISOString().split('T')[0])
  }

  if (schedule.strategy === 'quarterly' && schedule.quarterlyMonths && schedule.quarterlyDay) {
    const candidates: Date[] = []
    const year = t.getUTCFullYear()
    for (const yr of [year, year + 1]) {
      for (const month of schedule.quarterlyMonths) {
        candidates.push(new Date(Date.UTC(yr, month - 1, schedule.quarterlyDay)))
      }
    }
    const upcoming = candidates.filter(d => d >= t).sort((a, b) => a.getTime() - b.getTime())
    if (upcoming.length === 0) return 'TBA'
    return formatDate(upcoming[0].toISOString().split('T')[0])
  }

  return 'TBA'
}
