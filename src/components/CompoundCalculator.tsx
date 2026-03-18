'use client'

import { useState } from 'react'

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

export default function CompoundCalculator() {
  const [amount, setAmount] = useState(5000)
  const [rate,   setRate]   = useState(7)
  const [years,  setYears]  = useState(20)

  const result = amount * Math.pow(1 + rate / 100, years)
  const gain   = result - amount

  return (
    <aside className="bg-navy rounded-2xl p-6 text-white">
      <h3 className="font-serif text-lg font-bold mb-1">Compound Calculator</h3>
      <p className="text-white/50 text-xs mb-5">See your money grow over time</p>

      <div className="space-y-5">
        {/* Initial amount */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-white/60">Initial Amount</span>
            <span className="text-gold font-semibold">{formatCurrency(amount)}</span>
          </div>
          <input
            type="range" min={100} max={50000} step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-[#C9A84C]"
          />
        </div>

        {/* Annual return */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-white/60">Annual Return</span>
            <span className="text-gold font-semibold">{rate}%</span>
          </div>
          <input
            type="range" min={1} max={15} step={0.5}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-full accent-[#C9A84C]"
          />
        </div>

        {/* Years */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-white/60">Years Invested</span>
            <span className="text-gold font-semibold">{years} yrs</span>
          </div>
          <input
            type="range" min={1} max={40} step={1}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="w-full accent-[#C9A84C]"
          />
        </div>
      </div>

      {/* Result */}
      <div className="mt-6 bg-white/5 rounded-xl p-4 text-center">
        <p className="text-white/50 text-xs mb-1">Future Value</p>
        <p className="font-serif text-3xl font-bold text-gold">{formatCurrency(result)}</p>
        <p className="text-white/40 text-xs mt-1">
          +{formatCurrency(gain)} gain · {rate}% for {years} years
        </p>
      </div>
    </aside>
  )
}
