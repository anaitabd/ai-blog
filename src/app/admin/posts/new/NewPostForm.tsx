'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Category {
  id: string
  name: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 75)
    .replace(/^-|-$/g, '')
}

export default function NewPostForm({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [adminKey, setAdminKey] = useState('')

  const [form, setForm] = useState({
    title:      '',
    excerpt:    '',
    content:    '',
    categoryId: categories[0]?.id ?? '',
    metaTitle:  '',
    metaDesc:   '',
    slug:       '',
    tagNames:   '',
    featured:   false,
  })

  // Track whether the user has manually edited slug / metaTitle
  const [slugTouched,      setSlugTouched]      = useState(false)
  const [metaTitleTouched, setMetaTitleTouched] = useState(false)

  function handleTitleChange(value: string) {
    setForm((f) => ({
      ...f,
      title:     value,
      slug:      slugTouched      ? f.slug      : slugify(value),
      metaTitle: metaTitleTouched ? f.metaTitle : value.slice(0, 55) + (value.length > 30 ? ' | WealthBeginners' : ''),
    }))
  }

  const wordCount = form.content.trim().split(/\s+/).filter(Boolean).length
  const metaTitleOk = form.metaTitle.length >= 50 && form.metaTitle.length <= 60
  const metaDescOk  = form.metaDesc.length  >= 145 && form.metaDesc.length  <= 158

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const key = adminKey || window.prompt('Enter admin API key:') || ''
    if (!key) return
    setAdminKey(key)
    setSaving(true)
    setError(null)

    const tagNames = form.tagNames
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)

    const res = await fetch('/api/admin/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({
        ...form,
        slug: form.slug || undefined,
        tagNames,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const { post } = await res.json()
      router.push(`/admin/posts/${post.id}`)
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: 'Unknown error' }))
      setError(msg ?? 'Failed to create post')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

      {/* Admin API Key */}
      <div>
        <label className="block text-xs text-muted uppercase tracking-widest mb-1">Admin API Key</label>
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="Paste your key here…"
          className="w-full max-w-xs border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold"
        />
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs text-muted uppercase tracking-widest mb-1">Title *</label>
        <input
          required
          value={form.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-gold"
          placeholder="How to Build an Emergency Fund from Scratch in 2026"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="block text-xs text-muted uppercase tracking-widest mb-1">
          URL Slug <span className="normal-case text-muted font-normal">(auto-generated from title)</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted shrink-0">wealthbeginners.com/</span>
          <input
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true)
              setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }))
            }}
            className="flex-1 border border-border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-gold"
            placeholder="how-to-build-emergency-fund-2026"
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs text-muted uppercase tracking-widest mb-1">Category *</label>
        <select
          required
          value={form.categoryId}
          onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold bg-white"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Excerpt */}
      <div>
        <label className="block text-xs text-muted uppercase tracking-widest mb-1">
          Excerpt * ({form.excerpt.length}/160)
        </label>
        <textarea
          required
          value={form.excerpt}
          onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
          rows={3}
          maxLength={165}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold resize-none"
          placeholder="A compelling 145–158 char excerpt that makes someone want to read…"
        />
      </div>

      {/* Meta Title */}
      <div>
        <label className="block text-xs text-muted uppercase tracking-widests mb-1">
          Meta Title * ({form.metaTitle.length}/60)
        </label>
        <input
          required
          value={form.metaTitle}
          onChange={(e) => {
            setMetaTitleTouched(true)
            setForm((f) => ({ ...f, metaTitle: e.target.value }))
          }}
          maxLength={65}
          className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors ${
            metaTitleOk ? 'border-green-300' : form.metaTitle.length > 0 ? 'border-amber-300' : 'border-border'
          }`}
          placeholder="Keyword Phrase 2026 | WealthBeginners"
        />
        {form.metaTitle.length > 0 && !metaTitleOk && (
          <p className="text-xs text-amber-600 mt-1">Target: 50–60 characters</p>
        )}
      </div>

      {/* Meta Description */}
      <div>
        <label className="block text-xs text-muted uppercase tracking-widest mb-1">
          Meta Description * ({form.metaDesc.length}/158)
        </label>
        <textarea
          required
          value={form.metaDesc}
          onChange={(e) => setForm((f) => ({ ...f, metaDesc: e.target.value }))}
          rows={3}
          maxLength={165}
          className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold resize-none transition-colors ${
            metaDescOk ? 'border-green-300' : form.metaDesc.length > 0 ? 'border-amber-300' : 'border-border'
          }`}
          placeholder="145–158 char description with keyword and a compelling hook…"
        />
        {form.metaDesc.length > 0 && !metaDescOk && (
          <p className="text-xs text-amber-600 mt-1">Target: 145–158 characters</p>
        )}
      </div>

      {/* Content */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs text-muted uppercase tracking-widest">
            Content (Markdown)
          </label>
          <span className="text-xs text-muted">{wordCount.toLocaleString()} words</span>
        </div>
        <textarea
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          rows={20}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-gold resize-y leading-relaxed"
          placeholder="# Article Title&#10;&#10;Write your markdown content here…"
          spellCheck={false}
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs text-muted uppercase tracking-widest mb-1">
          Tags <span className="normal-case font-normal">(comma-separated)</span>
        </label>
        <input
          value={form.tagNames}
          onChange={(e) => setForm((f) => ({ ...f, tagNames: e.target.value }))}
          className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold"
          placeholder="budgeting, saving, emergency fund"
        />
        <p className="text-xs text-muted mt-1">Tags will be created automatically if they don&apos;t exist yet.</p>
      </div>

      {/* Featured */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="featured-new"
          checked={form.featured}
          onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
          className="w-4 h-4 accent-gold"
        />
        <label htmlFor="featured-new" className="text-sm text-[#1A1A2E]">
          Featured article (shown in homepage hero)
        </label>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-gold hover:bg-gold-2 text-navy font-semibold rounded-xl text-sm disabled:opacity-50 transition-colors"
        >
          {saving ? 'Creating…' : 'Create Post (Save as Draft)'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-cream-2 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
