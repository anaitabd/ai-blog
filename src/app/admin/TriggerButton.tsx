'use client'

import { useState } from 'react'

export default function TriggerButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function trigger() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/trigger', {
        method: 'POST',
        headers: { 'x-admin-key': prompt('Enter admin API key:') ?? '' },
      })
      const data = await res.json()
      if (data.success) {
        setResult(`Pipeline started for: "${data.keyword}"`)
      } else {
        setResult(`Error: ${data.error}`)
      }
    } catch {
      setResult('Failed to trigger pipeline')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-sm text-gray-600">{result}</span>
      )}
      <button
        onClick={trigger}
        disabled={loading}
        className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Starting...' : 'Trigger pipeline'}
      </button>
    </div>
  )
}
