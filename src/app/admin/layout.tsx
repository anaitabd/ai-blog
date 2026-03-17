import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-semibold text-lg">
            Blog Admin
          </Link>
          <Link href="/admin/posts" className="text-sm text-gray-600 hover:text-gray-900">
            Posts
          </Link>
          <Link href="/admin/topics" className="text-sm text-gray-600 hover:text-gray-900">
            Topics
          </Link>
        </div>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
          View site →
        </Link>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
