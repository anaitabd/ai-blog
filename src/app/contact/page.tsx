import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with us.',
}

export default function ContactPage() {
  const site = process.env.NEXT_PUBLIC_SITE_NAME

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Contact Us</h1>
      <p className="text-gray-600 leading-relaxed mb-6">
        We would love to hear from you. Whether you have a question about our
        content, want to suggest a topic, or have found an error — please reach
        out.
      </p>
      <div className="bg-gray-50 border rounded-xl p-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Email</p>
          <p className="text-gray-600">contact@yourdomain.com</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Response time</p>
          <p className="text-gray-600">We aim to respond within 2 business days.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Site</p>
          <p className="text-gray-600">{site}</p>
        </div>
      </div>
      <p className="text-gray-500 text-sm mt-6">
        For advertising enquiries, please include &quot;Advertising&quot; in
        your subject line.
      </p>
    </main>
  )
}
