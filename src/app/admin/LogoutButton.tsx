'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function logout() {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    router.replace('/admin/login')
  }

  return (
    <button
      onClick={logout}
      className="text-xs text-muted hover:text-red-600 transition-colors"
    >
      Sign out
    </button>
  )
}

