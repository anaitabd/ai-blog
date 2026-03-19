'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ArticleBody from '@/components/ArticleBody'

interface Post {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  metaTitle: string
  metaDesc: string
  wordCount: number
  readingTime: number
  status: string
  featured: boolean
  featuredImage: string | null
  category: { name: string }
  tags: { id: string; name: string }[]
}

interface YoutubeShort {
  id:              string
  youtubeVideoId:  string
  youtubeVideoUrl: string
  title:           string
  caption:         string | null
  publishedAt:     string
}

function SeoIndicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${ok ? 'text-green-600' : 'text-red-500'}`}>
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      {label}
    </div>
  )
}

export default function PostReviewer({ post: initial }: { post: Post }) {
  const router = useRouter()
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [improving, setImproving] = useState(false)
  const [improveMsg, setImproveMsg] = useState<string | null>(null)
  const [tab, setTab] = useState<'preview' | 'edit' | 'seo' | 'raw' | 'youtube'>('preview')
  const [adminKey, setAdminKey] = useState('')
  const [post, setPost]       = useState(initial)
  const [confirm, setConfirm] = useState<'PUBLISHED' | 'REJECTED' | 'DELETE' | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // ── YouTube Shorts state ──────────────────────────────────────────────────
  const [ytShorts,       setYtShorts]       = useState<YoutubeShort[]>([])
  const [ytLoaded,       setYtLoaded]       = useState(false)
  const [ytGenerating,   setYtGenerating]   = useState(false)
  const [ytExecutionArn, setYtExecutionArn] = useState<string | null>(null)
  const [ytStatus,       setYtStatus]       = useState<'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | null>(null)
  const [ytMsg,          setYtMsg]          = useState<string | null>(null)
  const [ytStarted,      setYtStarted]      = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const keyRef  = useRef('')

  const metaTitleOk  = post.metaTitle.length >= 50 && post.metaTitle.length <= 60
  const metaDescOk   = post.metaDesc.length  >= 145 && post.metaDesc.length  <= 158
  const wordCountOk  = post.wordCount >= 1500
  const hasStats     = /according to|research shows|survey found|per the|data from/i.test(post.content)
  const hasTable     = post.content.includes('|---|')
  const hasCallouts  = /[💡📊⚠️✅]/.test(post.content)
  const hasAnecdotes = (post.content.match(/\[INSERT PERSONAL ANECDOTE/gi) || []).length >= 3
  const hasH2        = (post.content.match(/^## /gm) || []).length >= 4

  const seoChecks = [
    { key: 'metaTitle', ok: metaTitleOk,  label: `Meta title (${post.metaTitle.length} chars, target 50-60)` },
    { key: 'metaDesc',  ok: metaDescOk,   label: `Meta desc (${post.metaDesc.length} chars, target 145-158)` },
    { key: 'wordCount', ok: wordCountOk,  label: `Word count (${post.wordCount.toLocaleString()}, min 1,500)` },
    { key: 'stats',     ok: hasStats,     label: 'Contains real statistics / sources' },
    { key: 'table',     ok: hasTable,     label: 'Comparison table present' },
    { key: 'callouts',  ok: hasCallouts,  label: 'Callout boxes (💡/📊/⚠️) present' },
    { key: 'anecdotes', ok: hasAnecdotes, label: 'E-E-A-T anecdote placeholders (×3)' },
    { key: 'h2count',   ok: hasH2,        label: `H2 sections (${(post.content.match(/^## /gm) || []).length} found, min 4)` },
  ]
  const seoScore = Math.round((seoChecks.filter((c) => c.ok).length / seoChecks.length) * 100)

  function getKey() {
    if (adminKey) return adminKey
    const k = window.prompt('Enter admin API key:') || ''
    if (k) setAdminKey(k)
    return k
  }

  async function improvePost() {
    const key = getKey()
    if (!key) return
    const failing = seoChecks.filter((c) => !c.ok).map((c) => c.key)
    if (failing.length === 0) return
    setImproving(true)
    setImproveMsg(null)
    try {
      const res = await fetch(`/api/admin/posts/${post.id}/improve`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({
          content:      post.content,
          metaTitle:    post.metaTitle,
          metaDesc:     post.metaDesc,
          keyword:      post.title,
          failingChecks: failing,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? data.error ?? 'Unknown error')
      const { improved } = data
      // Merge improvements into post state
      setPost((p) => ({
        ...p,
        ...(improved.metaTitle && { metaTitle: improved.metaTitle }),
        ...(improved.metaDesc  && { metaDesc:  improved.metaDesc }),
        ...(improved.content   && {
          content:     improved.content,
          wordCount:   improved.content.trim().split(/\s+/).filter(Boolean).length,
          readingTime: Math.ceil(improved.content.trim().split(/\s+/).filter(Boolean).length / 215),
        }),
      }))
      setImproveMsg('✅ Applied! Review changes then Save.')
    } catch (err) {
      setImproveMsg(`❌ ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImproving(false)
    }
  }

  // ── YouTube helpers ───────────────────────────────────────────────────────
  async function fetchShorts(key: string) {
    const res = await fetch(`/api/admin/posts/${post.id}/youtube`, {
      headers: { 'x-admin-key': key },
    })
    if (res.ok) {
      const { shorts } = await res.json()
      setYtShorts(shorts)
      setYtLoaded(true)
    }
  }

  useEffect(() => {
    if (tab === 'youtube' && !ytLoaded && adminKey) fetchShorts(adminKey)
  }, [tab, ytLoaded, adminKey])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function pollExecution(execArn: string) {
    try {
      const res  = await fetch(
        `/api/admin/posts/${post.id}/youtube/generate?executionArn=${encodeURIComponent(execArn)}`,
        { headers: { 'x-admin-key': keyRef.current } },
      )
      const data = await res.json()
      setYtStatus(data.status)
      if (data.status === 'SUCCEEDED') {
        clearInterval(pollRef.current!)
        setYtGenerating(false)
        setYtMsg('✅ Shorts published to YouTube!')
        fetchShorts(keyRef.current)
      } else if (['FAILED', 'TIMED_OUT', 'ABORTED'].includes(data.status)) {
        clearInterval(pollRef.current!)
        setYtGenerating(false)
        setYtMsg(`❌ Generation ${data.status.toLowerCase()}`)
      }
    } catch { /* keep polling */ }
  }

  async function generateShorts() {
    const key = getKey()
    if (!key) return
    keyRef.current = key
    setYtGenerating(true)
    setYtMsg(null)
    setYtStatus('RUNNING')
    setYtStarted(Date.now())
    try {
      const res  = await fetch(`/api/admin/posts/${post.id}/youtube/generate`, {
        method:  'POST',
        headers: { 'x-admin-key': key, 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start generation')
      setYtExecutionArn(data.executionArn)
      pollRef.current = setInterval(() => pollExecution(data.executionArn), 15_000)
    } catch (err) {
      setYtGenerating(false)
      setYtStatus('FAILED')
      setYtMsg(`❌ ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function ytElapsed() {
    if (!ytStarted) return ''
    const s = Math.floor((Date.now() - ytStarted) / 1000)
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  }

  async function updateStatus(status: 'PUBLISHED' | 'REJECTED') {
    const key = getKey()
    if (!key) return
    setLoading(true)
    const res = await fetch(`/api/admin/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({ status, title: post.title, metaTitle: post.metaTitle, metaDesc: post.metaDesc }),
    })
    setLoading(false)
    setConfirm(null)
    if (res.ok) {
      router.push('/admin/posts')
      router.refresh()
    } else {
      alert('Failed to update post status')
    }
  }

  async function saveChanges() {
    const key = getKey()
    if (!key) return
    setSaving(true)
    setSaveMsg(null)
    const res = await fetch(`/api/admin/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({
        title:     post.title,
        content:   post.content,
        excerpt:   post.excerpt,
        slug:      post.slug,
        metaTitle: post.metaTitle,
        metaDesc:  post.metaDesc,
        featured:  post.featured,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const { post: updated } = await res.json()
      setPost((p) => ({ ...p, wordCount: updated.wordCount, readingTime: updated.readingTime, slug: updated.slug }))
      setSaveMsg('Saved ✓')
      setTimeout(() => setSaveMsg(null), 3000)
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
      setSaveMsg(`Error: ${error}`)
    }
  }

  async function changeStatus(status: 'DRAFT' | 'REVIEW') {
    const key = getKey()
    if (!key) return
    setLoading(true)
    const res = await fetch(`/api/admin/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({ status }),
    })
    setLoading(false)
    if (res.ok) setPost((p) => ({ ...p, status }))
  }

  async function deletePost() {
    const key = getKey()
    if (!key) return
    setLoading(true)
    const res = await fetch(`/api/admin/posts/${post.id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': key },
    })
    setLoading(false)
    setConfirm(null)
    if (res.ok) {
      router.push('/admin/posts')
      router.refresh()
    } else {
      alert('Failed to delete post')
    }
  }

  const STATUS_COLOR: Record<string, string> = {
    PUBLISHED: 'text-green-600',
    REVIEW:    'text-amber-600',
    REJECTED:  'text-red-600',
    DRAFT:     'text-muted',
  }

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted hover:text-navy mb-2 block transition-colors"
          >
            ← Back
          </button>
          <textarea
            value={post.title}
            onChange={(e) => setPost({ ...post, title: e.target.value })}
            rows={2}
            className="text-xl font-serif font-bold text-[#1A1A2E] max-w-2xl w-full resize-none bg-transparent border-b border-transparent hover:border-border focus:border-gold focus:outline-none leading-snug"
          />
          <p className="text-sm text-muted mt-1">
            {post.category.name} · {post.wordCount.toLocaleString()} words · {post.readingTime} min read ·{' '}
            <span className={`font-medium ${STATUS_COLOR[post.status] ?? 'text-muted'}`}>{post.status}</span>
          </p>
        </div>

        <div className="flex gap-2 shrink-0 flex-wrap">
          {/* Save */}
          <button
            onClick={saveChanges}
            disabled={saving}
            className={`px-4 py-2 text-sm border rounded-xl transition-colors disabled:opacity-50 ${
              saveMsg?.startsWith('Error') ? 'border-red-300 text-red-600' :
              saveMsg ? 'border-green-300 text-green-700 bg-green-50' :
              'border-border hover:bg-cream-2 hover:border-navy'
            }`}
          >
            {saving ? 'Saving…' : saveMsg ?? 'Save Changes'}
          </button>

          {/* Status transitions */}
          {post.status === 'REVIEW' && (
            <>
              <button
                onClick={() => setConfirm('REJECTED')}
                disabled={loading}
                className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-red-50 hover:border-red-300 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => setConfirm('PUBLISHED')}
                disabled={loading}
                className="px-4 py-2 text-sm bg-gold hover:bg-gold-2 text-navy font-semibold rounded-xl disabled:opacity-50 transition-colors"
              >
                {loading ? 'Publishing…' : 'Publish ✓'}
              </button>
            </>
          )}

          {post.status === 'DRAFT' && (
            <button
              onClick={() => changeStatus('REVIEW')}
              disabled={loading}
              className="px-4 py-2 text-sm bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold rounded-xl disabled:opacity-50 transition-colors"
            >
              Send to Review
            </button>
          )}

          {(post.status === 'PUBLISHED' || post.status === 'REJECTED') && (
            <button
              onClick={() => changeStatus('DRAFT')}
              disabled={loading}
              className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-cream-2 hover:border-navy transition-colors disabled:opacity-50"
            >
              Move to Draft
            </button>
          )}

          {post.status === 'PUBLISHED' && (
            <a
              href={`/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm border border-green-200 text-green-700 hover:bg-green-50 rounded-xl transition-colors"
            >
              View live →
            </a>
          )}

          {/* Delete */}
          <button
            onClick={() => setConfirm('DELETE')}
            disabled={loading}
            title="Delete post permanently"
            className="px-4 py-2 text-sm border border-border rounded-xl text-muted hover:bg-red-50 hover:border-red-300 hover:text-red-700 disabled:opacity-50 transition-colors"
          >
            🗑
          </button>
        </div>
      </div>

      {/* ── Confirmation modal ────────────────────────────────── */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-serif text-lg font-bold mb-2">
              {confirm === 'PUBLISHED' && 'Publish this article?'}
              {confirm === 'REJECTED'  && 'Reject this article?'}
              {confirm === 'DELETE'    && 'Delete permanently?'}
            </h3>
            <p className="text-sm text-muted mb-5">
              {confirm === 'PUBLISHED' && 'The article will go live immediately on your site.'}
              {confirm === 'REJECTED'  && 'The article will be archived as rejected.'}
              {confirm === 'DELETE'    && 'This action cannot be undone. The article will be permanently removed from your database.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-cream-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { if (confirm === 'DELETE') deletePost(); else updateStatus(confirm) }}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                  confirm === 'PUBLISHED'
                    ? 'bg-gold hover:bg-gold-2 text-navy'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {confirm === 'PUBLISHED' && 'Publish'}
                {confirm === 'REJECTED'  && 'Reject'}
                {confirm === 'DELETE'    && 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border">
        {(['preview', 'edit', 'seo', 'raw', 'youtube'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium capitalize -mb-px border-b-2 transition-colors ${
              tab === t
                ? 'border-gold text-gold'
                : 'border-transparent text-muted hover:text-navy'
            }`}
          >
            {t === 'youtube' ? '▶ YouTube' : t}
            {t === 'seo' && (
              <span className={`ml-2 text-xs font-bold ${seoScore >= 80 ? 'text-green-500' : seoScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                {seoScore}%
              </span>
            )}
            {t === 'youtube' && ytShorts.length > 0 && (
              <span className="ml-1.5 text-xs font-bold text-red-500">{ytShorts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Preview tab ──────────────────────────────────────── */}
      {tab === 'preview' && (
        <div className="bg-white rounded-2xl border border-border p-6 max-w-3xl">
          {post.featuredImage && (
            <img src={post.featuredImage} alt={post.title} className="w-full h-64 object-cover rounded-xl mb-6" />
          )}
          <ArticleBody content={post.content} />
        </div>
      )}

      {/* ── Edit tab ─────────────────────────────────────────── */}
      {tab === 'edit' && (
        <div className="space-y-5 max-w-3xl">
          <div>
            <label className="block text-xs text-muted uppercase tracking-widest mb-1">
              Excerpt ({post.excerpt.length}/160)
            </label>
            <textarea
              value={post.excerpt}
              onChange={(e) => setPost({ ...post, excerpt: e.target.value })}
              rows={3}
              maxLength={165}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-muted uppercase tracking-widest mb-1">URL Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted shrink-0">wealthbeginners.com/</span>
              <input
                value={post.slug}
                onChange={(e) =>
                  setPost({ ...post, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })
                }
                className="flex-1 border border-border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-gold"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="featured-edit"
              checked={post.featured}
              onChange={(e) => setPost({ ...post, featured: e.target.checked })}
              className="w-4 h-4 accent-gold"
            />
            <label htmlFor="featured-edit" className="text-sm text-[#1A1A2E]">
              Featured article (shown in homepage hero)
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-muted uppercase tracking-widest">
                Content (Markdown)
              </label>
              <span className="text-xs text-muted">
                {post.content.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words · preview updates live
              </span>
            </div>
            <textarea
              value={post.content}
              onChange={(e) => setPost({ ...post, content: e.target.value })}
              rows={32}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-gold resize-y leading-relaxed"
              placeholder="# Article Title&#10;&#10;Write your markdown content here…"
              spellCheck={false}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={saveChanges}
              disabled={saving}
              className="px-6 py-2.5 bg-gold hover:bg-gold-2 text-navy font-semibold rounded-xl text-sm disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saveMsg && (
              <span className={`text-sm ${saveMsg.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {saveMsg}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── SEO tab ──────────────────────────────────────────── */}
      {tab === 'seo' && (
        <div className="bg-white rounded-2xl border border-border p-6 space-y-6 max-w-2xl">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted uppercase tracking-widest font-semibold">SEO Score</p>
              <span className={`text-2xl font-serif font-bold ${seoScore >= 80 ? 'text-green-600' : seoScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                {seoScore}%
              </span>
            </div>
            <div className="w-full bg-cream-2 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${seoScore >= 80 ? 'bg-green-500' : seoScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${seoScore}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            {seoChecks.map((c) => <SeoIndicator key={c.label} ok={c.ok} label={c.label} />)}
          </div>

          {/* ── Improve button ── */}
          {seoChecks.some((c) => !c.ok) && (
            <div className="pt-1 border-t border-border space-y-2">
              <button
                onClick={improvePost}
                disabled={improving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#1A1A2E] hover:bg-navy text-[#C9A84C] border border-[#C9A84C]/30 hover:border-[#C9A84C]/60 disabled:opacity-50 transition-all"
              >
                {improving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                    </svg>
                    Improving with AI…
                  </>
                ) : (
                  <>
                    ✨ Improve {seoChecks.filter((c) => !c.ok).length} failing check{seoChecks.filter((c) => !c.ok).length > 1 ? 's' : ''}
                  </>
                )}
              </button>
              {improveMsg && (
                <p className={`text-xs text-center font-medium ${improveMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
                  {improveMsg}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="text-xs text-muted mb-1">Word count (target 1,500–1,900)</p>
            <div className="w-full bg-cream-2 rounded-full h-2 mb-1">
              <div
                className={`h-2 rounded-full transition-all ${
                  post.wordCount >= 1500 && post.wordCount <= 1900
                    ? 'bg-green-500'
                    : post.wordCount > 1900
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min((post.wordCount / 2000) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted">{post.wordCount.toLocaleString()} / 2,000 words</p>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div>
              <label className="block text-xs text-muted uppercase tracking-widest mb-1">
                Meta Title ({post.metaTitle.length}/60)
              </label>
              <input
                value={post.metaTitle}
                onChange={(e) => setPost({ ...post, metaTitle: e.target.value })}
                className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors ${metaTitleOk ? 'border-green-300' : 'border-red-300'}`}
              />
            </div>
            <div>
              <label className="block text-xs text-muted uppercase tracking-widest mb-1">
                Meta Description ({post.metaDesc.length}/158)
              </label>
              <textarea
                value={post.metaDesc}
                onChange={(e) => setPost({ ...post, metaDesc: e.target.value })}
                rows={3}
                className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors resize-none ${metaDescOk ? 'border-green-300' : 'border-red-300'}`}
              />
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-1">URL Slug</p>
              <p className="text-sm font-mono bg-cream-2 px-3 py-2 rounded-xl">/{post.slug}</p>
            </div>
            <button
              onClick={saveChanges}
              disabled={saving}
              className="px-4 py-2 text-sm bg-gold hover:bg-gold-2 text-navy font-semibold rounded-xl disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : saveMsg ?? 'Save Meta Changes'}
            </button>
          </div>

          <div className="border border-border rounded-xl p-4 bg-cream">
            <p className="text-xs text-muted mb-2 uppercase tracking-widest">Google SERP Preview</p>
            <p className="text-blue-700 text-base font-medium">{post.metaTitle}</p>
            <p className="text-green-700 text-xs mt-0.5">wealthbeginners.com/{post.slug}</p>
            <p className="text-gray-600 text-sm mt-1">{post.metaDesc}</p>
          </div>

          <div>
            <p className="text-xs text-muted uppercase tracking-widest mb-2">Tags</p>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag.id} className="bg-cream-2 text-muted text-xs px-2.5 py-1 rounded-full border border-border">
                  {tag.name}
                </span>
              ))}
              {post.tags.length === 0 && <span className="text-xs text-muted">No tags — edit the post to add them.</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── Raw tab ──────────────────────────────────────────── */}
      {tab === 'raw' && (
        <pre className="bg-navy text-[#9FE1CB] rounded-2xl p-6 text-xs overflow-auto max-h-[600px] leading-relaxed">
          {post.content}
        </pre>
      )}

      {/* ── YouTube Shorts tab ───────────────────────────────── */}
      {tab === 'youtube' && (
        <div className="space-y-6 max-w-2xl">

          {/* Generate button + status */}
          <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-semibold text-[#1A1A2E]">YouTube Shorts</h3>
                <p className="text-xs text-muted mt-0.5">
                  Generates 3 AI video scripts + Nova Reel videos, then publishes to your channel. Takes ~15–25 min.
                </p>
              </div>
              <button
                onClick={generateShorts}
                disabled={ytGenerating}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
              >
                {ytGenerating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>▶ Generate &amp; Publish Shorts</>
                )}
              </button>
            </div>

            {/* Progress / status banner */}
            {ytStatus === 'RUNNING' && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 animate-spin text-red-500 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-700">Generating videos with Nova Reel…</p>
                  <p className="text-xs text-red-500 mt-0.5">Elapsed: {ytElapsed()} · polling every 15s</p>
                </div>
              </div>
            )}
            {ytMsg && (
              <p className={`text-sm font-medium ${ytMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {ytMsg}
              </p>
            )}
          </div>

          {/* Published shorts list */}
          {ytLoaded && ytShorts.length === 0 && !ytGenerating && (
            <div className="bg-white rounded-2xl border border-border px-6 py-10 text-center">
              <p className="text-4xl mb-3">▶</p>
              <p className="text-sm font-medium text-[#1A1A2E]">No YouTube Shorts yet</p>
              <p className="text-xs text-muted mt-1">Click "Generate &amp; Publish Shorts" to create 3 short-form videos from this article.</p>
            </div>
          )}

          {ytShorts.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted uppercase tracking-widest font-semibold">
                {ytShorts.length} Short{ytShorts.length > 1 ? 's' : ''} Published
              </p>
              {ytShorts.map((s, i) => (
                <div key={s.id} className="bg-white rounded-2xl border border-border p-5 flex items-start gap-4">
                  {/* Thumbnail placeholder */}
                  <div className="w-16 h-28 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0 text-2xl">
                    ▶
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted uppercase tracking-widest mb-1">Short #{i + 1}</p>
                    <p className="font-medium text-sm text-[#1A1A2E] mb-1 truncate">{s.title}</p>
                    {s.caption && (
                      <p className="text-xs text-muted line-clamp-2 mb-2">{s.caption}</p>
                    )}
                    <a
                      href={s.youtubeVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      Watch on YouTube →
                    </a>
                    <p className="text-xs text-muted mt-1">
                      Published {new Date(s.publishedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
