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
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function duration(start: string | null, end?: string | null): string {
  if (!start) return '—'
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  const diffMs = e - s
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ${secs % 60}s`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
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

interface LogEvent {
  timestamp: string
  type: string
  step?: string
  detail?: string
  error?: string
  cause?: string
}

interface ExecutionLog {
  executionArn: string
  name: string
  status: string
  startDate: string
  stopDate?: string
  events: LogEvent[]
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

const EVENT_TYPE_LABELS: Record<string, { icon: string; color: string }> = {
  ExecutionStarted:    { icon: '🚀', color: 'text-blue-600' },
  TaskStateEntered:    { icon: '▶️', color: 'text-blue-600' },
  TaskStarted:         { icon: '⏳', color: 'text-gray-500' },
  TaskSucceeded:       { icon: '✅', color: 'text-green-600' },
  TaskFailed:          { icon: '❌', color: 'text-red-600' },
  TaskStateExited:     { icon: '⏩', color: 'text-gray-500' },
  FailStateEntered:    { icon: '💥', color: 'text-red-600' },
  ExecutionFailed:     { icon: '🛑', color: 'text-red-700' },
  ExecutionSucceeded:  { icon: '🎉', color: 'text-green-700' },
  ChoiceStateEntered:  { icon: '🔀', color: 'text-purple-600' },
  ChoiceStateExited:   { icon: '🔀', color: 'text-purple-500' },
  WaitStateEntered:    { icon: '⏸️', color: 'text-yellow-600' },
  WaitStateExited:     { icon: '▶️', color: 'text-yellow-600' },
}

function LogEventRow({ event }: { event: LogEvent }) {
  const meta = EVENT_TYPE_LABELS[event.type] ?? { icon: '•', color: 'text-gray-500' }
  const time = new Date(event.timestamp).toLocaleTimeString()

  return (
    <div className="flex items-start gap-3 py-2 px-3 hover:bg-gray-50 rounded text-xs">
      <span className="shrink-0 w-5 text-center">{meta.icon}</span>
      <span className="shrink-0 text-gray-400 font-mono w-20">{time}</span>
      <div className="flex-1 min-w-0">
        <span className={`font-medium ${meta.color}`}>
          {event.step ?? event.type}
        </span>
        {event.detail && (
          <span className="text-gray-500 ml-2">{event.detail}</span>
        )}
        {event.error && (
          <div className="mt-1 text-red-600 font-medium">
            Error: {event.error}
          </div>
        )}
        {event.cause && (
          <div className="mt-1 text-red-500 break-all bg-red-50 rounded p-2 text-[11px] leading-relaxed">
            {event.cause}
          </div>
        )}
      </div>
    </div>
  )
}

function LogsPanel({ logs, loading, error }: {
  logs: ExecutionLog | null
  loading: boolean
  error: string | null
}) {
  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-gray-400 animate-pulse">
        Loading execution logs…
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-4 text-sm text-red-600">
        ⚠️ {error}
      </div>
    )
  }
  if (!logs) {
    return (
      <div className="p-4 text-center text-sm text-gray-400">
        No execution logs found for this topic.
      </div>
    )
  }

  const sfnStatus = logs.status
  const sfnBadge = sfnStatus === 'SUCCEEDED'
    ? 'bg-green-100 text-green-700'
    : sfnStatus === 'FAILED'
      ? 'bg-red-100 text-red-700'
      : sfnStatus === 'RUNNING'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-100 text-gray-700'

  return (
    <div className="border-t border-gray-100">
      {/* Execution header */}
      <div className="px-4 py-3 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-700">Step Functions Execution</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sfnBadge}`}>
            {sfnStatus}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-gray-500">
          <span>Started: {new Date(logs.startDate).toLocaleString()}</span>
          {logs.stopDate && (
            <span>Duration: {duration(logs.startDate, logs.stopDate)}</span>
          )}
        </div>
      </div>

      {/* Events timeline */}
      <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 px-1 py-1">
        {logs.events.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-400">No events recorded.</div>
        ) : (
          logs.events.map((event, i) => <LogEventRow key={i} event={event} />)
        )}
      </div>
    </div>
  )
}

function PipelineRow({ item, adminKey, onRetried }: {
  item: PipelineItem
  adminKey: string
  onRetried: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [logs, setLogs] = useState<ExecutionLog | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    setLogsError(null)
    try {
      const res = await fetch(`/api/admin/pipeline/${item.id}/logs`, {
        headers: { 'x-admin-key': adminKey },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setLogs(data.executions?.[0] ?? null)
    } catch (err) {
      setLogsError(String(err))
    } finally {
      setLogsLoading(false)
    }
  }, [item.id, adminKey])

  const handleExpand = () => {
    const next = !expanded
    setExpanded(next)
    if (next && !logs && !logsLoading) {
      fetchLogs()
    }
  }

  const handleRetry = async () => {
    if (!confirm(`Reset "${item.keyword}" back to PENDING for retry?`)) return
    setRetrying(true)
    try {
      const res = await fetch(`/api/admin/pipeline/${item.id}/retry`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onRetried()
    } catch (err) {
      alert(`Failed to retry: ${err}`)
    } finally {
      setRetrying(false)
    }
  }

  const isStuck = item.status === 'PROCESSING' && item.processingAt &&
    (Date.now() - new Date(item.processingAt).getTime()) > 10 * 60 * 1000 // > 10 min

  return (
    <>
      <tr
        className="hover:bg-[#fafafa] transition-colors cursor-pointer"
        onClick={handleExpand}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <span className={`text-xs text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
            <div>
              <div className="font-medium text-[#1A1A2E] truncate max-w-[220px]">{item.keyword}</div>
              {item.source && (
                <div className="text-xs text-muted mt-0.5 capitalize">{item.source}</div>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={item.status} />
            {isStuck && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                Stuck
              </span>
            )}
          </div>
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
        <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
          {(item.status === 'FAILED' || isStuck) && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-100 disabled:opacity-50 transition-colors font-medium"
            >
              {retrying ? 'Resetting…' : '↻ Retry'}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0 bg-[#fafaff]">
            <LogsPanel logs={logs} loading={logsLoading} error={logsError} />
          </td>
        </tr>
      )}
    </>
  )
}

function PipelineTable({ items, adminKey, onRetried }: Readonly<{
  items: PipelineItem[]
  adminKey: string
  onRetried: () => void
}>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#fafafa] border-b border-border">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Keyword</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Current Step</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Time</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <PipelineRow
              key={item.id}
              item={item}
              adminKey={adminKey}
              onRetried={onRetried}
            />
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
  const stuck   = items.filter((i) =>
    i.status === 'PROCESSING' && i.processingAt &&
    (Date.now() - new Date(i.processingAt).getTime()) > 10 * 60 * 1000
  ).length
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
          {stuck > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium">
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
              {stuck} stuck
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted">Updated {elapsed(lastUpdated)}</span>
          )}
          <span className="text-xs text-muted">Last 24h · Click row for logs</span>
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
      {!loading && !error && items.length > 0 && (
        <PipelineTable items={items} adminKey={adminKey} onRetried={fetchPipeline} />
      )}

      {/* Footer */}
      {!loading && (running > 0 || recent > 0) && (
        <div className="px-6 py-3 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted">
            {running} running{stuck > 0 ? ` (${stuck} stuck)` : ''} · {recent} completed in the last 24h
          </p>
          <p className="text-xs text-muted">Auto-refreshes every 5s</p>
        </div>
      )}

    </div>
  )
}
