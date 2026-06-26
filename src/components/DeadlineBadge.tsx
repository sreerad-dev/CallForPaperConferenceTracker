import { differenceInDays, parseISO } from 'date-fns'
import clsx from 'clsx'

interface Props {
  dateStr: string | null
  isPassed?: boolean
  isRolling?: boolean
}

export function DeadlineBadge({ dateStr, isPassed, isRolling }: Props) {
  if (isRolling) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
        🔄 Rolling
      </span>
    )
  }

  if (!dateStr) {
    return <span className="text-gray-400 text-xs">TBA</span>
  }

  if (isPassed) {
    return (
      <span className="text-gray-400 text-xs line-through">
        {formatDate(dateStr)}
      </span>
    )
  }

  const today = new Date()
  const deadline = parseISO(dateStr)
  const daysLeft = differenceInDays(deadline, today)

  const color =
    daysLeft < 0
      ? 'bg-gray-100 text-gray-400'
      : daysLeft <= 7
      ? 'bg-red-100 text-red-700'
      : daysLeft <= 14
      ? 'bg-orange-100 text-orange-700'
      : daysLeft <= 30
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-green-50 text-green-700'

  return (
    <span className={clsx('inline-flex flex-col items-start gap-0.5')}>
      <span className="text-xs font-medium">{formatDate(dateStr)}</span>
      {daysLeft >= 0 && (
        <span className={clsx('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold', color)}>
          {daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
        </span>
      )}
    </span>
  )
}

function formatDate(iso: string): string {
  const d = parseISO(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
