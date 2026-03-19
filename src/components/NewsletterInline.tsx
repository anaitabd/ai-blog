'use client'

import { useState } from 'react'

interface Props {
  subscriberCount?: string | null  // e.g. "2.4K+" or "127+" — null → hide count
}

export default function NewsletterInline({ subscriberCount }: Props) {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [status, setStatus]   = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
      if (!res.ok) throw new Error()
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  const subLine = subscriberCount
    ? `Join ${subscriberCount} readers getting practical, jargon-free money tips every Tuesday.`
    : 'Get practical, jargon-free money tips every Tuesday.'

  return (
    <section
      id="newsletter"
      className="relative bg-navy rounded-2xl overflow-hidden px-8 py-12 my-12"
      style={{
        background:
          'radial-gradient(ellipse 60% 60% at 80% 20%, rgba(201,168,76,0.18) 0%, transparent 70%), #0B1628',
      }}
    >
      <div className="relative z-10 max-w-xl mx-auto text-center">
        <p className="text-gold text-xs font-semibold uppercase tracking-[0.2em] mb-3">
          Free Weekly Newsletter
        </p>
        <h2 className="font-serif text-3xl font-bold italic text-white mb-3 leading-snug">
          Get smarter about money every week
        </h2>
        <p className="text-white/60 text-sm mb-6">{subLine}</p>

        {status === 'success' ? (
          <div className="bg-gold/20 border border-gold/40 rounded-xl px-6 py-5 text-gold font-semibold">
            ✓ You&apos;re in! Check your inbox for a welcome email.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your first name"
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-gold text-sm"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-gold text-sm"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="bg-gold hover:bg-gold-2 text-navy font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {status === 'loading' ? 'Subscribing...' : 'Get Free Money Tips →'}
            </button>
            {status === 'error' && (
              <p className="text-red-400 text-xs">Something went wrong — please try again.</p>
            )}
          </form>
        )}

        <ul className="mt-6 flex flex-col gap-1.5 text-sm text-white/60 text-left max-w-xs mx-auto">
          {['Weekly actionable tips', 'No fluff, no spam, unsubscribe anytime', 'Free tools & templates included'].map(b => (
            <li key={b} className="flex items-center gap-2">
              <span className="text-gold text-xs">✓</span> {b}
            </li>
          ))}
        </ul>

        {subscriberCount && (
          <p className="mt-5 text-xs text-white/30">{subscriberCount} subscribers · Sent every Tuesday</p>
        )}
      </div>
    </section>
  )
}
