'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
  featuredImage: string | null
  category: { name: string }
  tags: { id: string; name: string }[]
}

export default function PostReviewer({ post }: { post: Post }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'preview' | 'seo' | 'raw'>('preview')
  const [adminKey, setAdminKey] = useState('')

  async function updateStatus(status: 'PUBLISHED' | 'REJECTED') {
    const key = adminKey || window.prompt('Enter admin API key:')
    if (!key) return
    setAdminKey(key)
    setLoading(true)
    const res = await fetch(`/api/admin/posts/${post.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': key,
      },
      body: JSON.stringify({ status }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/admin/posts')
      router.refresh()
    } else {
      alert('Failed to update post status')
    }
  }

  const metaTitleOk = post.metaTitle.length >= 10 && post.metaTitle.length <= 60
  const metaDescOk = post.metaDesc.length >= 100 && post.metaDesc.length <= 160

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-800 mb-2 block"
          >
            ← Back
          </button>
          <h2 className="text-xl font-semibold leading-tight max-w-2xl">{post.title}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {post.category.name} · {post.wordCount} words · {post.readingTime} min read
          </p>
        </div>

        {post.status === 'REVIEW' && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => updateStatus('REJECTED')}
              disabled={loading}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-red-50 hover:border-red-300 hover:text-red-700 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => updateStatus('PUBLISHED')}
              disabled={loading}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        )}

        {post.status === 'PUBLISHED' && (
          <a
            href={`/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View live →
          </a>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b">
        {(['preview', 'seo', 'raw'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize -mb-px border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'preview' && (
        <div className="bg-white rounded-xl border p-6 max-w-3xl">
          {post.featuredImage && (
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-56 object-cover rounded-lg mb-6"
            />
          )}
          <div className="prose max-w-none text-gray-700 leading-relaxed space-y-3">
            {post.content
              .split('\n')
              .filter(Boolean)
              .map((line, i) => {
                if (line.startsWith('## '))
                  return <h2 key={i} className="text-xl font-semibold mt-6 mb-2">{line.slice(3)}</h2>
                if (line.startsWith('### '))
                  return <h3 key={i} className="text-lg font-semibold mt-4 mb-1">{line.slice(4)}</h3>
                if (line.startsWith('# '))
                  return <h1 key={i} className="text-2xl font-bold mb-4">{line.slice(2)}</h1>
                if (line.startsWith('- '))
                  return <li key={i} className="ml-4">{line.slice(2)}</li>
                return <p key={i} className="text-sm">{line}</p>
              })}
          </div>
        </div>
      )}

      {tab === 'seo' && (
        <div className="bg-white rounded-xl border p-6 space-y-5 max-w-2xl">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Meta title ({post.metaTitle.length} chars)
            </p>
            <p className={`font-medium ${metaTitleOk ? 'text-green-700' : 'text-red-600'}`}>
              {post.metaTitle}
            </p>
            {!metaTitleOk && (
              <p className="text-xs text-red-500 mt-1">Should be 10-60 characters</p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Meta description ({post.metaDesc.length} chars)
            </p>
            <p className={`text-sm ${metaDescOk ? 'text-gray-700' : 'text-red-600'}`}>
              {post.metaDesc}
            </p>
            {!metaDescOk && (
              <p className="text-xs text-red-500 mt-1">Should be 100-160 characters</p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">URL slug</p>
            <p className="text-sm font-mono text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">
              /{post.slug}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Tags</p>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Google SERP preview</p>
            <div className="border rounded-lg p-4 bg-gray-50">
              <p className="text-blue-700 text-base hover:underline cursor-pointer font-medium">
                {post.metaTitle}
              </p>
              <p className="text-green-700 text-xs mt-0.5">
                {process.env.NEXT_PUBLIC_SITE_URL ?? 'https://yourdomain.com'}/{post.slug}
              </p>
              <p className="text-gray-600 text-sm mt-1">{post.metaDesc}</p>
            </div>
          </div>

          <div className="flex gap-4 text-sm">
            <div className={`flex items-center gap-1 ${metaTitleOk ? 'text-green-600' : 'text-red-500'}`}>
              <span>{metaTitleOk ? '✓' : '✗'}</span> Meta title
            </div>
            <div className={`flex items-center gap-1 ${metaDescOk ? 'text-green-600' : 'text-red-500'}`}>
              <span>{metaDescOk ? '✓' : '✗'}</span> Meta description
            </div>
            <div className={`flex items-center gap-1 ${post.wordCount >= 1500 ? 'text-green-600' : 'text-red-500'}`}>
              <span>{post.wordCount >= 1500 ? '✓' : '✗'}</span> Word count
            </div>
          </div>
        </div>
      )}

      {tab === 'raw' && (
        <pre className="bg-gray-900 text-green-400 rounded-xl p-6 text-xs overflow-auto max-h-[600px] leading-relaxed">
          {post.content}
        </pre>
      )}
    </div>
  )
}
