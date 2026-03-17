import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t mt-16 py-10 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between gap-6 mb-6">
          <div>
            <p className="font-bold text-lg mb-1">{process.env.NEXT_PUBLIC_SITE_NAME}</p>
            <p className="text-sm text-gray-500">
              Practical guides and insights, updated daily.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-800">Home</Link>
            <Link href="/about" className="hover:text-gray-800">About</Link>
            <Link href="/contact" className="hover:text-gray-800">Contact</Link>
            <Link href="/privacy-policy" className="hover:text-gray-800">Privacy Policy</Link>
            <Link href="/disclaimer" className="hover:text-gray-800">Disclaimer</Link>
          </nav>
        </div>
        <div className="border-t pt-4 text-xs text-gray-400">
          © {new Date().getFullYear()} {process.env.NEXT_PUBLIC_SITE_NAME}. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
