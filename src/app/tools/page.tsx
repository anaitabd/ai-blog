'use client'

import { useState } from 'react'
import AffiliateBox from '@/components/AffiliateBox'

// ── Shared styles ─────────────────────────────────────────────────────────────
const cardCls = 'bg-white rounded-2xl border border-[#E5E0D8] overflow-hidden shadow-sm'
const headerCls = 'bg-[#0B1628] px-6 py-4'
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
  const [income, setIncome] = useState('')
  const [result, setResult] = useState<null | { needs: number; wants: number; savings: number }>(null)

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
              type="number" min="0" step="100" value={income}
              onChange={(e) => setIncome(e.target.value)}
              placeholder="e.g. 4500" required className={inputCls}
            />
          </div>
          <button type="submit" className={btnCls}>Calculate My Budget →</button>
        </form>

        {result && (
          <div className={resultCls}>
            <h3 className="font-serif font-bold text-[#0B1628] mb-4">Your Monthly Budget</h3>
            {[
              { label: 'Needs (50%)',   amount: result.needs,   color: '#0B1628', pct: '50%', tip: 'Housing, food, transport, utilities' },
              { label: 'Wants (30%)',   amount: result.wants,   color: '#C9A84C', pct: '30%', tip: 'Entertainment, dining out, shopping' },
              { label: 'Savings (20%)', amount: result.savings, color: '#059669', pct: '20%', tip: 'Emergency fund, investments, debt payoff' },
            ].map((row) => (
              <div key={row.label} className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold" style={{ color: row.color }}>{row.label}</span>
                  <span className="text-sm font-bold text-[#0B1628]">{currency(row.amount)}/mo</span>
                </div>
                <div className="w-full h-2 bg-[#E5E0D8] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: row.pct, background: row.color }} />
                </div>
                <p className="text-xs text-[#6B7280] mt-1">{row.tip}</p>
              </div>
            ))}
          </div>
        )}
        {result && <div className="mt-6"><AffiliateBox category="budgeting" /></div>}
      </div>
    </div>
  )
}

