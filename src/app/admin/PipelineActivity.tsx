'use client'

import { useEffect, useState, useCallback } from 'react'
import type { PipelineItem } from '@/app/api/admin/pipeline/route'

const POLL_INTERVAL_MS = 5000

function elapsed(isoString: string | null): string {
  if (!isoString) return '—'
  const diffMs = Date.now() - new Date(isoString).getTime()
  const secs   = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  PROCESSING: {
    dot:   'bg-blue-500 animate-pulse',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    label: 'Running',
  },
  DONE: {
    dot:   'bg-green-500',
    badge: 'bg-green-100 text-green-700 border-green-200',
    label: 'Done',
  },
  FAILED: {
    dot:   'bg-red-500',
    badge: 'bg-red-100 text-red-700 border-red-200',
    label: 'Failed',
  },
}

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const styles = STATUS_STYLES[status] ?? STATUS_STYLES.DONE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
      {styles.label}
    </span>
  )
}

function PipelineTable({ items }: Readonly<{ items: PipelineItem[] }>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#fafafa] border-b border-border">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Keyword</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Current Step</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-[#fafafa] transition-colors">
              <td className="px-6 py-4">
                <div className="font-medium text-[#1A1A2E] truncate max-w-[220px]">{item.keyword}</div>
                {item.source && (
                  <div className="text-xs text-muted mt-0.5 capitalize">{item.source}</div>
                )}
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-4 py-4">
                {item.status === 'FAILED' && item.failReason
                  ? <span className="text-xs text-red-600 line-clamp-2">{item.failReason}</span>
                  : <span className="text-xs text-muted">{item.currentStep ?? (item.status === 'DONE' ? 'Published ✓' : '—')}</span>
                }
              </td>
              <td className="px-4 py-4 text-xs text-muted whitespace-nowrap">
                {elapsed(item.processedAt ?? item.processingAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PipelineActivity({ adminKey }: Readonly<{ adminKey: string }>) {
  const [items, setItems]             = useState<PipelineItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pipeline', {
        headers: { 'x-admin-key': adminKey },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(data.items ?? [])
      setLastUpdated(data.updatedAt)
      setError(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [adminKey])

  useEffect(() => {
    fetchPipeline()
    const id = setInterval(fetchPipeline, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchPipeline])

  const running = items.filter((i) => i.status === 'PROCESSING').length
  const recent  = items.filter((i) => i.status !== 'PROCESSING').length

  return (
    <div className="bg-white rounded-2xl border border-border">

      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-[#1A1A2E]">Pipeline Activity</h3>
          {running > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-medium">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              {running} running
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted">Updated {elapsed(lastUpdated)}</span>
          )}
          <span className="text-xs text-muted">Last 24h</span>
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="px-6 py-10 text-center text-sm text-muted animate-pulse">
          Loading pipeline data…
        </div>
      )}
      {!loading && error && (
        <div className="px-6 py-6 text-sm text-red-600">
          ⚠️ Could not load pipeline data. Check ADMIN_API_KEY env var.
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="px-6 py-10 text-sm text-center text-muted">
          No pipeline runs in the last 24 hours.
        </p>
      )}
      {!loading && !error && items.length > 0 && <PipelineTable items={items} />}

      {/* Footer */}
      {!loading && (running > 0 || recent > 0) && (
        <div className="px-6 py-3 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted">
            {running} running · {recent} completed in the last 24h
          </p>
          <p className="text-xs text-muted">Auto-refreshes every 5 seconds</p>
        </div>
      )}

    </div>
  )
}
