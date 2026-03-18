import type { Metadata } from 'next'
import ContactForm from './ContactForm'

export const metadata: Metadata = {
  title: 'Contact WealthBeginners',
  description:
    'Have a question, topic suggestion, or spotted an error? Get in touch with the WealthBeginners team.',
}

export default function ContactPage() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-navy text-white py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-gold font-semibold tracking-widest uppercase text-xs mb-4">
            Get in Touch
          </p>
          <h1 className="font-display text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-white/70">
            We read every message and aim to reply within 2 business days.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Info */}
          <div className="space-y-6">
            <div className="bg-cream border border-border rounded-2xl p-6">
              <h2 className="font-display font-bold text-navy mb-4">Reach Us</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-navy mb-1">Email</p>
                  <a
                    href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@wealthbeginners.com'}`}
                    className="text-gold hover:underline"
                  >{process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@wealthbeginners.com'}</a>
                </div>
                <div>
                  <p className="font-semibold text-navy mb-1">Advertising</p>
                  <p className="text-muted">
                    Include &quot;Advertising&quot; in your subject line.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-navy mb-1">Response Time</p>
                  <p className="text-muted">Within 2 business days.</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <p className="text-amber-900 text-sm leading-relaxed">
                <strong>Editorial note:</strong> We do not accept paid guest
                posts. All published content follows our{' '}
                <a href="/disclaimer" className="underline">editorial guidelines</a>.
              </p>
            </div>
          </div>

          {/* Form */}
          <ContactForm />
        </div>
      </div>
    </main>
  )
}
