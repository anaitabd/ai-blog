'use client'

import { useEffect, useState, useCallback } from 'react'
import type { PipelineItem } from '@/app/api/admin/pipeline/route'

const POLL_INTERVAL_MS = 4000   // poll every 4 s for snappy step updates

function elapsed(isoString: string | null): string {
  if (!isoString) return '—'
  const diffMs = Date.now() - new Date(isoString).getTime()
  const secs   = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

function duration(start: string | null, end: string | null): string {
  if (!start) return '—'
  const endMs = end ? new Date(end).getTime() : Date.now()
  const secs  = Math.floor((endMs - new Date(start).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

const STATUS_META: Record<string, { dot: string; badge: string; label: string }> = {
  PROCESSING: { dot: 'bg-blue-500 animate-pulse',  badge: 'bg-blue-50 text-blue-700 border-blue-200',   label: 'Running'  },
  DONE:       { dot: 'bg-green-500',               badge: 'bg-green-50 text-green-700 border-green-200', label: 'Done'     },
  FAILED:     { dot: 'bg-red-500',                 badge: 'bg-red-50 text-red-700 border-red-200',       label: 'Failed'   },
  PENDING:    { dot: 'bg-yellow-400',              badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Pending' },
}

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const s = STATUS_META[status] ?? STATUS_META.DONE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

// Animated progress bar for running items – cycles through known step names
const STEP_LABELS = [
  'Pipeline starting…',
  'Fetching trends…',
  'Generating content…',
  'Quality check…',
  'Generating featured image…',
  'Publishing to Next.js…',
  'Generating YouTube Shorts…',
  'Publishing Shorts…',
  'Notifying subscribers…',
]

function stepPercent(step: string | null): number {
  if (!step) return 5
  const idx = STEP_LABELS.findIndex((s) => step.toLowerCase().includes(s.toLowerCase().slice(0, 12)))
  return idx >= 0 ? Math.round(((idx + 1) / STEP_LABELS.length) * 95) : 50
}

function RunningRow({ item }: Readonly<{ item: PipelineItem }>) {
  const pct = stepPercent(item.currentStep)
  return (
    <tr className="bg-blue-50/40 border-b border-blue-100">
      <td className="px-6 py-4" colSpan={5}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            {/* keyword + category */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-[#1A1A2E] truncate max-w-xs">{item.keyword}</span>
              {item.category && (
                <span className="text-xs bg-[#0B1628]/10 text-[#0B1628] px-2 py-0.5 rounded-full">{item.category}</span>
              )}
              <StatusBadge status={item.status} />
            </div>
            {/* current step */}
            <p className="text-xs text-blue-700 font-medium mb-2">
              ⚙ {item.currentStep ?? 'Initialising…'}
              {item.stepUpdatedAt && (
                <span className="text-blue-400 font-normal ml-1">· {elapsed(item.stepUpdatedAt)}</span>
              )}
            </p>
            {/* progress bar */}
            <div className="w-full bg-blue-200/50 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted">Duration</div>
            <div className="text-sm font-semibold text-[#1A1A2E] tabular-nums">
              {duration(item.processingAt, null)}
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

function PipelineTable({ items }: Readonly<{ items: PipelineItem[] }>) {
  const running  = items.filter((i) => i.status === 'PROCESSING')
  const finished = items.filter((i) => i.status !== 'PROCESSING')

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#fafafa] border-b border-border">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Keyword</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Last Step / Error</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Duration</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Completed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {/* Running items get their own expanded row */}
          {running.map((item) => <RunningRow key={item.id} item={item} />)}

          {/* Finished items */}
          {finished.map((item) => (
            <tr key={item.id} className="hover:bg-[#fafafa] transition-colors">
              <td className="px-6 py-4">
                <div className="font-medium text-[#1A1A2E] truncate max-w-[200px]">{item.keyword}</div>
                {item.category && <div className="text-xs text-muted mt-0.5">{item.category}</div>}
              </td>
              <td className="px-4 py-4"><StatusBadge status={item.status} /></td>
              <td className="px-4 py-4 max-w-[220px]">
                {item.status === 'FAILED' && item.failReason
                  ? <span className="text-xs text-red-600 line-clamp-2">{item.failReason}</span>
                  : <span className="text-xs text-muted truncate block">{item.currentStep ?? (item.status === 'DONE' ? 'Published ✓' : '—')}</span>
                }
              </td>
              <td className="px-4 py-4 text-xs text-muted whitespace-nowrap tabular-nums">
                {duration(item.processingAt, item.processedAt)}
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

  const running  = items.filter((i) => i.status === 'PROCESSING').length
  const finished = items.filter((i) => i.status !== 'PROCESSING').length

  return (
    <div className="bg-white rounded-2xl border border-border">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-[#1A1A2E]">Pipeline Activity</h3>
          {running > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-semibold bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              {running} running
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted">Updated {elapsed(lastUpdated)}</span>
          )}
          <span className="text-xs text-muted bg-gray-100 px-2 py-0.5 rounded">Live · 4s</span>
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="px-6 py-10 text-center text-sm text-muted animate-pulse">Loading pipeline…</div>
      )}
      {!loading && error && (
        <div className="px-6 py-6 text-sm text-red-600">
          ⚠️ Could not load pipeline data: {error}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-muted">No pipeline runs in the last 24 hours.</p>
          <p className="text-xs text-muted mt-1">Trigger a run using the button above.</p>
        </div>
      )}
      {!loading && !error && items.length > 0 && <PipelineTable items={items} />}

      {/* Footer */}
      {!loading && (running > 0 || finished > 0) && (
        <div className="px-6 py-3 border-t border-border flex items-center justify-between text-xs text-muted">
          <span>{running > 0 ? `${running} running · ` : ''}{finished} completed in the last 24h</span>
          <span>Auto-refreshes every 4 seconds</span>
        </div>
      )}
    </div>
  )
}
