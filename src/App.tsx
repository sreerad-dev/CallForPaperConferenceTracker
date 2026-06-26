import { useState, useCallback } from 'react'
import { useCfpData } from './hooks/useCfpData'
import { UpcomingPanel } from './components/UpcomingPanel'
import { ConferenceTable } from './components/ConferenceTable'
import { Charts } from './components/Charts'
import { RollingPanel } from './components/RollingPanel'
import { RefreshCw, AlertCircle, Zap } from 'lucide-react'

type Tab = 'overview' | 'table' | 'rolling'

export default function App() {
  const { conferences, rollingVenues, lastRefreshed, loading, error, lastFetched, refresh } = useCfpData()
  const [tab, setTab] = useState<Tab>('overview')
  const [scraping, setScraping] = useState(false)
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null)

  const upcomingCount = conferences?.filter(c => c.isUpcoming).length ?? 0

  /** Trigger a full backend rescrape then reload the md */
  const triggerScrape = useCallback(async () => {
    setScraping(true)
    setScrapeMsg(null)
    try {
      const res = await fetch('/api/refresh', { method: 'POST' })
      const json = await res.json() as { ok: boolean; message: string }
      setScrapeMsg(json.message)
      if (json.ok) {
        // Give the file a moment to be written, then reload data
        setTimeout(() => { refresh(); setScrapeMsg(null) }, 800)
      }
    } catch {
      setScrapeMsg('Refresh endpoint unreachable')
    } finally {
      setScraping(false)
    }
  }, [refresh])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">📅 CFP Tracker</h1>
            <p className="text-xs text-gray-500">
              Data Engineering · AI · Large-Scale Systems
              {lastRefreshed && <span className="ml-2 text-gray-400">· Last refreshed: {lastRefreshed}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {scrapeMsg && (
              <span className={`text-xs hidden sm:block ${scrapeMsg.includes('failed') || scrapeMsg.includes('unreachable') ? 'text-red-500' : 'text-green-600'}`}>
                {scrapeMsg}
              </span>
            )}
            {lastFetched && (
              <span className="text-xs text-gray-400 hidden sm:block">
                Fetched {lastFetched.toLocaleTimeString()}
              </span>
            )}
            {/* Manual scrape trigger — runs full backend refresh */}
            <button
              onClick={triggerScrape}
              disabled={scraping}
              title="Regenerate data from sources (auto-runs Mon & Thu)"
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors disabled:opacity-50"
            >
              <Zap size={13} className={scraping ? 'animate-pulse' : ''} />
              {scraping ? 'Scraping…' : 'Scrape Now'}
            </button>
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 pb-0">
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'table',    label: `All Conferences (${conferences?.length ?? 0})` },
            { id: 'rolling',  label: 'Rolling Submissions' },
          ] as { id: Tab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24 text-gray-400 text-sm gap-3">
            <RefreshCw size={16} className="animate-spin" />
            Loading cfp_tracker.md…
          </div>
        )}

        {!loading && conferences && (
          <>
            {tab === 'overview' && (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard label="Total Venues" value={conferences.length} color="indigo" />
                  <StatCard label="Upcoming (30d)" value={upcomingCount} color="yellow" />
                  <StatCard label="A* Venues" value={conferences.filter(c => c.ranking === 'A*').length} color="purple" />
                  <StatCard label="Hybrid Options" value={conferences.filter(c => c.format === 'Hybrid').length} color="green" />
                </div>

                {/* Charts */}
                <Charts conferences={conferences} />

                {/* Upcoming deadlines */}
                <UpcomingPanel conferences={conferences} />
              </>
            )}

            {tab === 'table' && (
              <ConferenceTable conferences={conferences} />
            )}

            {tab === 'rolling' && rollingVenues && (
              <RollingPanel venues={rollingVenues} />
            )}
          </>
        )}
      </main>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    green:  'bg-green-50 text-green-700 border-green-100',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
    </div>
  )
}
