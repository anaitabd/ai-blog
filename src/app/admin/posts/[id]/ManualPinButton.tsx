'use client'

import { useState } from 'react'

export default function ManualPinButton({ postId }: { postId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function pinNow() {
    setLoading(true)
    const res = await fetch(`/api/admin/pinterest/pin/${postId}`, {
      method: 'POST',
      headers: { 'x-admin-key': localStorage.getItem('adminKey') ?? '' },
    })
    const data = await res.json()
    setResult(data.success ? `Pinned! ${data.pinUrl}` : `Failed to pin to Pinterest: ${data.error}`)
    setLoading(false)
  }

  return (
    <div className="mt-4">
      {result && <p className="text-xs text-gray-600 mb-2">{result}</p>}
      <button
        onClick={pinNow}
        disabled={loading}
        className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
        style={{ backgroundColor: loading ? '#999' : '#E60023' }}
      >
        {loading ? 'Pinning...' : '📌 Pin to Pinterest Now'}
      </button>
    </div>
  )
}