// ── CALCULATOR 2: Debt Payoff ─────────────────────────────────────────────────
function DebtCalculator() {
  const [balance, setBalance] = useState('')
  const [apr, setApr]         = useState('')
  const [payment, setPayment] = useState('')
  const [error, setError]     = useState('')
  const [result, setResult]   = useState<null | {
    months: number; totalInterest: number; payoffDate: string
    minMonthly: number; minMonths: number; minInterest: number; saved: number
  }>(null)

  function calculate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const bal  = parseFloat(balance.replace(/,/g, ''))
    const rate = parseFloat(apr) / 100 / 12
    const pmt  = parseFloat(payment.replace(/,/g, ''))
    const minRequired = Math.ceil(bal * rate * 100) / 100 + 1

    if (!bal || !rate || !pmt) { setError('Please fill in all fields with valid numbers.'); return }
    if (pmt <= bal * rate) {
      setError(`Your payment must be greater than ${currency(bal * rate)} (the monthly interest). Try at least ${currency(minRequired)}.`)
      return
    }

    function calcPayoff(b: number, r: number, p: number) {
      const months   = Math.ceil(-Math.log(1 - (b * r) / p) / Math.log(1 + r))
      const interest = p * months - b
      return { months, interest }
    }

    const minPayment = Math.max(bal * 0.02, 25)
    const min   = calcPayoff(bal, rate, minPayment)
    const yours = calcPayoff(bal, rate, pmt)
    const payoffDate = new Date()
    payoffDate.setMonth(payoffDate.getMonth() + yours.months)

    setResult({
      months: yours.months, totalInterest: yours.interest,
      payoffDate: payoffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      minMonthly: minPayment, minMonths: min.months, minInterest: min.interest,
      saved: min.interest - yours.interest,
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
            { label: 'Total debt balance ($)',       val: balance, set: setBalance, ph: 'e.g. 8500' },
            { label: 'Annual interest rate (APR %)', val: apr,     set: setApr,     ph: 'e.g. 18.9' },
            { label: 'Monthly payment ($)',          val: payment, set: setPayment, ph: 'e.g. 300'  },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-sm font-medium text-[#0B1628] mb-1">{f.label}</label>
              <input type="number" min="0" step="any" value={f.val}
                onChange={(e) => { f.set(e.target.value); setError('') }}
                placeholder={f.ph} required className={inputCls} />
            </div>
          ))}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ⚠️ {error}
            </p>
          )}
          <button type="submit" className={btnCls}>Calculate Payoff →</button>
        </form>

        {result && (
          <div className={resultCls}>
            <h3 className="font-serif font-bold text-[#0B1628] mb-4">Your Payoff Plan</h3>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Payoff Date',            val: result.payoffDate,              color: '#059669' },
                { label: 'Months to Payoff',       val: `${result.months} months`,      color: '#0B1628' },
                { label: 'Total Interest',         val: currency(result.totalInterest), color: '#DC2626' },
                { label: 'vs. Minimum — You Save', val: currency(result.saved),         color: '#C9A84C' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl p-3 border border-[#E5E0D8]">
                  <p className="text-xs text-[#6B7280]">{s.label}</p>
                  <p className="font-bold text-base mt-0.5" style={{ color: s.color }}>{s.val}</p>
                </div>
              ))}
            </div>
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
        {result && <div className="mt-6"><AffiliateBox category="debt" /></div>}
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

  return (
    <div className={cardCls}>
      <div className={headerCls}>
        <h2 className="font-serif text-xl font-bold text-[#C9A84C]">Emergency Fund Calculator</h2>
        <p className="text-white/60 text-xs mt-1">How much should you save?</p>
      </div>
      <div className="p-6">
        <form onSubmit={calculate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0B1628] mb-1">Monthly expenses ($)</label>
            <input type="number" min="0" step="100" value={expenses}
              onChange={(e) => setExpenses(e.target.value)}
              placeholder="e.g. 2800" required className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0B1628] mb-1">Target coverage</label>
            <select value={months} onChange={(e) => setMonths(e.target.value)} className={inputCls}>
              {[3, 6, 9, 12].map((m) => (
                <option key={m} value={String(m)}>{m} months {m === 6 ? '(recommended)' : ''}</option>
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
          </div>
        )}
        {result && <div className="mt-6"><AffiliateBox category="saving" /></div>}
      </div>
    </div>
  )
}

