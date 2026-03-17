'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddTopicForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ keyword: '', category: '', priority: '5' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.keyword || !form.category) return
    setLoading(true)

    await fetch('/api/admin/topics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': localStorage.getItem('adminKey') ?? window.prompt('Enter admin API key:') ?? '',
      },
      body: JSON.stringify({
        keyword: form.keyword,
        category: form.category,
        priority: parseInt(form.priority),
      }),
    })

    setForm({ keyword: '', category: '', priority: '5' })
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Keyword / Topic</label>
        <input
          type="text"
          placeholder="e.g. best productivity apps for remote work"
          value={form.keyword}
          onChange={(e) => setForm({ ...form, keyword: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Category</label>
        <input
          type="text"
          placeholder="e.g. Productivity, Finance, Health"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Priority (1-10)</label>
        <input
          type="number"
          min="1"
          max="10"
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Adding...' : 'Add to queue'}
      </button>
    </form>
  )
}
