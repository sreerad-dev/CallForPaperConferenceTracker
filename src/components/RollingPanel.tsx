import type { RollingVenue } from '../types'

interface Props {
  venues: RollingVenue[]
}

export function RollingPanel({ venues }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          🔄 Rolling / Continuous Submission Venues
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Venue', 'Area', 'Submission Cycle', 'Next Deadline'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {venues.map((v, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{v.venue}</td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">{v.notes}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{v.cycle}</td>
                <td className="px-4 py-3 text-gray-700 text-xs font-semibold">{v.nextDeadline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
