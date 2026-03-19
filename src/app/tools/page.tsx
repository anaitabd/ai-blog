'use client'

import { useState } from 'react'
import AffiliateBox from '@/components/AffiliateBox'

// ── Shared styles ─────────────────────────────────────────────────────────────
const cardCls = 'bg-white rounded-2xl border border-[#E5E0D8] overflow-hidden shadow-sm'
const headerCls =
  'bg-[#0B1628] px-6 py-4'
const inputCls =
  'w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C] bg-white'
const btnCls =
  'w-full bg-[#C9A84C] hover:bg-[#E8C96A] text-[#0B1628] font-semibold py-3 rounded-xl transition-colors text-sm'
const resultCls =
  'mt-6 p-5 rounded-xl bg-[#FAF8F3] border border-[#E5E0D8] animate-fade-up'

function currency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// ── CALCULATOR 1: Budget Planner (50/30/20) ───────────────────────────────────
function BudgetCalculator() {
  const [income, setIncome]   = useState('')
  const [result, setResult]   = useState<null | { needs: number; wants: number; savings: number }>(null)

  function calculate(e: React.FormEvent) {
    e.preventDefault()
    const n = parseFloat(income.replace(/,/g, ''))
    if (!n || n <= 0) return
    setResult({ needs: n * 0.5, wants: n * 0.3, savings: n * 0.2 })
  }

  return (
    <div className={cardCls}>
      <div className={headerCls}>
        <h2 className="font-serif text-xl font-bold text-[#C9A84C]">Budget Planner</h2>
        <p className="text-white/60 text-xs mt-1">50/30/20 Rule Calculator</p>
      </div>
      <div className="p-6">
        <form onSubmit={calculate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0B1628] mb-1">
              Monthly take-home income ($)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              placeholder="e.g. 4500"
              required
              className={inputCls}
            />
          </div>
          <button type="submit" className={btnCls}>Calculate My Budget →</button>
        </form>

        {result && (
          <div className={resultCls}>
            <h3 className="font-serif font-bold text-[#0B1628] mb-4">Your Monthly Budget</h3>
            {[
              { label: 'Needs (50%)',   amount: result.needs,   color: '#0B1628', tip: 'Housing, food, transport, utilities' },
              { label: 'Wants (30%)',   amount: result.wants,   color: '#C9A84C', tip: 'Entertainment, dining out, shopping' },
              { label: 'Savings (20%)', amount: result.savings, color: '#059669', tip: 'Emergency fund, investments, debt payoff' },
            ].map((row) => (
              <div key={row.label} className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold" style={{ color: row.color }}>{row.label}</span>
                  <span className="text-sm font-bold text-[#0B1628]">{currency(row.amount)}/mo</span>
                </div>
                <div className="w-full h-2 bg-[#E5E0D8] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: row.label.includes('50')
                        ? '50%'
                        : row.label.includes('30')
                        ? '30%'
                        : '20%',
                      background: row.color,
                    }}
                  />
                </div>
                <p className="text-xs text-[#6B7280] mt-1">{row.tip}</p>
              </div>
            ))}

            {result.savings < parseFloat(income) * 0.2 - 1 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                💡 Financial experts recommend saving at least 20% of income. Consider adjusting your spending.
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="mt-6">
            <AffiliateBox category="budgeting" />
          </div>
        )}
      </div>
    </div>
  )
}

