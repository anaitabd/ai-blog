'use client'

import { useEffect, Suspense } from 'react'

interface Props {
  slot: string
  format?: 'auto' | 'rectangle' | 'horizontal'
  className?: string
}

declare global {
  interface Window {
    adsbygoogle: unknown[]
  }
}

function AdUnitInner({ slot, format = 'auto', className = '' }: Props) {
  const isProduction = process.env.NODE_ENV === 'production'

  useEffect(() => {
    if (!isProduction) return
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {}
  }, [isProduction])

  if (!isProduction) {
    return (
      <div className={`my-6 flex items-center justify-center border-2 border-dashed border-border rounded-xl bg-cream-2 text-muted text-xs py-6 ${className}`}>
        Ad Unit · <span className="font-mono ml-1">{slot}</span>
      </div>
    )
  }

  if (!process.env.NEXT_PUBLIC_ADSENSE_ID) return null

  return (
    <div className={`my-6 overflow-hidden rounded-xl ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
        data-ad-lazy="true"
      />
    </div>
  )
}

export default function AdUnit(props: Props) {
  return (
    <Suspense fallback={<div className="my-6 h-14 rounded-xl bg-cream-2" />}>
      <AdUnitInner {...props} />
    </Suspense>
  )
}
