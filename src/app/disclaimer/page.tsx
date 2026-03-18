import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Disclaimer | WealthBeginners',
  description: 'Important financial and content disclaimers for WealthBeginners.com.',
}

export default function DisclaimerPage() {
  const site = process.env.NEXT_PUBLIC_SITE_NAME ?? 'WealthBeginners'

  return (
    <main>
      <section className="bg-navy text-white py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-4xl font-bold mb-2">Disclaimer</h1>
          <p className="text-white/50 text-sm">Please read carefully before using this site.</p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <section className="space-y-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-navy [&_h2]:mb-2 [&_p]:text-muted [&_p]:leading-relaxed">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
            <p className="text-amber-900 font-semibold text-sm">
              ⚠️ The content on {site} is for educational purposes only and does
              not constitute professional financial, legal, tax, or investment
              advice.
            </p>
          </div>

          <div>
            <h2>General information</h2>
            <p>
              All content published on {site} is for general informational and
              educational purposes only. It is not intended as professional
              advice of any kind.
            </p>
          </div>
          <div>
            <h2>No professional advice</h2>
            <p>
              Nothing on this website should be construed as medical, legal,
              financial, or professional advice. Always consult a qualified
              professional before making decisions based on information you read
              here.
            </p>
          </div>
          <div>
            <h2>Accuracy of information</h2>
            <p>
              While we strive to keep all information accurate and up to date,
              we make no representations or warranties about the completeness,
              accuracy, or reliability of any content.
            </p>
          </div>
          <div>
            <h2>Affiliate &amp; advertising disclosure</h2>
            <p>
              This site may display advertisements via Google AdSense and may
              contain affiliate links. We may earn a commission if you make a
              purchase through these links, at no extra cost to you. This does
              not influence our editorial content.
            </p>
          </div>
          <div>
            <h2>External links</h2>
            <p>
              We are not responsible for the content of external websites linked
              from our articles. Links are provided for reference only.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
