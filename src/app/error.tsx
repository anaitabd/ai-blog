'use client'

import Link from 'next/link'
import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Readonly<Props>) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <p className="font-display text-[8rem] leading-none font-bold text-gold/20 select-none">
          500
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-navy mt-2 mb-4">
          Something Went Wrong
        </h1>
        <p className="text-muted leading-relaxed mb-8">
          We hit an unexpected error. Our team has been notified. Try refreshing
          the page or come back shortly.
        </p>

        {error.digest && (
          <p className="text-xs text-muted/60 mb-6 font-mono bg-cream border border-border rounded px-3 py-2 inline-block">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 bg-gold text-navy px-6 py-3 rounded-full font-semibold text-sm hover:bg-gold/90 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 border border-navy/20 text-navy px-6 py-3 rounded-full font-semibold text-sm hover:bg-navy/5 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}
