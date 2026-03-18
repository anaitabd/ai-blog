'use client'

import { useState } from 'react'

type Status = 'idle' | 'sending' | 'sent' | 'error'

const SUBJECTS = [
  'General Question',
  'Topic Suggestion',
  'Content Error',
  'Advertising Enquiry',
  'Other',
]

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')

    const form = e.currentTarget
    const data = {
      name:    (form.elements.namedItem('name')    as HTMLInputElement).value,
      email:   (form.elements.namedItem('email')   as HTMLInputElement).value,
      subject: (form.elements.namedItem('subject') as HTMLSelectElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setStatus(res.ok ? 'sent' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <span className="text-4xl mb-4">✅</span>
        <h3 className="font-display text-xl font-bold text-navy mb-2">Message Sent!</h3>
        <p className="text-muted text-sm">We&apos;ll get back to you within 2 business days.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-navy mb-1.5">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Your name"
          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold bg-white"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-navy mb-1.5">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold bg-white"
        />
      </div>

      <div>
        <label htmlFor="subject" className="block text-sm font-semibold text-navy mb-1.5">
          Subject
        </label>
        <select
          id="subject"
          name="subject"
          required
          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold bg-white"
        >
          <option value="">Select a subject…</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-semibold text-navy mb-1.5">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="How can we help?"
          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold bg-white resize-none"
        />
      </div>

      {status === 'error' && (
        <p className="text-red-600 text-sm">Something went wrong. Please email us directly.</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-gold text-navy font-bold py-3 rounded-full text-sm hover:bg-gold/90 transition-colors disabled:opacity-60"
      >
        {status === 'sending' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  )
}
