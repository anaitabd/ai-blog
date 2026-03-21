'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────
interface StatusData {
  connected: boolean
  channelId?: string
  channelName?: string
  channelThumbnail?: string | null
  subscriberCount?: string
  videoCount?: string
  lastChecked?: string
  error?: string
}

interface YtShort {
  id: string
  title: string
  youtubeVideoId: string
  youtubeVideoUrl: string
  publishedAt: string
  postTitle: string | null
}

interface Post { id: string; title: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  const mo = Math.floor(d / 30)
  return `${mo} month${mo === 1 ? '' : 's'} ago`
}

function fmtCount(n: string | undefined): string {
  if (!n) return '—'
  const num = Number(n)
  if (isNaN(num)) return n
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}K`
  return num.toLocaleString()
}

function Spinner({ size = 4 }: { size?: number }) {
  return (
    <div
      style={{ width: size * 4, height: size * 4 }}
      className="inline-block border-2 border-current border-t-transparent rounded-full animate-spin shrink-0"
    />
  )
}

// ─── Entry ───────────────────────────────────────────────────────────────────
export default function YouTubePage() {
  return (
    <Suspense>
      <YouTubePageInner />
    </Suspense>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
function YouTubePageInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  // ── ?connected=true toast ─────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      setToast('✓ YouTube channel connected successfully!')
      router.replace('/admin/youtube')
      toastTimer.current = setTimeout(() => setToast(null), 4000)
    }
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [searchParams, router])

  // ── Connection status ─────────────────────────────────────────────────────
  const [status, setStatus]               = useState<StatusData | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const res = await fetch('/api/admin/youtube/status')
      setStatus(res.ok ? await res.json() : { connected: false })
    } catch {
      setStatus({ connected: false })
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  // ── Connect flow ──────────────────────────────────────────────────────────
  const [connecting, setConnecting] = useState(false)

  async function handleConnect() {
    setConnecting(true)
    try {
      const res  = await fetch('/api/admin/youtube/connect')
      const data = await res.json() as { url: string }
      window.location.href = data.url
    } catch {
      setConnecting(false)
    }
  }

  // ── Disconnect flow ───────────────────────────────────────────────────────
  const [disconnecting, setDisconnecting] = useState(false)

  async function handleDisconnect() {
    if (!window.confirm('Are you sure? This will stop all YouTube publishing.')) return
    setDisconnecting(true)
    try {
      await fetch('/api/admin/youtube/disconnect', { method: 'POST' })
      await fetchStatus()
    } finally {
      setDisconnecting(false)
    }
  }

  // ── Shorts list ───────────────────────────────────────────────────────────
  const [shorts, setShorts]               = useState<YtShort[]>([])
  const [shortsTotal, setShortsTotal]     = useState(0)
  const [shortsPage, setShortsPage]       = useState(1)
  const [shortsLoading, setShortsLoading] = useState(true)
  const [copied, setCopied]               = useState<string | null>(null)

  const fetchShorts = useCallback(async (page = 1) => {
    setShortsLoading(true)
    try {
      const res  = await fetch(`/api/admin/youtube/shorts?page=${page}&limit=20`)
      const data = await res.json()
      setShorts(data.shorts ?? [])
      setShortsTotal(data.total ?? 0)
      setShortsPage(page)
    } finally {
      setShortsLoading(false)
    }
  }, [])

  useEffect(() => { fetchShorts(1) }, [fetchShorts])

  function copyLink(url: string, id: string) {
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  // ── Generate flow ─────────────────────────────────────────────────────────
  const [showGenPanel, setShowGenPanel] = useState(false)
  const [posts, setPosts]               = useState<Post[]>([])
  const [selectedPost, setSelectedPost] = useState('')
  const [generating, setGenerating]     = useState(false)
  const [genMsg, setGenMsg]             = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!showGenPanel) return
    fetch('/api/admin/youtube/shorts?list_posts=1')
      .then(r => r.json())
      .then(d => setPosts(d.posts ?? []))
      .catch(() => {})
  }, [showGenPanel])

  async function handleGenerate() {
    if (!selectedPost) return
    setGenerating(true)
    setGenMsg(null)
    try {
      const res  = await fetch('/api/admin/youtube', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ postId: selectedPost }),
      })
      const data = await res.json()
      if (res.ok) {
        setGenMsg({ ok: true, text: 'Short queued for generation! Check back in a few minutes.' })
        fetchShorts(1)
      } else {
        setGenMsg({ ok: false, text: data.error ?? 'Generation failed' })
      }
    } catch (e) {
      setGenMsg({ ok: false, text: String(e) })
    } finally {
      setGenerating(false)
    }
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const lastPublished = shorts[0]?.publishedAt ? relativeTime(shorts[0].publishedAt) : '—'

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1628]">YouTube Channel Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your Shorts publishing pipeline</p>
        </div>
        <button
          onClick={fetchStatus}
          className="text-xs text-gray-400 hover:text-gray-700 underline self-start sm:self-auto"
        >
          Refresh status
        </button>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="flex items-center justify-between gap-4 bg-green-50 border border-green-200 text-green-800 text-sm font-medium px-4 py-3 rounded-xl">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-green-600 hover:text-green-800 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — Channel Connection Card
      ══════════════════════════════════════════════════════════════════ */}
      {statusLoading ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 flex items-center gap-3 text-gray-400">
          <Spinner size={5} /> Loading channel status…
        </div>
      ) : status?.connected ? (
        /* ── Connected ───────────────────────────────────────────────────── */
        <div className="bg-white border-2 border-green-400 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {status.channelThumbnail ? (
              <img
                src={status.channelThumbnail}
                alt={status.channelName ?? 'Channel'}
                className="w-16 h-16 rounded-full object-cover shrink-0 border-2 border-green-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-2xl">▶</div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-[#0B1628] truncate">{status.channelName ?? 'YouTube Channel'}</h2>
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Connected
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                <span>{fmtCount(status.subscriberCount)} subscribers</span>
                <span>{fmtCount(status.videoCount)} videos</span>
                {status.channelId && (
                  <a
                    href={`https://youtube.com/channel/${status.channelId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#C9A84C] hover:underline"
                  >
                    View channel →
                  </a>
                )}
              </div>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="shrink-0 self-end sm:self-auto flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {disconnecting && <Spinner size={3} />}
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        /* ── Not connected ───────────────────────────────────────────────── */
        <div className="bg-white border-2 border-orange-300 rounded-2xl p-8 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 text-2xl">⚠</div>
          <div>
            <h2 className="text-lg font-bold text-[#0B1628]">YouTube Channel Not Connected</h2>
            <p className="text-sm text-gray-500 mt-1">Connect your channel to enable automatic Shorts publishing</p>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-3 bg-[#FF0000] hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-xl text-sm disabled:opacity-60 transition-colors shadow-sm"
          >
            {connecting ? (
              <><Spinner size={4} />Redirecting to Google…</>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                Connect YouTube Channel
              </>
            )}
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2 — Stats Row
      ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([
          { label: 'Total Shorts Published', value: shortsLoading ? '…' : String(shortsTotal), icon: '🎬', sub: 'all time' },
          { label: 'Last Published',         value: shortsLoading ? '…' : lastPublished,          icon: '🕐', sub: shorts[0] ? new Date(shorts[0].publishedAt).toLocaleDateString() : '—' },
          { label: 'Success Rate',           value: shortsTotal === 0 ? '—' : '100%',             icon: '✅', sub: 'no failed uploads recorded' },
        ] as const).map(card => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
              <span className="text-xl">{card.icon}</span>
            </div>
            <p className="text-2xl font-bold text-[#0B1628]">{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 3 — Shorts Table
      ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-[#0B1628]">Published Shorts</h2>
          {!shortsLoading && <span className="text-xs text-gray-400">{shortsTotal} total</span>}
        </div>

        {shortsLoading ? (
          <div className="flex items-center gap-3 text-gray-400 px-6 py-10">
            <Spinner size={5} /> Loading shorts…
          </div>
        ) : shorts.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-16">No YouTube Shorts published yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Thumbnail', 'Title', 'Published Date', 'Duration', 'Views', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {shorts.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 w-20">
                        <img
                          src={`https://img.youtube.com/vi/${s.youtubeVideoId}/mqdefault.jpg`}
                          alt={s.title}
                          className="w-16 h-10 object-cover rounded-md bg-gray-100"
                          loading="lazy"
                        />
                      </td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <p className="font-medium text-[#0B1628] truncate" title={s.title}>{s.title}</p>
                        {s.postTitle && (
                          <p className="text-xs text-gray-400 truncate mt-0.5" title={s.postTitle}>{s.postTitle}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="text-gray-700">{new Date(s.publishedAt).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-400">{relativeTime(s.publishedAt)}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-400">—</td>
                      <td className="py-3 px-4 text-gray-400">—</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          PUBLISHED
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://www.youtube.com/shorts/${s.youtubeVideoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-white bg-[#FF0000] hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            View ↗
                          </a>
                          <button
                            onClick={() => copyLink(`https://www.youtube.com/shorts/${s.youtubeVideoId}`, s.id)}
                            className="text-xs font-medium text-gray-600 border border-gray-200 hover:border-[#C9A84C] hover:text-[#C9A84C] px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {copied === s.id ? 'Copied!' : 'Copy Link'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {shortsTotal > 20 && (
              <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-gray-100">
                <button
                  disabled={shortsPage === 1}
                  onClick={() => fetchShorts(shortsPage - 1)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:border-[#C9A84C] transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-sm text-gray-500">Page {shortsPage} of {Math.ceil(shortsTotal / 20)}</span>
                <button
                  disabled={shortsPage * 20 >= shortsTotal}
                  onClick={() => fetchShorts(shortsPage + 1)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:border-[#C9A84C] transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 4 — Manual Generate Button
      ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-semibold text-[#0B1628]">Generate Short Now</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manually trigger a YouTube Short for any published post</p>
        </div>
        <div className="relative group shrink-0">
          <button
            onClick={() => setShowGenPanel(v => !v)}
            disabled={!status?.connected}
            className="bg-[#0B1628] text-[#C9A84C] font-semibold px-6 py-3 rounded-xl text-sm hover:bg-[#162038] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Generate Short Now
          </button>
          {!status?.connected && (
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-gray-800 text-white text-xs rounded-lg px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              Connect YouTube first
            </span>
          )}
        </div>
      </div>

      {showGenPanel && status?.connected && (
        <div className="bg-white border border-[#C9A84C]/40 rounded-2xl p-6 space-y-4">
          <h3 className="font-medium text-[#0B1628]">Select a post to generate a Short for</h3>
          <select
            value={selectedPost}
            onChange={e => setSelectedPost(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 max-w-lg"
          >
            <option value="">— Choose a published post —</option>
            {posts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>

          {genMsg && (
            <div className={`text-sm px-4 py-3 rounded-lg ${genMsg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {genMsg.text}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={!selectedPost || generating}
              className="flex items-center gap-2 bg-[#0B1628] text-[#C9A84C] font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-[#162038] disabled:opacity-50 transition-colors"
            >
              {generating && <Spinner size={4} />}
              {generating ? 'Generating…' : 'Generate'}
            </button>
            <button
              onClick={() => { setShowGenPanel(false); setGenMsg(null); setSelectedPost('') }}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
