import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Us',
  description: `Learn about ${process.env.NEXT_PUBLIC_SITE_NAME} and our mission.`,
}

export default function AboutPage() {
  const site = process.env.NEXT_PUBLIC_SITE_NAME

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">About Us</h1>
      <p className="text-gray-600 leading-relaxed mb-4">
        Welcome to {site}. We publish practical, well-researched articles to
        help you make better decisions in everyday life.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        Our content covers technology, health, finance, and productivity —
        written to be clear, accurate, and actionable. Every article is
        carefully reviewed before publishing to ensure the highest quality.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        We are committed to providing honest, unbiased information. We may
        display advertisements to support our work, but this never influences
        our editorial content.
      </p>
      <p className="text-gray-600 leading-relaxed">
        Have a question or suggestion? Reach out via our{' '}
        <a href="/contact" className="text-blue-600 hover:underline">
          contact page
        </a>
        .
      </p>
    </main>
  )
}
