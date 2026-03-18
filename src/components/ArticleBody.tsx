'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import Link from 'next/link'
import { slugifyHeading } from '@/lib/headings'

interface Props { content: string }

/* ---------- Callout detection ---------- */
const CALLOUTS: Record<string, { bg: string; border: string; label: string }> = {
  '💡': { bg: 'bg-blue-50',   border: 'border-blue-400',  label: 'text-blue-700'  },
  '📊': { bg: 'bg-teal-50',   border: 'border-teal-400',  label: 'text-teal-700'  },
  '⚠️': { bg: 'bg-amber-50',  border: 'border-amber-400', label: 'text-amber-700' },
  '✅': { bg: 'bg-green-50',  border: 'border-green-400', label: 'text-green-700' },
}

function parseCallout(text: string) {
  for (const [icon, styles] of Object.entries(CALLOUTS)) {
    if (text.startsWith(icon)) {
      return { icon, styles, body: text.slice(icon.length).trim() }
    }
  }
  return null
}

/* ---------- Internal link resolver ---------- */
function resolveInternalLink(text: string) {
  const m = /\[INTERNAL_LINK:\s*([^\]]+)\]/.exec(text)
  return m ? m[1] : null
}

/* ---------- Custom renderers ---------- */
const components: Components = {
  h1: ({ children }) => (
    <h1 className="font-serif text-3xl font-bold text-[#1A1A2E] mt-8 mb-4 leading-tight tracking-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => {
    const id = slugifyHeading(extractText(children))
    return (
      <h2 id={id} className="font-serif text-2xl font-semibold text-[#1A1A2E] mt-10 mb-4 pb-2 border-b border-border">
        {children}
      </h2>
    )
  },
  h3: ({ children }) => {
    const id = slugifyHeading(extractText(children))
    return (
      <h3 id={id} className="font-serif text-xl font-semibold text-[#1A1A2E] mt-6 mb-3">
        {children}
      </h3>
    )
  },

  blockquote: ({ children }) => {
    const rawText = extractText(children)
    const callout = parseCallout(rawText.trim())
    if (callout) {
      return (
        <div className={`${callout.styles.bg} border-l-4 ${callout.styles.border} rounded-r-xl px-5 py-4 my-6`}>
          <p className={`${callout.styles.label} font-semibold text-sm leading-relaxed m-0`}>
            {callout.icon} {callout.body}
          </p>
        </div>
      )
    }
    return (
      <blockquote className="border-l-4 border-gold bg-cream p-4 rounded-r-xl my-6 italic text-gray-600">
        {children}
      </blockquote>
    )
  },

  table: ({ children }) => (
    <div className="overflow-x-auto my-6 rounded-xl border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-navy text-white">{children}</thead>,
  th: ({ children }) => (
    <th className="px-4 py-3 text-left font-semibold font-sans text-sm">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 border-b border-border align-top">{children}</td>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-cream-2 transition-colors">{children}</tr>
  ),

  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ''}
      className="rounded-xl w-full object-cover my-6 max-h-[480px]"
    />
  ),

  p: ({ children }) => {
    const text = extractText(children)
    const internal = resolveInternalLink(text)
    if (internal) {
      return (
        <p className="leading-relaxed mb-4 text-[#374151]">
          <Link href={`/search?q=${encodeURIComponent(internal)}`} className="text-gold underline">
            {internal}
          </Link>
        </p>
      )
    }
    return <p className="leading-relaxed mb-4 text-[#374151]">{children}</p>
  },

  a: ({ href, children }) => (
    <a
      href={href}
      className="text-gold hover:underline"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),

  ul: ({ children }) => (
    <ul className="list-disc pl-6 mb-4 space-y-1 text-[#374151]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 mb-4 space-y-1 text-[#374151]">{children}</ol>
  ),
  li: ({ children }) => <li className="mb-1">{children}</li>,

  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? '')
    if (isBlock) {
      return (
        <pre className="bg-navy text-[#9FE1CB] rounded-xl p-5 overflow-x-auto my-4 text-sm">
          <code>{children}</code>
        </pre>
      )
    }
    return (
      <code className="bg-cream-2 rounded px-1.5 py-0.5 text-sm font-mono text-[#1A1A2E]" {...props}>
        {children}
      </code>
    )
  },
  pre: ({ children }) => <>{children}</>,
}

function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(extractText).join('')
  if (children && typeof children === 'object' && 'props' in (children as object)) {
    return extractText((children as React.ReactElement).props.children)
  }
  return ''
}

export default function ArticleBody({ content }: Readonly<Props>) {
  return (
    <div className="article-body max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