// ── CALCULATOR 2: Debt Payoff ─────────────────────────────────────────────────
function DebtCalculator() {
  const [balance, setBalance]   = useState('')
  const [apr, setApr]           = useState('')
  const [payment, setPayment]   = useState('')
  const [result, setResult]     = useState<null | {
    months: number
    totalInterest: number
    payoffDate: string
    minMonthly: number
    minMonths: number
    minInterest: number
    saved: number
  }>(null)

  function calculate(e: React.FormEvent) {
    e.preventDefault()
    const bal  = parseFloat(balance.replace(/,/g, ''))
    const rate = parseFloat(apr) / 100 / 12
    const pmt  = parseFloat(payment.replace(/,/g, ''))

    if (!bal || !rate || !pmt || pmt <= bal * rate) return

    function calcPayoff(b: number, r: number, p: number) {
      const months = Math.ceil(-Math.log(1 - (b * r) / p) / Math.log(1 + r))
      const total  = p * months
      const interest = total - b
      return { months, interest }
    }

    const minPayment = Math.max(bal * 0.02, 25)
    const min   = calcPayoff(bal, rate, minPayment)
    const yours = calcPayoff(bal, rate, pmt)

    const payoffDate = new Date()
    payoffDate.setMonth(payoffDate.getMonth() + yours.months)

    setResult({
      months:       yours.months,
      totalInterest: yours.interest,
      payoffDate:   payoffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      minMonthly:   minPayment,
      minMonths:    min.months,
      minInterest:  min.interest,
      saved:        min.interest - yours.interest,
    })
  }

  return (
    <div className={cardCls}>
      <div className={headerCls}>
        <h2 className="font-serif text-xl font-bold text-[#C9A84C]">Debt Payoff Calculator</h2>
        <p className="text-white/60 text-xs mt-1">See your payoff date and interest saved</p>
      </div>
      <div className="p-6">
        <form onSubmit={calculate} className="space-y-4">
          {[
            { label: 'Total debt balance ($)',    val: balance,  set: setBalance,  ph: 'e.g. 8500' },
            { label: 'Annual interest rate (APR %)', val: apr,   set: setApr,     ph: 'e.g. 18.9' },
            { label: 'Monthly payment ($)',       val: payment,  set: setPayment,  ph: 'e.g. 300' },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-sm font-medium text-[#0B1628] mb-1">{f.label}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={f.val}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.ph}
                required
                className={inputCls}
              />
            </div>
          ))}
          <button type="submit" className={btnCls}>Calculate Payoff →</button>
        </form>

        {result && (
          <div className={resultCls}>
            <h3 className="font-serif font-bold text-[#0B1628] mb-4">Your Payoff Plan</h3>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Payoff Date',       val: result.payoffDate,               color: '#059669' },
                { label: 'Months to Payoff',  val: `${result.months} months`,       color: '#0B1628' },
                { label: 'Total Interest',    val: currency(result.totalInterest),  color: '#DC2626' },
                { label: 'vs. Minimum — You Save', val: currency(result.saved),     color: '#C9A84C' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl p-3 border border-[#E5E0D8]">
                  <p className="text-xs text-[#6B7280]">{s.label}</p>
                  <p className="font-bold text-base mt-0.5" style={{ color: s.color }}>{s.val}</p>
                </div>
              ))}
            </div>

            {/* Comparison table */}
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#0B1628] text-white">
                  <th className="text-left px-3 py-2 rounded-tl-lg font-medium">Scenario</th>
                  <th className="text-right px-3 py-2 font-medium">Monthly</th>
                  <th className="text-right px-3 py-2 font-medium">Months</th>
                  <th className="text-right px-3 py-2 rounded-tr-lg font-medium">Interest</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#E5E0D8]">
                  <td className="px-3 py-2 text-[#6B7280]">Minimum Payment</td>
                  <td className="px-3 py-2 text-right">{currency(result.minMonthly)}</td>
                  <td className="px-3 py-2 text-right">{result.minMonths}</td>
                  <td className="px-3 py-2 text-right text-red-600">{currency(result.minInterest)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold text-[#059669]">Your Payment</td>
                  <td className="px-3 py-2 text-right font-semibold">{currency(parseFloat(payment))}</td>
                  <td className="px-3 py-2 text-right font-semibold">{result.months}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[#059669]">{currency(result.totalInterest)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {result && (
          <div className="mt-6">
            <AffiliateBox category="debt" />
          </div>
        )}
      </div>
    </div>
  )
}

// ── CALCULATOR 3: Emergency Fund ──────────────────────────────────────────────
function EmergencyFundCalculator() {
  const [expenses, setExpenses] = useState('')
  const [months, setMonths]     = useState('6')
  const [result, setResult]     = useState<null | { target: number; monthly: number }>(null)

  function calculate(e: React.FormEvent) {
    e.preventDefault()
    const exp = parseFloat(expenses.replace(/,/g, ''))
    const mo  = parseInt(months, 10)
    if (!exp || !mo) return
    setResult({ target: exp * mo, monthly: (exp * mo) / 6 })
  }

  const pct = result && expenses
    ? Math.min(100, Math.round((parseFloat(expenses) / result.target) * 100))
    : 0

  return (
    <div className={cardCls}>
      <div className={headerCls}>
        <h2 className="font-serif text-xl font-bold text-[#C9A84C]">Emergency Fund Calculator</h2>
        <p className="text-white/60 text-xs mt-1">How much should you save?</p>
      </div>
      <div className="p-6">
        <form onSubmit={calculate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0B1628] mb-1">
              Monthly expenses ($)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={expenses}
              onChange={(e) => setExpenses(e.target.value)}
              placeholder="e.g. 2800"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0B1628] mb-1">
              Target coverage
            </label>
            <select
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className={inputCls}
            >
              {[3, 6, 9, 12].map((m) => (
                <option key={m} value={String(m)}>
                  {m} months {m === 6 ? '(recommended)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={btnCls}>Calculate →</button>
        </form>

        {result && (
          <div className={resultCls}>
            <h3 className="font-serif font-bold text-[#0B1628] mb-4">Your Emergency Fund Goal</h3>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white rounded-xl p-4 border border-[#E5E0D8] col-span-2">
                <p className="text-xs text-[#6B7280]">Target Amount</p>
                <p className="font-bold text-2xl text-[#C9A84C] mt-0.5">{currency(result.target)}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-[#E5E0D8]">
                <p className="text-xs text-[#6B7280]">To reach in 6 months</p>
                <p className="font-bold text-base text-[#0B1628] mt-0.5">{currency(result.monthly)}/mo</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-[#E5E0D8]">
                <p className="text-xs text-[#6B7280]">Coverage period</p>
                <p className="font-bold text-base text-[#059669] mt-0.5">{months} months</p>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs text-[#6B7280] mb-1">
                <span>Progress</span>
                <span>{pct}%</span>
              </div>
              <div className="w-full h-3 bg-[#E5E0D8] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #C9A84C, #E8C96A)' }}
                />
              </div>
              <p className="text-xs text-[#6B7280] mt-1">Based on current monthly expenses as starting point</p>
            </div>
          </div>
        )}

        {result && (
          <div className="mt-6">
            <AffiliateBox category="saving" />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ToolsPage() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-[#0B1628] text-white py-14 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-widest mb-3">
            Free Tools
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-3">
            Financial Calculators
          </h1>
          <p className="text-white/60 text-base max-w-xl mx-auto">
            Plan your finances in minutes. All calculators are free and run entirely in your browser — no sign-up required.
          </p>
        </div>
      </section>

      {/* Calculators */}
      <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        <BudgetCalculator />
        <DebtCalculator />
        <EmergencyFundCalculator />
      </div>
    </main>
  )
}

