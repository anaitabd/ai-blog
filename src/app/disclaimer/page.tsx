import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Disclaimer',
  description: 'Important disclaimers about our content.',
}

export default function DisclaimerPage() {
  const site = process.env.NEXT_PUBLIC_SITE_NAME

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Disclaimer</h1>
      <section className="space-y-6 text-gray-700 leading-relaxed">
        <div>
          <h2 className="text-xl font-semibold mb-2">General information</h2>
          <p>
            All content published on {site} is for general informational and
            educational purposes only. It is not intended as professional
            advice of any kind.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">No professional advice</h2>
          <p>
            Nothing on this website should be construed as medical, legal,
            financial, or professional advice. Always consult a qualified
            professional before making decisions based on information you read
            here.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Accuracy of information</h2>
          <p>
            While we strive to keep all information accurate and up to date,
            we make no representations or warranties about the completeness,
            accuracy, or reliability of any content.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Affiliate &amp; advertising disclosure</h2>
          <p>
            This site may display advertisements via Google AdSense and may
            contain affiliate links. We may earn a commission if you make a
            purchase through these links, at no extra cost to you. This does
            not influence our editorial content.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">External links</h2>
          <p>
            We are not responsible for the content of external websites linked
            from our articles. Links are provided for reference only.
          </p>
        </div>
      </section>
    </main>
  )
}
