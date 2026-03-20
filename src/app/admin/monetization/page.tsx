'use client'

import { useState, useEffect } from 'react'

const TABS = [
  { id: 'overview',    label: '💰 Overview' },
  { id: 'affiliates',  label: '🔗 Affiliate Links' },
  { id: 'content',     label: '🏆 Top Content' },
  { id: 'calculator',  label: '🧮 Revenue Calculator' },
]

interface TopPost {
  id: string
  title: string
  slug: string
  viewCount: number
  category: { name: string }
}

function Spinner() {
  return <div className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
}

const CHECKLIST = [
  { id: 'adsense',    label: 'Google AdSense',        desc: 'Display ads on all pages',                    done: true  },
  { id: 'ads_txt',    label: 'ads.txt file',           desc: 'Uploaded to /public/ads.txt',                 done: true  },
  { id: 'affiliates', label: 'Affiliate links active', desc: 'Impact.com affiliates configured',            done: false },
  { id: 'impact',     label: 'Impact.com account',     desc: 'Register at impact.com for approval',         done: false },
  { id: 'amazon',     label: 'Amazon Associates',      desc: 'Apply at affiliate-program.amazon.com',       done: false },
  { id: 'newsletter', label: 'Newsletter monetization','desc': 'Sponsored newsletter slots',                done: false },
  { id: 'pinterest',  label: 'Pinterest Ads account',  desc: 'Business account for promoted pins',          done: false },
  { id: 'youtube',    label: 'YouTube Partner Program','desc': '1,000 subs + 4,000 watch hours required',   done: false },
]

const AFFILIATE_PRODUCTS = [
  { name: 'Chase Sapphire Preferred', category: 'credit cards', status: 'Pending Approval', commission: '$100/signup' },
  { name: 'Robinhood',                category: 'investing',    status: 'Pending Approval', commission: '$5/signup'   },
  { name: 'Acorns',                   category: 'investing',    status: 'Pending Approval', commission: '$10/signup'  },
  { name: 'YNAB',                     category: 'budgeting',    status: 'Pending Approval', commission: '$10/signup'  },
  { name: 'TurboTax',                 category: 'taxes',        status: 'Pending Approval', commission: '15% rev.'    },
  { name: 'SoFi',                     category: 'loans',        status: 'Pending Approval', commission: '$50/lead'    },
  { name: 'Coinbase',                 category: 'crypto',       status: 'Pending Approval', commission: '$10/signup'  },
  { name: 'LendingTree',              category: 'loans',        status: 'Pending Approval', commission: '$35/lead'    },
  { name: 'Personal Capital',         category: 'investing',    status: 'Pending Approval', commission: '$100/lead'   },
  { name: 'Credit Karma',             category: 'credit',       status: 'Pending Approval', commission: 'CPL'         },
]

function RevenueBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="bg-[#C9A84C] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium text-[#0B1628] w-16 text-right">${value.toLocaleString()}</span>
    </div>
  )
}

