import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 — Page Not Found | WealthBeginners',
  description: 'The page you are looking for could not be found.',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <p className="font-display text-[8rem] leading-none font-bold text-gold/20 select-none">
          404
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-navy mt-2 mb-4">
          Page Not Found
        </h1>
        <p className="text-muted leading-relaxed mb-8">
          The article or page you were looking for has moved, been updated, or
          doesn&apos;t exist. Use the links below to get back on track.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-navy text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-navy/90 transition-colors"
          >
            ← Back to Home
          </Link>
          <Link
            href="/about"
            className="inline-flex items-center justify-center gap-2 border border-navy/20 text-navy px-6 py-3 rounded-full font-semibold text-sm hover:bg-navy/5 transition-colors"
          >
            About Us
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted mb-4 font-medium">Popular topics</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {['Investing', 'Budgeting', 'Debt', 'Side Income', 'Retirement'].map((t) => (
              <Link
                key={t}
                href={`/category/${t.toLowerCase().replaceAll(/\s+/g, '-')}`}
                className="text-xs bg-cream border border-border text-navy px-3 py-1.5 rounded-full hover:border-gold/50 transition-colors"
              >
                {t}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
