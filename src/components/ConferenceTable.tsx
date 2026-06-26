import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import type { SortingState, ColumnFiltersState } from '@tanstack/react-table'
import { useState, useMemo } from 'react'
import type { Conference } from '../types'
import { DeadlineBadge } from './DeadlineBadge'
import { RankingBadge } from './RankingBadge'
import { ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  conferences: Conference[]
}

const col = createColumnHelper<Conference>()

export function ConferenceTable({ conferences }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [showPassed, setShowPassed] = useState(false)

  const filtered = useMemo(
    () => (showPassed ? conferences : conferences.filter(c => !c.isPassed)),
    [conferences, showPassed]
  )

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Conference',
        cell: info => (
          <div className="flex flex-col gap-0.5 min-w-[180px]">
            <a
              href={info.row.original.cfpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sm text-blue-700 hover:text-blue-900 flex items-center gap-1"
            >
              {info.getValue()}
              <ExternalLink size={11} className="opacity-40 shrink-0" />
            </a>
            <span className="text-xs text-gray-500">{info.row.original.hostOrg}</span>
          </div>
        ),
      }),
      col.accessor('area', {
        header: 'Area',
        cell: info => (
          <span className="text-xs text-gray-600 max-w-[140px] block">{info.getValue()}</span>
        ),
      }),
      col.accessor('location', {
        header: 'Location',
        cell: info => (
          <span className="text-xs text-gray-600 whitespace-nowrap">{info.getValue()}</span>
        ),
      }),
      col.accessor('abstractDeadline', {
        header: 'Abstract',
        cell: info => (
          <DeadlineBadge
            dateStr={info.getValue()}
            isPassed={info.row.original.isPassed}
            isRolling={info.row.original.isRolling && !info.getValue()}
          />
        ),
        sortingFn: (a, b) => {
          const da = a.original.abstractDeadline ?? '9999'
          const db = b.original.abstractDeadline ?? '9999'
          return da.localeCompare(db)
        },
      }),
      col.accessor('fullPaperDeadline', {
        header: 'Full Paper',
        cell: info => (
          <DeadlineBadge
            dateStr={info.getValue()}
            isPassed={info.row.original.isPassed}
            isRolling={info.row.original.isRolling && !info.getValue()}
          />
        ),
        sortingFn: (a, b) => {
          const da = a.original.fullPaperDeadline ?? '9999'
          const db = b.original.fullPaperDeadline ?? '9999'
          return da.localeCompare(db)
        },
      }),
      col.accessor('eventDate', {
        header: 'Event',
        cell: info => (
          <span className="text-xs text-gray-600 whitespace-nowrap">{info.getValue()}</span>
        ),
      }),
      col.accessor('ranking', {
        header: 'Rank',
        cell: info => <RankingBadge ranking={info.getValue()} />,
        filterFn: (row, _id, filterValue) =>
          filterValue === 'All' || row.original.ranking === filterValue,
      }),
      col.accessor('format', {
        header: 'Format',
        cell: info => {
          const f = info.getValue()
          return (
            <span className={clsx(
              'text-xs px-1.5 py-0.5 rounded',
              f === 'Hybrid' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'
            )}>
              {f === 'Hybrid' ? '✅ Hybrid' : f === 'In-person' ? '🏢 In-person' : '—'}
            </span>
          )
        },
        filterFn: (row, _id, filterValue) =>
          filterValue === 'All' || row.original.format === filterValue,
      }),
    ],
    []
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const rankingOptions = ['All', 'A*', 'A', 'B', 'Workshop', 'Industry', 'New venue']
  const formatOptions = ['All', 'Hybrid', 'In-person']

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search conferences, areas, locations…"
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className="flex-1 min-w-[200px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />

        {/* Ranking filter */}
        <select
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={(table.getColumn('ranking')?.getFilterValue() as string) ?? 'All'}
          onChange={e => table.getColumn('ranking')?.setFilterValue(e.target.value)}
        >
          {rankingOptions.map(r => (
            <option key={r} value={r}>{r === 'All' ? 'All Rankings' : r}</option>
          ))}
        </select>

        {/* Format filter */}
        <select
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={(table.getColumn('format')?.getFilterValue() as string) ?? 'All'}
          onChange={e => table.getColumn('format')?.setFilterValue(e.target.value)}
        >
          {formatOptions.map(f => (
            <option key={f} value={f}>{f === 'All' ? 'All Formats' : f}</option>
          ))}
        </select>

        {/* Show passed toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPassed}
            onChange={e => setShowPassed(e.target.checked)}
            className="rounded"
          />
          Show passed
        </label>

        <span className="text-xs text-gray-400 ml-auto">
          {table.getRowModel().rows.length} of {conferences.length} entries
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        className={clsx(
                          'flex items-center gap-1',
                          header.column.getCanSort() && 'cursor-pointer hover:text-gray-900'
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          header.column.getIsSorted() === 'asc' ? <ArrowUp size={12} /> :
                          header.column.getIsSorted() === 'desc' ? <ArrowDown size={12} /> :
                          <ArrowUpDown size={12} className="opacity-30" />
                        )}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className={clsx(
                  'hover:bg-gray-50 transition-colors',
                  row.original.isUpcoming && 'bg-yellow-50/40',
                  row.original.isPassed && 'opacity-50'
                )}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {table.getRowModel().rows.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No conferences match your filters.
          </div>
        )}
      </div>
    </div>
  )
}
