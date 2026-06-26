import clsx from 'clsx'
import type { Ranking } from '../types'

interface Props {
  ranking: Ranking
}

const config: Record<Ranking, { label: string; className: string }> = {
  'A*': { label: '🏆 A*', className: 'bg-purple-100 text-purple-800' },
  'A':  { label: '🥇 A',  className: 'bg-blue-100 text-blue-800' },
  'B':  { label: '🥈 B',  className: 'bg-teal-100 text-teal-800' },
  'Workshop':  { label: 'Workshop',  className: 'bg-gray-100 text-gray-600' },
  'Industry':  { label: 'Industry',  className: 'bg-amber-100 text-amber-700' },
  'Tutorial':  { label: 'Tutorial',  className: 'bg-sky-100 text-sky-700' },
  'New venue': { label: 'New',       className: 'bg-pink-100 text-pink-700' },
  'Unknown':   { label: '—',         className: 'bg-gray-50 text-gray-400' },
}

export function RankingBadge({ ranking }: Props) {
  const { label, className } = config[ranking] ?? config['Unknown']
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap', className)}>
      {label}
    </span>
  )
}