// ── CALCULATOR 4: Compound Interest ──────────────────────────────────────────
function CompoundInterestCalculator() {
  const [principal, setPrincipal]   = useState('')
  const [monthly,   setMonthly]     = useState('')
  const [rate,      setRate]        = useState('')
  const [years,     setYears]       = useState('')
  const [result, setResult] = useState<null | {
    futureValue: number; totalContributed: number; totalInterest: number
    milestones: { year: number; balance: number; contributed: number; interest: number }[]
  }>(null)

  function calculate(e: React.FormEvent) {
    e.preventDefault()
    const p  = parseFloat(principal.replace(/,/g, '')) || 0
    const mc = parseFloat(monthly.replace(/,/g, ''))   || 0
    const r  = parseFloat(rate) / 100 / 12
    const n  = parseInt(years, 10) * 12

    if (!r || !n) return

    const milestones: typeof result extends null ? never : NonNullable<typeof result>['milestones'] = []
    let balance = p
    let contributed = p
    const checkYears = new Set([1, 5, 10, 15, 20, 25, 30].filter(y => y <= parseInt(years, 10)))
    checkYears.add(parseInt(years, 10))

    for (let month = 1; month <= n; month++) {
      balance = balance * (1 + r) + mc
      contributed += mc
      const yr = month / 12
      if (Number.isInteger(yr) && checkYears.has(yr)) {
        milestones.push({ year: yr, balance, contributed, interest: balance - contributed })
      }
    }

    setResult({
      futureValue: balance,
      totalContributed: contributed,
      totalInterest: balance - contributed,
      milestones,
    })
  }

  const multiplier = result ? (result.futureValue / Math.max(result.totalContributed, 1)).toFixed(1) : null

  return (
    <div className={cardCls}>
      <div className={headerCls}>
        <h2 className="font-serif text-xl font-bold text-[#C9A84C]">Compound Interest Calculator</h2>
        <p className="text-white/60 text-xs mt-1">Watch your money grow over time</p>
      </div>
      <div className="p-6">
        <form onSubmit={calculate} className="space-y-4">
          {[
            { label: 'Initial investment ($)',       val: principal, set: setPrincipal, ph: 'e.g. 5000',  required: false },
            { label: 'Monthly contribution ($)',     val: monthly,   set: setMonthly,   ph: 'e.g. 200',   required: false },
            { label: 'Expected annual return (%)',   val: rate,      set: setRate,      ph: 'e.g. 7',     required: true  },
            { label: 'Investment period (years)',    val: years,     set: setYears,     ph: 'e.g. 20',    required: true  },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-sm font-medium text-[#0B1628] mb-1">{f.label}</label>
              <input type="number" min="0" step="any" value={f.val}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.ph} required={f.required} className={inputCls} />
            </div>
          ))}
          <button type="submit" className={btnCls}>Calculate Growth →</button>
        </form>

        {result && (
          <div className={resultCls}>
            <h3 className="font-serif font-bold text-[#0B1628] mb-4">Your Investment Growth</h3>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-white rounded-xl p-3 border border-[#E5E0D8] col-span-3">
                <p className="text-xs text-[#6B7280]">Future Value · {multiplier}× your money</p>
                <p className="font-bold text-2xl text-[#C9A84C] mt-0.5">{currency(result.futureValue)}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-[#E5E0D8]">
                <p className="text-xs text-[#6B7280]">You Contributed</p>
                <p className="font-bold text-sm text-[#0B1628] mt-0.5">{currency(result.totalContributed)}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-[#E5E0D8] col-span-2">
                <p className="text-xs text-[#6B7280]">Interest Earned</p>
                <p className="font-bold text-sm text-[#059669] mt-0.5">{currency(result.totalInterest)}</p>
              </div>
            </div>

            {/* Growth milestones table */}
            {result.milestones.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#0B1628] text-white">
                      <th className="text-left px-3 py-2 rounded-tl-lg font-medium">Year</th>
                      <th className="text-right px-3 py-2 font-medium">Balance</th>
                      <th className="text-right px-3 py-2 rounded-tr-lg font-medium">Interest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.milestones.map((m, i) => (
                      <tr key={m.year} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAF8F3]'}>
                        <td className="px-3 py-2 text-[#6B7280]">Year {m.year}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[#0B1628]">{currency(m.balance)}</td>
                        <td className="px-3 py-2 text-right text-[#059669]">+{currency(m.interest)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {result && <div className="mt-6"><AffiliateBox category="investing" /></div>}
      </div>
    </div>
  )
}

// ── CALCULATOR 5: Net Worth ───────────────────────────────────────────────────
function NetWorthCalculator() {
  const [assets, setAssets] = useState([
    { label: 'Checking / Savings', value: '' },
    { label: 'Investments / Retirement', value: '' },
    { label: 'Home Value', value: '' },
    { label: 'Vehicle(s)', value: '' },
    { label: 'Other Assets', value: '' },
  ])
  const [debts, setDebts] = useState([
    { label: 'Mortgage', value: '' },
    { label: 'Car Loan(s)', value: '' },
    { label: 'Credit Cards', value: '' },
    { label: 'Student Loans', value: '' },
    { label: 'Other Debts', value: '' },
  ])
  const [calculated, setCalculated] = useState(false)

  const totalAssets = assets.reduce((s, a) => s + (parseFloat(a.value) || 0), 0)
  const totalDebts  = debts.reduce((s, d) => s + (parseFloat(d.value) || 0), 0)
  const netWorth    = totalAssets - totalDebts

  function updateRow<T extends { label: string; value: string }>(
    list: T[], setList: React.Dispatch<React.SetStateAction<T[]>>, index: number, val: string
  ) {
    const next = [...list]
    next[index] = { ...next[index], value: val }
    setList(next)
  }

  return (
    <div className={cardCls}>
      <div className={headerCls}>
        <h2 className="font-serif text-xl font-bold text-[#C9A84C]">Net Worth Calculator</h2>
        <p className="text-white/60 text-xs mt-1">Know exactly where you stand financially</p>
      </div>
      <div className="p-6">
        <div className="space-y-6">
          {/* Assets */}
          <div>
            <h3 className="text-sm font-bold text-[#059669] uppercase tracking-wide mb-3">Assets (What You Own)</h3>
            <div className="space-y-2">
              {assets.map((a, i) => (
                <div key={a.label} className="flex items-center gap-3">
                  <label className="w-44 text-xs text-[#6B7280] shrink-0">{a.label}</label>
                  <input type="number" min="0" step="100" value={a.value}
                    onChange={(e) => updateRow(assets, setAssets, i, e.target.value)}
                    placeholder="0" className="flex-1 border border-[#E5E0D8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A84C]" />
                </div>
              ))}
            </div>
          </div>

          {/* Debts */}
          <div>
            <h3 className="text-sm font-bold text-[#DC2626] uppercase tracking-wide mb-3">Liabilities (What You Owe)</h3>
            <div className="space-y-2">
              {debts.map((d, i) => (
                <div key={d.label} className="flex items-center gap-3">
                  <label className="w-44 text-xs text-[#6B7280] shrink-0">{d.label}</label>
                  <input type="number" min="0" step="100" value={d.value}
                    onChange={(e) => updateRow(debts, setDebts, i, e.target.value)}
                    placeholder="0" className="flex-1 border border-[#E5E0D8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C9A84C]" />
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => setCalculated(true)} className={btnCls}>Calculate Net Worth →</button>
        </div>

        {calculated && (
          <div className={resultCls}>
            <h3 className="font-serif font-bold text-[#0B1628] mb-4">Your Financial Snapshot</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-3 border border-[#E5E0D8]">
                <p className="text-xs text-[#6B7280]">Total Assets</p>
                <p className="font-bold text-sm text-[#059669] mt-0.5">{currency(totalAssets)}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-[#E5E0D8]">
                <p className="text-xs text-[#6B7280]">Total Debts</p>
                <p className="font-bold text-sm text-[#DC2626] mt-0.5">{currency(totalDebts)}</p>
              </div>
              <div className={`rounded-xl p-3 border ${netWorth >= 0 ? 'bg-[#f0fdf4] border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-xs text-[#6B7280]">Net Worth</p>
                <p className={`font-bold text-sm mt-0.5 ${netWorth >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                  {netWorth >= 0 ? '' : '−'}{currency(Math.abs(netWorth))}
                </p>
              </div>
            </div>
            {netWorth < 0 && (
              <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                💡 A negative net worth is common — especially with student loans or a new mortgage. The key is the trend: is it improving month over month?
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tools metadata ────────────────────────────────────────────────────────────
const TOOLS = [
  { id: 'budget',    label: 'Budget Planner',            icon: '📊', desc: '50/30/20 rule' },
  { id: 'debt',      label: 'Debt Payoff',               icon: '💳', desc: 'Payoff date & interest' },
  { id: 'emergency', label: 'Emergency Fund',            icon: '🛡️', desc: 'How much to save' },
  { id: 'compound',  label: 'Compound Interest',         icon: '📈', desc: 'Investment growth' },
  { id: 'networth',  label: 'Net Worth',                 icon: '💰', desc: 'Assets minus liabilities' },
]

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
          {/* Quick-jump pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {TOOLS.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              >
                <span>{t.icon}</span> {t.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Calculators */}
      <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-2 lg:grid-cols-2 gap-6 items-start">
        <div id="budget"><BudgetCalculator /></div>
        <div id="debt"><DebtCalculator /></div>
        <div id="emergency"><EmergencyFundCalculator /></div>
        <div id="compound"><CompoundInterestCalculator /></div>
        <div id="networth" className="md:col-span-2"><NetWorthCalculator /></div>
      </div>
    </main>
  )
}

