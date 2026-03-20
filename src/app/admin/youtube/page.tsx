'use client'

import { useState, useEffect, useCallback } from 'react'

const TABS = [
  { id: 'status',   label: '📡 Channel Status' },
  { id: 'shorts',   label: '🎬 Published Shorts' },
  { id: 'generate', label: '✨ Generate Short' },
  { id: 'settings', label: '⚙️ Settings' },
]

interface ChannelInfo {
  channelId: string
  title: string
  subscriberCount: string
  videoCount: string
  customUrl: string
  tokenStatus: 'connected' | 'expired' | 'missing'
  tokenExpiry: string | null
}

interface YtShort {
  id: string
  title: string
  youtubeVideoId: string
  youtubeVideoUrl: string
  publishedAt: string
  postTitle?: string
}

interface Post { id: string; title: string }

const STEPS = [
  'Generating script…',
  'Creating video with Nova Reel…',
  'Adding TTS narration…',
  'Processing with FFmpeg…',
  'Uploading to YouTube…',
  'Done!',
]

function Spinner() {
  return (
    <div className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
  )
}

export default function YouTubePage() {
  const [tab, setTab] = useState('status')

  // ── Channel status ──────────────────────────────────────────────────────────
  const [channel, setChannel] = useState<ChannelInfo | null>(null)
  const [channelLoading, setChannelLoading] = useState(false)
  const [channelError, setChannelError] = useState('')

  const fetchChannel = useCallback(async () => {
    setChannelLoading(true)
    setChannelError('')
    try {
      const res = await fetch('/api/admin/youtube/channel')
      if (!res.ok) throw new Error(await res.text())
      setChannel(await res.json())
    } catch (e) {
      setChannelError(String(e))
    } finally {
      setChannelLoading(false)
    }
  }, [])

  useEffect(() => { if (tab === 'status') fetchChannel() }, [tab, fetchChannel])

  // ── Shorts list ─────────────────────────────────────────────────────────────
  const [shorts, setShorts] = useState<YtShort[]>([])
  const [shortsPage, setShortsPage] = useState(1)
  const [shortsTotal, setShortsTotal] = useState(0)
  const [shortsLoading, setShortsLoading] = useState(false)

  const fetchShorts = useCallback(async (page = 1) => {
    setShortsLoading(true)
    try {
      const res = await fetch(`/api/admin/youtube/shorts?page=${page}&limit=20`)
      const data = await res.json()
      setShorts(data.shorts ?? [])
      setShortsTotal(data.total ?? 0)
      setShortsPage(page)
    } finally {
      setShortsLoading(false)
    }
  }, [])

  useEffect(() => { if (tab === 'shorts') fetchShorts(1) }, [tab, fetchShorts])

  // ── Generate short ──────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPost, setSelectedPost] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genStep, setGenStep] = useState(-1)
  const [genError, setGenError] = useState('')
  const [genResult, setGenResult] = useState<{ url: string } | null>(null)

  useEffect(() => {
    if (tab !== 'generate') return
    fetch('/api/admin/youtube/shorts?list_posts=1')
      .then(r => r.json())
      .then(d => setPosts(d.posts ?? []))
      .catch(() => {})
  }, [tab])

  async function generateShort() {
    if (!selectedPost) return
    setGenerating(true)
    setGenStep(0)
    setGenError('')
    setGenResult(null)
    try {
      // Simulate step progression then fire real request
      for (let i = 0; i < STEPS.length - 1; i++) {
        setGenStep(i)
        await new Promise(r => setTimeout(r, 800))
      }
      const res = await fetch('/api/admin/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: selectedPost }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setGenStep(STEPS.length - 1)
      setGenResult(data)
    } catch (e) {
      setGenError(String(e))
      setGenStep(-1)
    } finally {
      setGenerating(false)
    }
  }

  // ── Settings ────────────────────────────────────────────────────────────────
  const [ytSettings, setYtSettings] = useState({
    titleTemplate: '{title} | WealthBeginners',
    descriptionTemplate: '💰 Full article: {url}\n\n#personalfinance #moneytips #wealthbeginners',
    hashtags: '#personalfinance #moneytips #investing #wealthbeginners',
    category: '27',
    madeForKids: false,
    privacy: 'public',
  })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState('')

  useEffect(() => {
    if (tab !== 'settings') return
    fetch('/api/admin/youtube/settings')
      .then(r => r.json())
      .then(d => { if (d.settings) setYtSettings(s => ({ ...s, ...d.settings })) })
      .catch(() => {})
  }, [tab])

  async function saveSettings() {
    setSettingsSaving(true)
    setSettingsMsg('')
    try {
      const res = await fetch('/api/admin/youtube/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: ytSettings }),
      })
      setSettingsMsg(res.ok ? '✅ Settings saved' : '❌ Failed to save')
    } finally {
      setSettingsSaving(false)
    }
  }

  const tokenDot = channel?.tokenStatus === 'connected' ? 'bg-green-400' :
                   channel?.tokenStatus === 'expired'   ? 'bg-amber-400' : 'bg-gray-400'

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[#0B1628] mb-6">YouTube Channel Manager</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tabs */}
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
          {/* ── TAB: Channel Status ── */}
          {tab === 'status' && (
            <div className="space-y-5">
              {channelLoading && <div className="flex items-center gap-2 text-gray-500"><Spinner /> Loading channel info…</div>}
              {channelError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                  {channelError}
                </div>
              )}
              {channel && !channelLoading && (
                <>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Channel', value: channel.title },
                      { label: 'Subscribers', value: Number(channel.subscriberCount).toLocaleString() },
                      { label: 'Total Videos', value: Number(channel.videoCount).toLocaleString() },
                      { label: 'Handle', value: channel.customUrl || '—' },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                        <p className="font-semibold text-[#0B1628] truncate">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${tokenDot}`} />
                      <div>
                        <p className="text-sm font-medium text-[#0B1628] capitalize">
                          OAuth2: {channel.tokenStatus}
                        </p>
                        {channel.tokenExpiry && (
                          <p className="text-xs text-gray-500">Expires: {channel.tokenExpiry}</p>
                        )}
                      </div>
                    </div>
                    <a
                      href="/api/admin/youtube/reconnect"
                      className="text-sm bg-[#C9A84C] text-white px-4 py-2 rounded-lg hover:bg-[#b8973d] transition-colors"
                    >
                      Reconnect YouTube
                    </a>
                  </div>

                  {channel.channelId && (
                    <a
                      href={`https://youtube.com/channel/${channel.channelId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-[#C9A84C] hover:underline"
                    >
                      View channel on YouTube →
                    </a>
                  )}
                </>
              )}
              <button onClick={fetchChannel} className="text-sm text-gray-500 hover:text-gray-800 underline">
                Refresh
              </button>
            </div>
          )}

          {/* ── TAB: Published Shorts ── */}
          {tab === 'shorts' && (
            <div className="space-y-4">
              {shortsLoading && <div className="flex items-center gap-2 text-gray-500"><Spinner /> Loading…</div>}
              {!shortsLoading && shorts.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-8">No YouTube Shorts published yet.</p>
              )}
              {shorts.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Title', 'Published', 'Post', ''].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {shorts.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="py-3 px-3 max-w-[250px]">
                            <p className="font-medium text-[#0B1628] truncate">{s.title}</p>
                          </td>
                          <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                            {new Date(s.publishedAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3 text-gray-500 max-w-[160px]">
                            <span className="truncate block">{s.postTitle ?? '—'}</span>
                          </td>
                          <td className="py-3 px-3">
                            <a
                              href={s.youtubeVideoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded-full font-medium transition-colors whitespace-nowrap"
                            >
                              ▶ YouTube
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {shortsTotal > 20 && (
                <div className="flex items-center gap-2 justify-center pt-2">
                  <button
                    disabled={shortsPage === 1}
                    onClick={() => fetchShorts(shortsPage - 1)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:border-[#C9A84C] transition-colors"
                  >
                    ← Prev
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {shortsPage} of {Math.ceil(shortsTotal / 20)}
                  </span>
                  <button
                    disabled={shortsPage * 20 >= shortsTotal}
                    onClick={() => fetchShorts(shortsPage + 1)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:border-[#C9A84C] transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Generate Short ── */}
          {tab === 'generate' && (
            <div className="max-w-lg space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Published Post</label>
                <select
                  value={selectedPost}
                  onChange={e => setSelectedPost(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                >
                  <option value="">— Choose a post —</option>
                  {posts.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              {genStep >= 0 && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {STEPS.map((step, i) => (
                    <div key={i} className={`flex items-center gap-2 text-sm transition-opacity ${i > genStep ? 'opacity-30' : 'opacity-100'}`}>
                      {i < genStep ? (
                        <span className="text-green-500">✓</span>
                      ) : i === genStep ? (
                        generating ? <Spinner /> : <span className="text-green-500">✓</span>
                      ) : (
                        <span className="text-gray-300">○</span>
                      )}
                      <span className={i === genStep && generating ? 'font-medium text-[#0B1628]' : 'text-gray-500'}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {genError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{genError}</div>
              )}

              {genResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-700 mb-2">YouTube Short published! 🎉</p>
                  <a
                    href={genResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-600 hover:underline"
                  >
                    View on YouTube →
                  </a>
                </div>
              )}

              <button
                onClick={generateShort}
                disabled={!selectedPost || generating}
                className="bg-[#C9A84C] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#b8973d] disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {generating && <Spinner />}
                {generating ? 'Generating…' : 'Generate YouTube Short'}
              </button>
            </div>
          )}

          {/* ── TAB: Settings ── */}
          {tab === 'settings' && (
            <div className="max-w-lg space-y-5">
              {[
                { key: 'titleTemplate',       label: 'Title Template',       type: 'text',   hint: 'Use {title} for post title' },
                { key: 'descriptionTemplate', label: 'Description Template', type: 'textarea', hint: 'Use {title}, {url}' },
                { key: 'hashtags',            label: 'Default Hashtags',     type: 'text',   hint: 'Space-separated' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={ytSettings[f.key as keyof typeof ytSettings] as string}
                      onChange={e => setYtSettings(s => ({ ...s, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={ytSettings[f.key as keyof typeof ytSettings] as string}
                      onChange={e => setYtSettings(s => ({ ...s, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                    />
                  )}
                  {f.hint && <p className="text-xs text-gray-400 mt-1">{f.hint}</p>}
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Privacy</label>
                  <select
                    value={ytSettings.privacy}
                    onChange={e => setYtSettings(s => ({ ...s, privacy: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category ID</label>
                  <input
                    type="text"
                    value={ytSettings.category}
                    onChange={e => setYtSettings(s => ({ ...s, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ytSettings.madeForKids}
                  onChange={e => setYtSettings(s => ({ ...s, madeForKids: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Made for kids</span>
              </label>

              <div className="flex items-center gap-4">
                <button
                  onClick={saveSettings}
                  disabled={settingsSaving}
                  className="bg-[#C9A84C] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#b8973d] disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {settingsSaving && <Spinner />}
                  Save Settings
                </button>
                {settingsMsg && <span className="text-sm">{settingsMsg}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
