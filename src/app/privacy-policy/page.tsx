import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Our privacy policy and data practices.',
}

export default function PrivacyPage() {
  const site = process.env.NEXT_PUBLIC_SITE_NAME
  const url = process.env.NEXT_PUBLIC_SITE_URL
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-gray-400 text-sm mb-8">Last updated: {date}</p>

      <section className="space-y-6 text-gray-700 leading-relaxed">
        <div>
          <h2 className="text-xl font-semibold mb-2">Overview</h2>
          <p>
            {site} (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed
            to protecting your privacy. This policy explains how we handle
            information when you visit {url}.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Information we collect</h2>
          <p>
            We do not directly collect personal data. However, third-party
            services we use may collect anonymized usage data including:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Pages visited and time spent on site</li>
            <li>Browser type and operating system</li>
            <li>Referring website</li>
            <li>General geographic location (country/city level)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Google AdSense &amp; Cookies</h2>
          <p>
            We use Google AdSense to display advertisements. Google may use
            cookies to serve ads based on your prior visits to our site or
            other sites. You can opt out of personalized advertising by
            visiting{' '}
            <a
              href="https://www.google.com/settings/ads"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Ad Settings
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Google Analytics</h2>
          <p>
            We use Google Analytics to understand how visitors interact with
            our site. This data is anonymized and aggregated. You can opt out
            by installing the{' '}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Analytics Opt-out Browser Add-on
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Third-party links</h2>
          <p>
            Our articles may contain links to third-party websites. We are not
            responsible for the privacy practices of those sites and encourage
            you to review their policies.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Changes will be
            posted on this page with an updated date.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Contact</h2>
          <p>
            For privacy-related questions, please use our{' '}
            <a href="/contact" className="text-blue-600 hover:underline">
              contact page
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
