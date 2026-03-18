'use client'

import { useState } from 'react'
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
  const [loading, setLoading]       = useState(false)
  const [saving,  setSaving]        = useState(false)
  const [delegating, setDelegating] = useState(false)
  const [tab, setTab]               = useState<'preview' | 'edit' | 'seo' | 'raw'>('preview')
  const [adminKey, setAdminKey]     = useState('')
  const [post, setPost]             = useState(initial)
  const [confirm, setConfirm]       = useState<'PUBLISHED' | 'REJECTED' | 'DELETE' | null>(null)
  const [saveMsg, setSaveMsg]       = useState<string | null>(null)
  const [delegateMsg, setDelegateMsg] = useState<string | null>(null)

  const metaTitleOk  = post.metaTitle.length >= 50 && post.metaTitle.length <= 60
  const metaDescOk   = post.metaDesc.length  >= 145 && post.metaDesc.length  <= 158
  const wordCountOk  = post.wordCount >= 1500
  const hasStats     = /according to|research shows|survey found|per the|data from/i.test(post.content)
  const hasTable     = post.content.includes('|---|')
  const hasCallouts  = /[💡📊⚠️✅]/.test(post.content)
  const hasAnecdotes = (post.content.match(/\[INSERT PERSONAL ANECDOTE/gi) || []).length >= 3
  const hasH2        = (post.content.match(/^## /gm) || []).length >= 4

  const seoChecks = [
    { ok: metaTitleOk,  label: `Meta title (${post.metaTitle.length} chars, target 50-60)` },
    { ok: metaDescOk,   label: `Meta desc (${post.metaDesc.length} chars, target 145-158)` },
    { ok: wordCountOk,  label: `Word count (${post.wordCount.toLocaleString()}, min 1,500)` },
    { ok: hasStats,     label: 'Contains real statistics / sources' },
    { ok: hasTable,     label: 'Comparison table present' },
    { ok: hasCallouts,  label: 'Callout boxes (💡/📊/⚠️) present' },
    { ok: hasAnecdotes, label: 'E-E-A-T anecdote placeholders (×3)' },
    { ok: hasH2,        label: `H2 sections (${(post.content.match(/^## /gm) || []).length} found, min 4)` },
  ]
  const seoScore = Math.round((seoChecks.filter((c) => c.ok).length / seoChecks.length) * 100)

  function getKey() {
    if (adminKey) return adminKey
    const k = window.prompt('Enter admin API key:') || ''
    if (k) setAdminKey(k)
    return k
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

  async function delegateToCloud() {
    const key = getKey()
    if (!key) return
    setDelegating(true)
    setDelegateMsg(null)
    const res = await fetch(`/api/admin/posts/${post.id}/delegate`, {
      method: 'POST',
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
    setDelegating(false)
    if (res.ok) {
      const { post: updated } = await res.json()
      setPost((p) => ({
        ...p,
        title:       updated.title,
        slug:        updated.slug,
        excerpt:     updated.excerpt,
        content:     updated.content,
        metaTitle:   updated.metaTitle,
        metaDesc:    updated.metaDesc,
        wordCount:   updated.wordCount,
        readingTime: updated.readingTime,
        status:      updated.status,
      }))
      setDelegateMsg('Regenerated ✓')
      setTimeout(() => setDelegateMsg(null), 5000)
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
      setDelegateMsg(`Error: ${error}`)
    }
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

          {/* Delegate to cloud agent */}
          <button
            onClick={delegateToCloud}
            disabled={delegating || saving}
            title="Save modifications and regenerate article content using the cloud AI agent"
            className={`px-4 py-2 text-sm border rounded-xl transition-colors disabled:opacity-50 ${
              delegateMsg?.startsWith('Error') ? 'border-red-300 text-red-600' :
              delegateMsg ? 'border-green-300 text-green-700 bg-green-50' :
              'border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-400'
            }`}
          >
            {delegating ? 'Delegating…' : delegateMsg ?? '☁ Delegate to cloud agent'}
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
        {(['preview', 'edit', 'seo', 'raw'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium capitalize -mb-px border-b-2 transition-colors ${
              tab === t
                ? 'border-gold text-gold'
                : 'border-transparent text-muted hover:text-navy'
            }`}
          >
            {t}
            {t === 'seo' && (
              <span className={`ml-2 text-xs font-bold ${seoScore >= 80 ? 'text-green-500' : seoScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                {seoScore}%
              </span>
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
    </div>
  )
}
