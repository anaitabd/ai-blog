export default function AuthorBio() {
  return (
    <div
      className="flex items-start gap-4 my-10 rounded-lg p-5"
      style={{
        background: '#FAF8F3',
        borderLeft: '4px solid #C9A84C',
        boxShadow: '0 2px 8px rgba(11,22,40,0.06)',
      }}
    >
      {/* Avatar */}
      <div
        className="shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-serif font-bold text-xl"
        style={{
          background: '#0B1628',
          border: '2px solid #C9A84C',
          color: '#C9A84C',
        }}
      >
        WB
      </div>

      {/* Content */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-bold text-base" style={{ color: '#0B1628' }}>
            WealthBeginners Editorial Team
          </span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: '#C9A84C20', color: '#C9A84C', border: '1px solid #C9A84C50' }}
          >
            Expert Reviewed ✓
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
          Our writers break down complex money topics into simple, actionable guides —
          written for beginners, reviewed for accuracy. Every article is fact-checked
          against trusted financial sources before publishing.
        </p>
      </div>
    </div>
  )
}

