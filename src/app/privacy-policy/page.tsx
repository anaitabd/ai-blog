import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | WealthBeginners',
  description: 'Our privacy policy and data practices for WealthBeginners.com.',
}

export default function PrivacyPage() {
  const site = process.env.NEXT_PUBLIC_SITE_NAME ?? 'WealthBeginners'
  const url  = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wealthbeginners.com'
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <main>
      <section className="bg-navy text-white py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-white/50 text-sm">Last updated: {date}</p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <section className="space-y-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-navy [&_h2]:mb-2 [&_p]:text-muted [&_p]:leading-relaxed">
          <div>
            <h2>Overview</h2>
            <p>
              {site} (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed
              to protecting your privacy. This policy explains how we handle
              information when you visit {url}.
            </p>
          </div>

          <div>
            <h2>Information we collect</h2>
            <p>
              We do not directly collect personal data. However, third-party
              services we use may collect anonymized usage data including:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-muted">
              <li>Pages visited and time spent on site</li>
              <li>Browser type and operating system</li>
              <li>Referring website</li>
              <li>General geographic location (country/city level)</li>
            </ul>
          </div>

          <div>
            <h2>Newsletter &amp; Contact Forms</h2>
            <p>
              If you subscribe to our newsletter or submit a contact form, we
              collect your name and email address solely to respond to your
              enquiry or send you the content you requested. We never sell
              your data to third parties.
            </p>
          </div>

          <div>
            <h2>Google AdSense &amp; Cookies</h2>
            <p>
              We use Google AdSense to display advertisements. Google may use
              cookies to serve ads based on your prior visits to our site or
              other sites. You can opt out of personalized advertising by
              visiting{' '}
              <a
                href="https://www.google.com/settings/ads"
                className="text-gold hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >Google Ad Settings</a>.
            </p>
          </div>

          <div>
            <h2>Google Analytics</h2>
            <p>
              We use Google Analytics to understand how visitors interact with
              our site. This data is anonymized and aggregated. You can opt out
              by installing the{' '}
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                className="text-gold hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >Google Analytics Opt-out Browser Add-on</a>.
            </p>
          </div>

          <div>
            <h2>Third-party links</h2>
            <p>
              Our articles may contain links to third-party websites. We are not
              responsible for the privacy practices of those sites and encourage
              you to review their policies.
            </p>
          </div>

          <div>
            <h2>Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Changes will be
              posted on this page with an updated date.
            </p>
          </div>

          <div>
            <h2>Contact</h2>
            <p>
              For privacy-related questions, please use our{' '}
              <a href="/contact" className="text-gold hover:underline">contact page</a>.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
