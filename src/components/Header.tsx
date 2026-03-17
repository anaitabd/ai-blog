import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function Header() {
  const categories = await prisma.category.findMany({
    take: 5,
    orderBy: { name: 'asc' },
  })

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="font-bold text-xl shrink-0 hover:text-blue-600 transition-colors">
          {process.env.NEXT_PUBLIC_SITE_NAME}
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              {cat.name}
            </Link>
          ))}
          <Link
            href="/about"
            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors whitespace-nowrap"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  )
}
