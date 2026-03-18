import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About WealthBeginners — Our Mission',
  description:
    'WealthBeginners helps everyday people take control of their money through clear, honest, research-backed personal finance content.',
}

const PILLARS = [
  {
    icon: '📚',
    title: 'Research-Backed',
    body: 'Every article draws on data from the Federal Reserve, BLS, Bankrate, and peer-reviewed financial research — not opinion.',
  },
  {
    icon: '🎯',
    title: 'Beginner-Friendly',
    body: 'We write for people who never took a finance class, translating complex concepts into plain English with real-world examples.',
  },
  {
    icon: '🔍',
    title: 'Editorially Independent',
    body: 'Our content is written by our editorial team and reviewed before publishing. Advertiser relationships never influence what we write.',
  },
]

export default function AboutPage() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-navy text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-gold font-semibold tracking-widest uppercase text-xs mb-4">
            Our Mission
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight mb-6">
            Helping Beginners Build Real Wealth
          </h1>
          <p className="text-white/75 text-lg leading-relaxed">
            WealthBeginners was built on a simple belief: sound financial
            advice should be accessible to everyone — not just the wealthy.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-14 space-y-16">
        {/* Story */}
        <section>
          <h2 className="font-display text-2xl font-bold text-navy mb-4">
            Why We Exist
          </h2>
          <div className="space-y-4 text-muted leading-relaxed">
            <p>
              Most personal finance content is written by insiders for
              insiders. We founded WealthBeginners to flip that model — every
              article starts with one question: <em>"Would a complete beginner
              understand and act on this?"</em>
            </p>
            <p>
              We cover budgeting, investing, debt payoff, side income, and
              retirement — the topics that have the biggest impact on everyday
              financial lives. Our editorial process includes both AI-assisted
              drafting and a quality review to ensure accuracy and readability.
            </p>
          </div>
        </section>

        {/* Pillars */}
        <section>
          <h2 className="font-display text-2xl font-bold text-navy mb-8">
            What We Stand For
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="bg-cream border border-border rounded-2xl p-6"
              >
                <span className="text-3xl mb-4 block">{p.icon}</span>
                <h3 className="font-display font-bold text-navy mb-2">{p.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-amber-900 mb-2">
            ⚠️ Financial Disclaimer
          </h2>
          <p className="text-amber-800 text-sm leading-relaxed">
            Content on WealthBeginners is for educational purposes only and
            does not constitute professional financial, legal, or tax advice.
            Always consult a qualified advisor before making financial
            decisions. See our full{' '}
            <Link href="/disclaimer" className="underline underline-offset-2">
              disclaimer
            </Link>
            .
          </p>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="font-display text-2xl font-bold text-navy mb-4">
            Start Learning Today
          </h2>
          <p className="text-muted mb-6">
            Browse our latest articles or reach out if you have a topic
            you&apos;d like us to cover.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="bg-navy text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-navy/90 transition-colors"
            >
              Browse Articles
            </Link>
            <Link
              href="/contact"
              className="border border-navy/20 text-navy px-6 py-3 rounded-full font-semibold text-sm hover:bg-navy/5 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
