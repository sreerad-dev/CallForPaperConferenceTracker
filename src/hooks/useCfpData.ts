import { useEffect, useState, useCallback } from 'react'
import { parseCfpMarkdown } from '../utils/parseMarkdown'
import type { ParsedData } from '../utils/parseMarkdown'

const MD_URL = '/api/cfp-tracker.md'
const MD_URL_FALLBACK = '/cfp-tracker.md'
const POLL_INTERVAL_MS = 30_000

interface UseCfpDataResult extends Partial<ParsedData> {
  loading: boolean
  error: string | null
  lastFetched: Date | null
  refresh: () => void
}

export function useCfpData(): UseCfpDataResult {
  const [data, setData] = useState<ParsedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    try {
      let res = await fetch(`${MD_URL}?t=${Date.now()}`)
      if (!res.ok) {
        res = await fetch(`${MD_URL_FALLBACK}?t=${Date.now()}`)
      }
      if (!res.ok) throw new Error(`Failed to load cfp_tracker.md (${res.status})`)
      const text = await res.text()
      const parsed = parseCfpMarkdown(text)
      setData(parsed)
      setError(null)
      setLastFetched(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const interval = setInterval(fetchData, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchData])

  return {
    conferences: data?.conferences,
    rollingVenues: data?.rollingVenues,
    urgentDeadlines: data?.urgentDeadlines,
    lastRefreshed: data?.lastRefreshed,
    totalRecords: data?.totalRecords,
    loading,
    error,
    lastFetched,
    refresh: fetchData,
  }
}
