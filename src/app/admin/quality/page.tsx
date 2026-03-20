'use client'

import { useState, useEffect, useCallback } from 'react'

const TABS = [
  { id: 'scores',   label: '📊 Quality Scores' },
  { id: 'failed',   label: '❌ Failed Articles' },
  { id: 'topics',   label: '📋 Topic Queue' },
  { id: 'banned',   label: '🚫 Banned Words' },
]

interface QualityPost {
  id: string
  title: string
  seoScore: number | null
  wordCount: number | null
  status: string
  createdAt: string
  slug: string
}

interface TopicItem {
  id: string
  topic: string
  status: string
  category: string
  createdAt: string
}

function Spinner() {
  return <div className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 text-xs">—</span>
  const color = score >= 80 ? 'text-green-600 bg-green-50' : score >= 60 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{score}</span>
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PUBLISHED: 'bg-green-50 text-green-700',
    REVIEW: 'bg-amber-50 text-amber-700',
    REJECTED: 'bg-red-50 text-red-700',
    DRAFT: 'bg-gray-50 text-gray-700',
    PENDING: 'bg-blue-50 text-blue-700',
    FAILED: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] ?? 'bg-gray-50 text-gray-500'}`}>
      {status}
    </span>
  )
}

export default function QualityPage() {
  const [tab, setTab] = useState('scores')

  // ── Quality scores tab ──────────────────────────────────────────────────────
  const [posts, setPosts] = useState<QualityPost[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'low' | 'high'>('all')

  const fetchPosts = useCallback(async (f = filter) => {
    setPostsLoading(true)
    try {
      const res = await fetch(`/api/admin/quality?filter=${f}`)
      const data = await res.json()
      setPosts(data.posts ?? [])
    } finally {
      setPostsLoading(false)
    }
  }, [filter])

  useEffect(() => { if (tab === 'scores') fetchPosts() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Failed articles tab ─────────────────────────────────────────────────────
  const [failed, setFailed] = useState<QualityPost[]>([])
  const [failedLoading, setFailedLoading] = useState(false)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [retryMsg, setRetryMsg] = useState('')

  const fetchFailed = useCallback(async () => {
    setFailedLoading(true)
    try {
      const res = await fetch('/api/admin/quality?filter=failed')
      const data = await res.json()
      setFailed(data.posts ?? [])
    } finally {
      setFailedLoading(false)
    }
  }, [])

  useEffect(() => { if (tab === 'failed') fetchFailed() }, [tab, fetchFailed])

  async function retryPost(postId: string) {
    setRetrying(postId)
    setRetryMsg('')
    try {
      const res = await fetch('/api/admin/quality/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      const data = await res.json()
      setRetryMsg(res.ok ? '✅ Queued for retry' : `❌ ${data.error}`)
      if (res.ok) fetchFailed()
    } finally {
      setRetrying(null)
    }
  }

  // ── Topic queue tab ─────────────────────────────────────────────────────────
  const [topics, setTopics] = useState<TopicItem[]>([])
  const [topicsLoading, setTopicsLoading] = useState(false)

  const fetchTopics = useCallback(async () => {
    setTopicsLoading(true)
    try {
      const res = await fetch('/api/admin/quality?view=topics')
      const data = await res.json()
      setTopics(data.topics ?? [])
    } finally {
      setTopicsLoading(false)
    }
  }, [])

  useEffect(() => { if (tab === 'topics') fetchTopics() }, [tab, fetchTopics])

  // ── Banned words tab ────────────────────────────────────────────────────────
  const [bannedWords, setBannedWords] = useState('')
  const [bannedLoading, setBannedLoading] = useState(false)
  const [bannedSaving, setBannedSaving] = useState(false)
  const [bannedMsg, setBannedMsg] = useState('')

  useEffect(() => {
    if (tab !== 'banned') return
    setBannedLoading(true)
    fetch('/api/admin/quality/banned-words')
      .then(r => r.json())
      .then(d => setBannedWords((d.words ?? []).join('\n')))
      .finally(() => setBannedLoading(false))
  }, [tab])

  async function saveBannedWords() {
    setBannedSaving(true)
    setBannedMsg('')
    try {
      const words = bannedWords.split('\n').map(w => w.trim()).filter(Boolean)
      const res = await fetch('/api/admin/quality/banned-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words }),
      })
      setBannedMsg(res.ok ? '✅ Saved' : '❌ Failed to save')
    } finally {
      setBannedSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[#0B1628] mb-6">Content Quality Center</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                tab === t.id
                  ? 'text-[#C9A84C] border-b-2 border-[#C9A84C] -mb-px'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── TAB: Quality Scores ── */}
          {tab === 'scores' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {(['all', 'low', 'high'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); fetchPosts(f) }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                      filter === f
                        ? 'bg-[#0B1628] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'all' ? 'All Posts' : f === 'low' ? 'Low Score (<60)' : 'High Score (≥80)'}
                  </button>
                ))}
              </div>

              {postsLoading && <div className="flex items-center gap-2 text-gray-500 py-4"><Spinner /> Loading…</div>}

              {!postsLoading && posts.length === 0 && (
                <p className="text-gray-400 text-center py-8 text-sm">No posts found.</p>
              )}

              {posts.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Title', 'Status', 'SEO Score', 'Word Count', 'Created'].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {posts.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium text-[#0B1628] max-w-[240px]">
                            <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#C9A84C] hover:underline truncate block">
                              {p.title}
                            </a>
                          </td>
                          <td className="py-3 px-3"><StatusBadge status={p.status} /></td>
                          <td className="py-3 px-3"><ScoreBadge score={p.seoScore} /></td>
                          <td className="py-3 px-3 text-gray-600">{p.wordCount?.toLocaleString() ?? '—'}</td>
                          <td className="py-3 px-3 text-gray-400 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Failed Articles ── */}
          {tab === 'failed' && (
            <div className="space-y-4">
              {retryMsg && <div className="text-sm px-4 py-2 bg-gray-50 rounded-lg">{retryMsg}</div>}
              {failedLoading && <div className="flex items-center gap-2 text-gray-500 py-4"><Spinner /> Loading…</div>}
              {!failedLoading && failed.length === 0 && (
                <p className="text-gray-400 text-center py-8 text-sm">No failed or rejected articles. 🎉</p>
              )}
              {failed.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Title', 'Status', 'Created', ''].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {failed.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium text-[#0B1628] max-w-[280px]">
                            <span className="truncate block">{p.title}</span>
                          </td>
                          <td className="py-3 px-3"><StatusBadge status={p.status} /></td>
                          <td className="py-3 px-3 text-gray-400 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => retryPost(p.id)}
                              disabled={retrying === p.id}
                              className="text-xs bg-[#0B1628] text-white px-3 py-1.5 rounded-lg hover:bg-[#1a2d4a] disabled:opacity-50 transition-colors flex items-center gap-1"
                            >
                              {retrying === p.id ? <><Spinner /> Queueing…</> : 'Retry'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Topic Queue ── */}
          {tab === 'topics' && (
            <div className="space-y-4">
              {topicsLoading && <div className="flex items-center gap-2 text-gray-500 py-4"><Spinner /> Loading…</div>}
              {!topicsLoading && topics.length === 0 && (
                <p className="text-gray-400 text-center py-8 text-sm">Topic queue is empty.</p>
              )}
              {topics.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Topic', 'Category', 'Status', 'Created'].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {topics.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium text-[#0B1628] max-w-[280px]">
                            <span className="truncate block">{t.topic}</span>
                          </td>
                          <td className="py-3 px-3 text-gray-500">{t.category}</td>
                          <td className="py-3 px-3"><StatusBadge status={t.status} /></td>
                          <td className="py-3 px-3 text-gray-400 whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button onClick={fetchTopics} className="text-sm text-gray-500 underline hover:text-gray-800">Refresh</button>
            </div>
          )}

          {/* ── TAB: Banned Words ── */}
          {tab === 'banned' && (
            <div className="max-w-lg space-y-4">
              <p className="text-sm text-gray-500">One word or phrase per line. Articles containing these will be flagged during quality checks.</p>
              {bannedLoading ? (
                <div className="flex items-center gap-2 text-gray-500"><Spinner /> Loading…</div>
              ) : (
                <textarea
                  rows={14}
                  value={bannedWords}
                  onChange={e => setBannedWords(e.target.value)}
                  placeholder="scam&#10;get rich quick&#10;guaranteed returns"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 resize-none font-mono"
                />
              )}
              <div className="flex items-center gap-4">
                <button
                  onClick={saveBannedWords}
                  disabled={bannedSaving || bannedLoading}
                  className="bg-[#C9A84C] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#b8973d] disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {bannedSaving && <Spinner />}
                  Save Banned Words
                </button>
                {bannedMsg && <span className="text-sm">{bannedMsg}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
