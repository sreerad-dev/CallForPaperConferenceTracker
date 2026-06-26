import { differenceInDays, parseISO } from 'date-fns'
import type { Conference } from '../types'
import { RankingBadge } from './RankingBadge'
import { ExternalLink } from 'lucide-react'

interface Props {
  conferences: Conference[]
}

interface DeadlineEntry {
  conf: Conference
  date: string
  type: 'Abstract' | 'Full Paper'
  daysLeft: number
}

export function UpcomingPanel({ conferences }: Props) {
  const today = new Date()
  const in30 = new Date(today)
  in30.setDate(today.getDate() + 30)

  const entries: DeadlineEntry[] = []

  for (const conf of conferences) {
    if (conf.isPassed) continue

    const check = (dateStr: string | null, type: 'Abstract' | 'Full Paper') => {
      if (!dateStr) return
      const d = parseISO(dateStr)
      if (d >= today && d <= in30) {
        entries.push({ conf, date: dateStr, type, daysLeft: differenceInDays(d, today) })
      }
    }

    check(conf.abstractDeadline, 'Abstract')
    check(conf.fullPaperDeadline, 'Full Paper')
  }

  // Deduplicate and sort by date
  const seen = new Set<string>()
  const unique = entries
    .filter(e => {
      const key = `${e.conf.id}-${e.type}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)

  if (unique.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500 text-sm">
        No deadlines in the next 30 days.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          ⏰ Upcoming Deadlines
          <span className="text-xs font-normal text-gray-500">(next 30 days)</span>
        </h2>
        <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
          {unique.length}
        </span>
      </div>
      <ul className="divide-y divide-gray-50">
        {unique.map((entry, i) => {
          const urgency =
            entry.daysLeft <= 3
              ? 'border-l-4 border-red-400 bg-red-50'
              : entry.daysLeft <= 7
              ? 'border-l-4 border-orange-400 bg-orange-50'
              : entry.daysLeft <= 14
              ? 'border-l-4 border-yellow-400 bg-yellow-50'
              : 'border-l-4 border-green-300 bg-white'

          return (
            <li key={i} className={`px-5 py-3 flex items-start justify-between gap-4 ${urgency}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={entry.conf.cfpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm text-gray-900 hover:text-blue-600 flex items-center gap-1 truncate"
                  >
                    {entry.conf.name}
                    <ExternalLink size={11} className="shrink-0 opacity-50" />
                  </a>
                  <RankingBadge ranking={entry.conf.ranking} />
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {entry.type} · {entry.conf.area}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-medium text-gray-700">
                  {formatDate(entry.date)}
                </div>
                <div className={`text-xs font-bold mt-0.5 ${
                  entry.daysLeft <= 3 ? 'text-red-600' :
                  entry.daysLeft <= 7 ? 'text-orange-600' :
                  entry.daysLeft <= 14 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {entry.daysLeft === 0 ? 'Today' : `${entry.daysLeft}d`}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function formatDate(iso: string): string {
  return parseISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
