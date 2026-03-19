'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [key,     setKey]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/admin/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ key }),
    })
    setLoading(false)
    if (res.ok) {
      const from = searchParams.get('from') || '/admin'
      router.replace(from)
    } else {
      setError('Invalid API key. Try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-border shadow-sm p-8 space-y-5">
      <div>
        <label className="block text-xs text-muted uppercase tracking-widest mb-2">
          Admin API Key
        </label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Enter your admin key…"
          required
          autoFocus
          className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold transition-colors font-mono"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !key}
        className="w-full py-3 bg-[#1A1A2E] hover:bg-navy text-[#C9A84C] font-semibold rounded-xl text-sm disabled:opacity-50 transition-colors"
      >
        {loading ? 'Verifying…' : 'Sign in'}
      </button>
    </form>
  )
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <p className="font-serif text-3xl font-bold text-[#1A1A2E]">WB</p>
          <p className="text-sm text-muted mt-1">Admin Dashboard</p>
        </div>

        <Suspense fallback={<div className="h-48 bg-white rounded-2xl border border-border animate-pulse" />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-muted mt-6">
          <a href="/" className="hover:text-navy transition-colors">← Back to site</a>
        </p>
      </div>
    </div>
  )
}