export default function MonetizationPage() {
  const [tab, setTab] = useState('overview')
  const [checkDone, setCheckDone] = useState(() =>
    Object.fromEntries(CHECKLIST.map(c => [c.id, c.done]))
  )

  // ── Top content ─────────────────────────────────────────────────────────────
  const [topPosts, setTopPosts] = useState<TopPost[]>([])
  const [topLoading, setTopLoading] = useState(false)

  useEffect(() => {
    if (tab !== 'content') return
    setTopLoading(true)
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => setTopPosts(d.topPosts ?? []))
      .finally(() => setTopLoading(false))
  }, [tab])

  // ── Calculator ───────────────────────────────────────────────────────────────
  const [calc, setCalc] = useState({
    monthlyPageviews: 10000,
    rpmUsd: 5,
    affiliateConvRate: 0.5,
    affiliateAvgCommission: 25,
    ctr: 1.0,
  })

  const adRevenue      = Math.round((calc.monthlyPageviews / 1000) * calc.rpmUsd)
  const affiliateClicks = Math.round(calc.monthlyPageviews * (calc.ctr / 100))
  const affiliateConv   = Math.round(affiliateClicks * (calc.affiliateConvRate / 100))
  const affiliateRev    = Math.round(affiliateConv * calc.affiliateAvgCommission)
  const totalRevenue    = adRevenue + affiliateRev

  const doneCount  = Object.values(checkDone).filter(Boolean).length
  const totalCount = CHECKLIST.length

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[#0B1628] mb-6">Monetization Tracker</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                tab === t.id
                  ? 'text-[#C9A84C] border-b-2 border-[#C9A84C] -mb-px'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── TAB: Overview ── */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-[#0B1628]">Monetization Checklist</h2>
                <span className="text-sm text-gray-500">{doneCount}/{totalCount} completed</span>
              </div>

              {/* Progress bar */}
              <div className="bg-gray-100 rounded-full h-2">
                <div
                  className="bg-[#C9A84C] h-2 rounded-full transition-all"
                  style={{ width: `${Math.round((doneCount / totalCount) * 100)}%` }}
                />
              </div>

              <div className="space-y-3">
                {CHECKLIST.map(item => (
                  <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!checkDone[item.id]}
                      onChange={e => setCheckDone(s => ({ ...s, [item.id]: e.target.checked }))}
                      className="mt-0.5 rounded accent-[#C9A84C]"
                    />
                    <div>
                      <p className={`text-sm font-medium ${checkDone[item.id] ? 'text-gray-400 line-through' : 'text-[#0B1628]'}`}>
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: Affiliate Links ── */}
          {tab === 'affiliates' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                These products are dynamically matched to articles based on content. 
                Replace placeholder URLs in <code className="bg-gray-100 px-1 rounded text-xs">src/lib/affiliates.ts</code> after getting approved.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Product', 'Category', 'Est. Commission', 'Status'].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {AFFILIATE_PRODUCTS.map(p => (
                      <tr key={p.name} className="hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium text-[#0B1628]">{p.name}</td>
                        <td className="py-3 px-3 text-gray-500 capitalize">{p.category}</td>
                        <td className="py-3 px-3 text-[#C9A84C] font-medium">{p.commission}</td>
                        <td className="py-3 px-3">
                          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: Top Content ── */}
          {tab === 'content' && (
            <div className="space-y-4">
              {topLoading && <div className="flex items-center gap-2 text-gray-500 py-4"><Spinner /> Loading…</div>}
              {!topLoading && topPosts.length === 0 && (
                <p className="text-gray-400 text-center py-8 text-sm">No published articles yet.</p>
              )}
              {topPosts.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Article', 'Category', 'Views', 'Affiliate Slots'].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {topPosts.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium text-[#0B1628] max-w-[250px]">
                            <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#C9A84C] hover:underline truncate block">
                              {p.title}
                            </a>
                          </td>
                          <td className="py-3 px-3 text-gray-500 capitalize">{p.category.name}</td>
                          <td className="py-3 px-3 text-[#0B1628] font-medium">{(p.viewCount ?? 0).toLocaleString()}</td>
                          <td className="py-3 px-3 text-gray-500">3 products</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Revenue Calculator ── */}
          {tab === 'calculator' && (
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Inputs */}
              <div className="space-y-4">
                <h2 className="font-semibold text-[#0B1628]">Monthly Projections</h2>
                {[
                  { key: 'monthlyPageviews',       label: 'Monthly Pageviews',             min: 0,    max: 1000000, step: 1000  },
                  { key: 'rpmUsd',                  label: 'Ad RPM (USD)',                  min: 0,    max: 50,      step: 0.5   },
                  { key: 'ctr',                     label: 'Affiliate CTR (%)',             min: 0,    max: 10,      step: 0.1   },
                  { key: 'affiliateConvRate',        label: 'Affiliate Conversion Rate (%)', min: 0,    max: 20,      step: 0.1   },
                  { key: 'affiliateAvgCommission',   label: 'Avg Commission ($)',            min: 0,    max: 500,     step: 1     },
                ].map(f => (
                  <div key={f.key}>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm text-gray-600">{f.label}</label>
                      <span className="text-sm font-medium text-[#0B1628]">
                        {f.key === 'monthlyPageviews'
                          ? Number(calc[f.key as keyof typeof calc]).toLocaleString()
                          : calc[f.key as keyof typeof calc]}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={f.min} max={f.max} step={f.step}
                      value={calc[f.key as keyof typeof calc]}
                      onChange={e => setCalc(s => ({ ...s, [f.key]: Number(e.target.value) }))}
                      className="w-full accent-[#C9A84C]"
                    />
                  </div>
                ))}
              </div>

              {/* Results */}
              <div className="space-y-5">
                <h2 className="font-semibold text-[#0B1628]">Estimated Monthly Revenue</h2>

                <div className="space-y-3">
                  <RevenueBar label="Ad Revenue"        value={adRevenue}     max={totalRevenue || 1} />
                  <RevenueBar label="Affiliate Revenue" value={affiliateRev}  max={totalRevenue || 1} />
                </div>

                <div className="bg-[#0B1628] rounded-xl p-5 text-center">
                  <p className="text-sm text-[#FAF8F3]/60 mb-1">Total Estimated Monthly Revenue</p>
                  <p className="text-4xl font-bold text-[#C9A84C]">${totalRevenue.toLocaleString()}</p>
                  <p className="text-sm text-[#FAF8F3]/40 mt-1">${Math.round(totalRevenue * 12).toLocaleString()} / year</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5 text-gray-600">
                  <div className="flex justify-between"><span>Affiliate clicks/mo</span><span className="font-medium">{affiliateClicks.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Conversions/mo</span><span className="font-medium">{affiliateConv.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Revenue per 1k views</span><span className="font-medium">${calc.monthlyPageviews > 0 ? ((totalRevenue / calc.monthlyPageviews) * 1000).toFixed(2) : '0'}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
