'use client'

import { useState, useEffect, useCallback } from 'react'

const TABS = [
  { id: 'subscribers', label: '👥 Subscribers' },
  { id: 'send',        label: '📨 Send Newsletter' },
  { id: 'templates',   label: '📝 Templates' },
  { id: 'stats',       label: '📈 Delivery Stats' },
]

interface Subscriber {
  id: string
  email: string
  name: string | null
  createdAt: string
  active: boolean
}

interface SesStats {
  deliveryAttempts: number
  bounces: number
  complaints: number
  rejects: number
  timestamp: string
}

function Spinner() {
  return <div className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
}

export default function EmailPage() {
  const [tab, setTab] = useState('subscribers')

  // ── Subscribers ─────────────────────────────────────────────────────────────
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [subTotal, setSubTotal] = useState(0)
  const [subActive, setSubActive] = useState(0)
  const [subPage, setSubPage] = useState(1)
  const [subLoading, setSubLoading] = useState(false)
  const [subSearch, setSubSearch] = useState('')
  const [exporting, setExporting] = useState(false)

  const fetchSubs = useCallback(async (page = 1, search = subSearch) => {
    setSubLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25', search })
      const res = await fetch(`/api/admin/email/stats?view=subscribers&${params}`)
      const data = await res.json()
      setSubscribers(data.subscribers ?? [])
      setSubTotal(data.total ?? 0)
      setSubActive(data.active ?? 0)
      setSubPage(page)
    } finally {
      setSubLoading(false)
    }
  }, [subSearch])

  useEffect(() => { if (tab === 'subscribers') fetchSubs() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function exportCsv() {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/email/export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // ── Send newsletter ─────────────────────────────────────────────────────────
  const [sendSubject, setSendSubject] = useState('')
  const [sendBody, setSendBody] = useState('')
  const [sendPreview, setSendPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState('')

  async function sendNewsletter() {
    if (!sendSubject || !sendBody) return
    if (!confirm(`Send newsletter to all active subscribers? This cannot be undone.`)) return
    setSending(true)
    setSendResult('')
    try {
      const res = await fetch('/api/admin/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: sendSubject, body: sendBody }),
      })
      const data = await res.json()
      setSendResult(res.ok ? `✅ Sent to ${data.count} subscribers` : `❌ ${data.error}`)
    } finally {
      setSending(false)
    }
  }

  // ── Templates ───────────────────────────────────────────────────────────────
  const BUILT_IN_TEMPLATES = [
    {
      name: 'Weekly Roundup',
      subject: 'Your Weekly WealthBeginners Update 💰',
      body: `Hi {name},\n\nHere are this week's top personal finance tips from WealthBeginners:\n\n{content}\n\nBest,\nThe WealthBeginners Team\n\n---\nUnsubscribe: {unsubscribe_link}`,
    },
    {
      name: 'New Article Alert',
      subject: 'New Article: {article_title}',
      body: `Hi {name},\n\nWe just published a new article you might love:\n\n📖 {article_title}\n{article_url}\n\n{article_excerpt}\n\nHappy reading!\n\n---\nUnsubscribe: {unsubscribe_link}`,
    },
    {
      name: 'Welcome Email',
      subject: 'Welcome to WealthBeginners! 🎉',
      body: `Hi {name},\n\nWelcome to WealthBeginners — your home for beginner-friendly personal finance advice.\n\nEvery week, we share actionable tips on saving, investing, and building wealth from the ground up.\n\nStay tuned for your first newsletter!\n\nBest,\nThe WealthBeginners Team\n\n---\nUnsubscribe: {unsubscribe_link}`,
    },
  ]

  function useTemplate(t: typeof BUILT_IN_TEMPLATES[number]) {
    setSendSubject(t.subject)
    setSendBody(t.body)
    setTab('send')
  }

  // ── Delivery stats ──────────────────────────────────────────────────────────
  const [sesStats, setSesStats] = useState<SesStats[]>([])
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    if (tab !== 'stats') return
    setStatsLoading(true)
    fetch('/api/admin/email/stats?view=delivery')
      .then(r => r.json())
      .then(d => setSesStats(d.stats ?? []))
      .finally(() => setStatsLoading(false))
  }, [tab])

  const totalDeliveries = sesStats.reduce((s, r) => s + r.deliveryAttempts, 0)
  const totalBounces    = sesStats.reduce((s, r) => s + r.bounces, 0)
  const deliveryRate    = totalDeliveries > 0
    ? (((totalDeliveries - totalBounces) / totalDeliveries) * 100).toFixed(1)
    : '—'

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[#0B1628] mb-6">Email &amp; Subscribers Center</h1>

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
          {/* ── TAB: Subscribers ── */}
          {tab === 'subscribers' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total', value: subTotal.toLocaleString() },
                  { label: 'Active', value: subActive.toLocaleString() },
                  { label: 'Inactive', value: (subTotal - subActive).toLocaleString() },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-[#0B1628]">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 flex-wrap items-center">
                <input
                  type="text"
                  placeholder="Search email…"
                  value={subSearch}
                  onChange={e => setSubSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchSubs(1, subSearch)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 w-56"
                />
                <button
                  onClick={() => fetchSubs(1, subSearch)}
                  className="bg-[#0B1628] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#1a2d4a] transition-colors"
                >
                  Search
                </button>
                <button
                  onClick={exportCsv}
                  disabled={exporting}
                  className="ml-auto flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors disabled:opacity-50"
                >
                  {exporting ? <Spinner /> : '↓'} Export CSV
                </button>
              </div>

              {subLoading && <div className="flex items-center gap-2 text-gray-500 py-4"><Spinner /> Loading…</div>}

              {!subLoading && subscribers.length === 0 && (
                <p className="text-gray-400 text-center py-8 text-sm">No subscribers found.</p>
              )}

              {subscribers.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Email', 'Name', 'Status', 'Subscribed'].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {subscribers.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="py-3 px-3 text-[#0B1628]">{s.email}</td>
                          <td className="py-3 px-3 text-gray-500">{s.name ?? '—'}</td>
                          <td className="py-3 px-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {s.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-400 whitespace-nowrap">{new Date(s.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {subTotal > 25 && (
                <div className="flex items-center gap-2 justify-center pt-2">
                  <button disabled={subPage === 1} onClick={() => fetchSubs(subPage - 1)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:border-[#C9A84C] transition-colors">
                    ← Prev
                  </button>
                  <span className="text-sm text-gray-500">Page {subPage} of {Math.ceil(subTotal / 25)}</span>
                  <button disabled={subPage * 25 >= subTotal} onClick={() => fetchSubs(subPage + 1)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:border-[#C9A84C] transition-colors">
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Send Newsletter ── */}
          {tab === 'send' && (
            <div className="max-w-2xl space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={sendSubject}
                  onChange={e => setSendSubject(e.target.value)}
                  placeholder="Your Weekly WealthBeginners Update"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Body</label>
                  <button onClick={() => setSendPreview(p => !p)} className="text-xs text-[#C9A84C] hover:underline">
                    {sendPreview ? 'Edit' : 'Preview'}
                  </button>
                </div>
                {sendPreview ? (
                  <div
                    className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm bg-gray-50 min-h-[240px] whitespace-pre-wrap font-mono"
                    dangerouslySetInnerHTML={{ __html: sendBody.replace(/\n/g, '<br/>') }}
                  />
                ) : (
                  <textarea
                    rows={12}
                    value={sendBody}
                    onChange={e => setSendBody(e.target.value)}
                    placeholder="Write your email body here…&#10;&#10;Use {name} for subscriber name."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 resize-none"
                  />
                )}
              </div>

              {sendResult && (
                <div className={`text-sm px-4 py-3 rounded-lg ${sendResult.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {sendResult}
                </div>
              )}

              <button
                onClick={sendNewsletter}
                disabled={sending || !sendSubject || !sendBody}
                className="bg-[#C9A84C] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#b8973d] disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {sending && <Spinner />}
                {sending ? 'Sending…' : `Send to All Active Subscribers (${subActive.toLocaleString()})`}
              </button>
            </div>
          )}

          {/* ── TAB: Templates ── */}
          {tab === 'templates' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {BUILT_IN_TEMPLATES.map(t => (
                <div key={t.name} className="border border-gray-200 rounded-xl p-5 hover:border-[#C9A84C] transition-colors group">
                  <h3 className="font-semibold text-[#0B1628] mb-1 group-hover:text-[#C9A84C]">{t.name}</h3>
                  <p className="text-xs text-gray-500 mb-3 truncate">{t.subject}</p>
                  <p className="text-xs text-gray-400 line-clamp-3 mb-4 font-mono whitespace-pre-line">{t.body.slice(0, 100)}…</p>
                  <button
                    onClick={() => useTemplate(t)}
                    className="text-sm text-[#C9A84C] font-medium hover:underline"
                  >
                    Use Template →
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── TAB: Delivery Stats ── */}
          {tab === 'stats' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Sent',     value: totalDeliveries.toLocaleString() },
                  { label: 'Bounces',        value: totalBounces.toLocaleString() },
                  { label: 'Complaints',     value: sesStats.reduce((s, r) => s + r.complaints, 0).toLocaleString() },
                  { label: 'Delivery Rate',  value: `${deliveryRate}%` },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-[#0B1628]">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {statsLoading && <div className="flex items-center gap-2 text-gray-500"><Spinner /> Loading…</div>}

              {!statsLoading && sesStats.length === 0 && (
                <p className="text-gray-400 text-center py-8 text-sm">No SES data available yet.</p>
              )}

              {sesStats.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Date', 'Attempts', 'Bounces', 'Complaints', 'Rejects'].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sesStats.slice().reverse().map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{new Date(r.timestamp).toLocaleDateString()}</td>
                          <td className="py-3 px-3 text-[#0B1628] font-medium">{r.deliveryAttempts}</td>
                          <td className="py-3 px-3 text-red-500">{r.bounces}</td>
                          <td className="py-3 px-3 text-amber-500">{r.complaints}</td>
                          <td className="py-3 px-3 text-gray-400">{r.rejects}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
