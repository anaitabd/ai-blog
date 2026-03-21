'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface LogEntry {
  timestamp: string
  source: string
  level: string | null
  event: string | null
  data: Record<string, unknown>
  raw: string | null
}

interface LogsResponse {
  logs: LogEntry[]
  total: number
  fetchedAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTimestamp(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${mi}:${ss}`
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diffMs / 1000)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function isError(entry: LogEntry): boolean {
  return (
    entry.level === 'ERROR' ||
    entry.level === 'FAILED' ||
    (typeof entry.data.status === 'string' && /error|fail/i.test(entry.data.status))
  )
}

function matchesSearch(entry: LogEntry, q: string): boolean {
  if (!q.trim()) return true
  const lower = q.toLowerCase()
  return JSON.stringify({ ...entry.data, source: entry.source, event: entry.event, raw: entry.raw })
    .toLowerCase()
    .includes(lower)
}

// ─── Log row renderers ────────────────────────────────────────────────────────

function scorePillColor(score: number | null): string {
  if (score === null) return 'bg-gray-200 text-gray-700'
  if (score >= 85) return 'bg-green-100 text-green-800'
  if (score >= 70) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

function QualityGateRow({ data }: { readonly data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const score     = typeof data.score     === 'number' ? data.score     : null
  const status    = typeof data.status    === 'string' ? data.status    : null
  const seoScore  = typeof data.seoScore  === 'number' ? data.seoScore  : null
  const wordCount = typeof data.wordCount === 'number' ? data.wordCount : null
  const sources   = typeof data.sourceCount === 'number' ? data.sourceCount : null
  const issues    = Array.isArray(data.issues) ? data.issues as string[] : []

  const pillColor = scorePillColor(score)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {score !== null && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pillColor}`}>
            {score}/100{status ? ` · ${status}` : ''}
          </span>
        )}
        {wordCount !== null && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {wordCount.toLocaleString()} words
          </span>
        )}
        {seoScore !== null && (
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
            SEO {seoScore}/100
          </span>
        )}
        {sources !== null && (
          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
            {sources} source{sources === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {issues.length > 0 && (
        <button
          onClick={() => setOpen(v => !v)}
          className="text-xs text-red-600 underline underline-offset-2"
        >
          {open ? '▾' : '▸'} {issues.length} issue{issues.length === 1 ? '' : 's'}
        </button>
      )}
      {open && (
        <ul className="space-y-1 mt-1">
          {issues.map((iss, i) => (
            <li key={iss.slice(0, 40)} className="text-xs bg-red-50 border border-red-100 rounded px-2 py-1 text-red-700 font-mono">
              {iss}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function YoutubeUploadRow({ data }: { readonly data: Record<string, unknown> }) {
  const title     = typeof data.title     === 'string' ? data.title     : null
  const videoId   = typeof data.videoId   === 'string' ? data.videoId   : null
  const channelId = typeof data.channelId === 'string' ? data.channelId : null
  const duration  = typeof data.duration  === 'number' ? data.duration  : null

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
          ✓ SUCCESS
        </span>
        {title && <span className="text-sm font-medium text-gray-800">📹 {title}</span>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
        {videoId && (
          <a
            href={`https://youtube.com/shorts/${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {videoId} ↗
          </a>
        )}
        {channelId && <span>Channel: {channelId}</span>}
        {!!duration && <span>Upload time: {duration}s</span>}
      </div>
    </div>
  )
}

function NovaReelRow({ data }: { readonly data: Record<string, unknown> }) {
  const sceneRaw    = data.scene ?? data.sceneIndex ?? null
  const durationRaw = data.duration ?? data.elapsed ?? null
  const s3Key       = typeof data.s3Key === 'string' ? data.s3Key
                    : typeof data.key   === 'string' ? data.key
                    : null
  const sceneLabel    = sceneRaw    !== null ? `Scene ${String(sceneRaw)} rendered` : 'Scene rendered'
  const durationLabel = durationRaw !== null ? ` in ${String(durationRaw)}s` : ''

  return (
    <div className="space-y-0.5">
      <p className="text-sm font-medium text-gray-800">
        🎬 {sceneLabel}{durationLabel}
      </p>
      {s3Key && (
        <p className="text-xs text-gray-500 font-mono truncate max-w-xs">{s3Key}</p>
      )}
    </div>
  )
}

function ErrorRow({ data, raw }: { readonly data: Record<string, unknown>; readonly raw: string | null }) {
  let msg: string
  if (typeof data.error === 'string')   { msg = data.error }
  else if (typeof data.message === 'string') { msg = data.message }
  else { msg = raw ?? 'Unknown error' }
  const stack = typeof data.stack === 'string' ? data.stack : null

  return (
    <div className="space-y-1">
      <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
        ERROR
      </span>
      <pre className="text-xs text-red-700 font-mono bg-red-50 rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all">
        {msg}
      </pre>
      {stack && (
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-400 hover:text-gray-600">Stack trace</summary>
          <pre className="mt-1 text-[10px] text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all">
            {stack}
          </pre>
        </details>
      )}
    </div>
  )
}

function GenericRow({ event, data }: { readonly event: string | null; readonly data: Record<string, unknown> }) {
  const excluded = new Set(['level', 'status', 'event', 'step', 'lambda', 'pct'])
  const pairs = Object.entries(data).filter(([k]) => !excluded.has(k))

  return (
    <div className="space-y-1">
      {event && <p className="text-sm font-semibold text-gray-800">{event}</p>}
      {pairs.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
          {pairs.map(([k, v]) => (
            <span key={k} className="text-xs text-gray-500">
              <span className="text-gray-400">{k}:</span>{' '}
              {typeof v === 'object' ? JSON.stringify(v) : String(v === null || v === undefined ? '—' : v)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function LogRow({ entry }: { readonly entry: LogEntry }) {
  const error = isError(entry)

  const content = (() => {
    if (entry.event === 'QUALITY_GATE_RESULT') return <QualityGateRow data={entry.data} />
    if (entry.event === 'YOUTUBE_UPLOAD_SUCCESS') return <YoutubeUploadRow data={entry.data} />
    if (entry.event === 'NOVA_REEL_COMPLETE') return <NovaReelRow data={entry.data} />
    if (error) return <ErrorRow data={entry.data} raw={entry.raw} />
    if (entry.raw) return (
      <p className="text-xs text-gray-600 font-mono break-all">{entry.raw}</p>
    )
    return <GenericRow event={entry.event} data={entry.data} />
  })()

  return (
    <div className={`flex flex-col md:flex-row gap-3 py-3 px-4 rounded-lg border ${
      error
        ? 'border-l-4 border-l-red-500 border-r border-t border-b border-red-100 bg-red-50/30'
        : 'border-border bg-white hover:bg-gray-50/50'
    } transition-colors`}>
      {/* Left column */}
      <div className="shrink-0 md:w-40 flex md:flex-col gap-2 md:gap-1">
        <span className="font-mono text-xs text-gray-400 whitespace-nowrap">
          {fmtTimestamp(entry.timestamp)}
        </span>
        <span className="text-[10px] font-semibold bg-[#0B1628]/10 text-[#0B1628] px-2 py-0.5 rounded self-start">
          {entry.source}
        </span>
      </div>
      {/* Right column */}
      <div className="flex-1 min-w-0">
        {content}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TYPE_PILLS = [
  { value: 'all',      label: 'All' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'youtube',  label: 'YouTube' },
  { value: 'quality',  label: 'Quality' },
  { value: 'errors',   label: 'Errors' },
] as const

const HOUR_OPTIONS = [
  { value: 1,  label: 'Last 1h' },
  { value: 6,  label: 'Last 6h' },
  { value: 24, label: 'Last 24h' },
  { value: 48, label: 'Last 48h' },
]

export default function LogsPage() {
  const [logs, setLogs]               = useState<LogEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [type, setType]               = useState<string>('all')
  const [hours, setHours]             = useState(6)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [search, setSearch]           = useState('')
  const [fetchedAt, setFetchedAt]     = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/logs?type=${type}&hours=${hours}&limit=200`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const data: LogsResponse = await res.json()
      setLogs(data.logs)
      setFetchedAt(data.fetchedAt)
      setError(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [type, hours])

  // Fetch on mount and when type/hours changes
  useEffect(() => {
    setLoading(true)
    fetchLogs()
  }, [fetchLogs])

  // Auto-refresh with visibility awareness
  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    const start = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(fetchLogs, 10_000)
    }
    const stop = () => { if (intervalRef.current) clearInterval(intervalRef.current) }

    const onVisibility = () => document.hidden ? stop() : start()
    document.addEventListener('visibilitychange', onVisibility)
    start()

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [autoRefresh, fetchLogs])

  const filtered = logs.filter(e => matchesSearch(e, search))
  const errorCount = logs.filter(isError).length

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#0B1628]">Pipeline Logs</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="accent-[#0B1628] w-3.5 h-3.5"
            />
            <span className="font-medium">Live</span>
            {autoRefresh && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
            )}
          </label>
          <button
            onClick={() => { setLoading(true); fetchLogs() }}
            disabled={loading}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-[#0B1628] text-white hover:bg-[#162035] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading…' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Type pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-nowrap">
          {TYPE_PILLS.map(p => (
            <button
              key={p.value}
              onClick={() => setType(p.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                type === p.value
                  ? 'bg-[#0B1628] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Time range */}
        <select
          aria-label="Time range"
          value={hours}
          onChange={e => setHours(Number(e.target.value))}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0B1628]/20"
        >
          {HOUR_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Search */}
        <input
          type="search"
          placeholder="Search logs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-xs border border-border rounded-lg px-3 py-1.5 bg-white text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0B1628]/20 min-w-[160px]"
        />
      </div>

      {/* ── Stats row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Logs', value: logs.length.toLocaleString() },
          { label: 'Errors', value: errorCount.toLocaleString(), red: errorCount > 0 },
          { label: 'Last Updated', value: fetchedAt ? relativeTime(fetchedAt) : '—' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-border p-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.red ? 'text-red-600' : 'text-[#0B1628]'}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Log feed ───────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={`skel-${i}`} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-border px-6 py-16 text-center text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">{search ? 'No logs match your search.' : 'No logs found for this time range.'}</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-1.5">
          {filtered.map((entry, i) => (
            <LogRow key={`${entry.timestamp}-${i}`} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
