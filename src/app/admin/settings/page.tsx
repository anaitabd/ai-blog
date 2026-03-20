'use client'

import { useState, useEffect, useCallback } from 'react'

const TABS = [
  { id: 'pipeline',  label: '⚙️ Pipeline Settings' },
  { id: 'ai',        label: '🤖 AI Models' },
  { id: 'social',    label: '🔗 Social Connections' },
  { id: 'security',  label: '🔒 Security' },
]

interface ModelStatus {
  id: string
  name: string
  available: boolean
  error?: string
}

function Spinner() {
  return <div className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
}

function StatusDot({ ok }: { ok: boolean | null }) {
  if (ok === null) return <div className="w-2.5 h-2.5 rounded-full bg-gray-300 animate-pulse" />
  return <div className={`w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`} />
}

export default function SettingsPage() {
  const [tab, setTab] = useState('pipeline')

  // ── Pipeline settings ────────────────────────────────────────────────────────
  const [pipeline, setPipeline] = useState({
    scheduleHours: '7,13,19',
    postsPerRun: '1',
    maxRetries: '3',
    enablePinterest: true,
    enableYouTube: true,
    enableEmail: true,
  })
  const [pipelineSaving, setPipelineSaving] = useState(false)
  const [pipelineMsg, setPipelineMsg] = useState('')

  useEffect(() => {
    if (tab !== 'pipeline') return
    fetch('/api/admin/settings?section=pipeline')
      .then(r => r.json())
      .then(d => { if (d.settings) setPipeline(s => ({ ...s, ...d.settings })) })
      .catch(() => {})
  }, [tab])

  async function savePipeline() {
    setPipelineSaving(true)
    setPipelineMsg('')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'pipeline', settings: pipeline }),
      })
      setPipelineMsg(res.ok ? '✅ Saved' : '❌ Failed to save')
    } finally {
      setPipelineSaving(false)
    }
  }

  // ── AI Models (Bedrock status) ───────────────────────────────────────────────
  const [models, setModels] = useState<ModelStatus[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)

  const fetchModels = useCallback(async () => {
    setModelsLoading(true)
    try {
      const res = await fetch('/api/admin/bedrock-models')
      const data = await res.json()
      setModels(data.models ?? [])
    } finally {
      setModelsLoading(false)
    }
  }, [])

  useEffect(() => { if (tab === 'ai') fetchModels() }, [tab, fetchModels])

  // ── Social connections ───────────────────────────────────────────────────────
  const SOCIALS = [
    { name: 'Google Search Console', desc: 'Sitemap pings on publish',       status: 'Active',          href: 'https://search.google.com/search-console' },
    { name: 'Bing Webmaster Tools',  desc: 'IndexNow pings on publish',      status: 'Active',          href: 'https://www.bing.com/webmasters' },
    { name: 'Pinterest',             desc: 'Auto-publish pins via OAuth2',   status: 'Needs SSM setup', href: '/admin/settings' },
    { name: 'YouTube',               desc: 'Shorts upload via OAuth2',       status: 'Needs SSM setup', href: '/admin/youtube' },
    { name: 'Amazon SES',            desc: 'Transactional + newsletter email', status: 'Active',        href: 'https://console.aws.amazon.com/ses' },
    { name: 'AWS Bedrock',           desc: 'Nova Canvas + Claude models',     status: 'Active',         href: 'https://console.aws.amazon.com/bedrock' },
  ]

  // ── Security ─────────────────────────────────────────────────────────────────
  const [changePwForm, setChangePwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

  async function changePassword() {
    if (changePwForm.next !== changePwForm.confirm) {
      setPwMsg('❌ Passwords do not match')
      return
    }
    if (changePwForm.next.length < 12) {
      setPwMsg('❌ Password must be at least 12 characters')
      return
    }
    setPwLoading(true)
    setPwMsg('')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'password', settings: changePwForm }),
      })
      const data = await res.json()
      setPwMsg(res.ok ? '✅ Password updated. Please log out and back in.' : `❌ ${data.error}`)
      if (res.ok) setChangePwForm({ current: '', next: '', confirm: '' })
    } finally {
      setPwLoading(false)
    }
  }

  const allModelsOk = models.length > 0 && models.every(m => m.available)

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[#0B1628] mb-6">Settings</h1>

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
          {/* ── TAB: Pipeline ── */}
          {tab === 'pipeline' && (
            <div className="max-w-lg space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (UTC hours)</label>
                  <input
                    type="text"
                    value={pipeline.scheduleHours}
                    onChange={e => setPipeline(s => ({ ...s, scheduleHours: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                  />
                  <p className="text-xs text-gray-400 mt-1">Comma-separated: 7,13,19</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Posts Per Run</label>
                  <input
                    type="number" min="1" max="10"
                    value={pipeline.postsPerRun}
                    onChange={e => setPipeline(s => ({ ...s, postsPerRun: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Retries</label>
                  <input
                    type="number" min="0" max="10"
                    value={pipeline.maxRetries}
                    onChange={e => setPipeline(s => ({ ...s, maxRetries: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700">Post-Publish Actions</p>
                {[
                  { key: 'enablePinterest', label: 'Generate + publish Pinterest pin' },
                  { key: 'enableYouTube',   label: 'Generate + publish YouTube Short' },
                  { key: 'enableEmail',     label: 'Send new post notification email' },
                ].map(f => (
                  <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!pipeline[f.key as keyof typeof pipeline]}
                      onChange={e => setPipeline(s => ({ ...s, [f.key]: e.target.checked }))}
                      className="rounded accent-[#C9A84C]"
                    />
                    <span className="text-sm text-gray-700">{f.label}</span>
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={savePipeline}
                  disabled={pipelineSaving}
                  className="bg-[#C9A84C] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#b8973d] disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {pipelineSaving && <Spinner />}
                  Save
                </button>
                {pipelineMsg && <span className="text-sm">{pipelineMsg}</span>}
              </div>
            </div>
          )}

          {/* ── TAB: AI Models ── */}
          {tab === 'ai' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-[#0B1628]">Bedrock Model Status</h2>
                <button
                  onClick={fetchModels}
                  disabled={modelsLoading}
                  className="text-sm text-[#C9A84C] hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  {modelsLoading && <Spinner />}
                  Refresh
                </button>
              </div>

              {modelsLoading && models.length === 0 && (
                <div className="flex items-center gap-2 text-gray-500 py-4"><Spinner /> Checking models…</div>
              )}

              {!allModelsOk && models.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                  One or more models are unavailable. Enable them in the AWS Bedrock console.
                </div>
              )}

              {allModelsOk && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                  ✅ All Bedrock models are available and ready.
                </div>
              )}

              <div className="space-y-3">
                {models.map(m => (
                  <div key={m.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <StatusDot ok={m.available} />
                      <div>
                        <p className="text-sm font-medium text-[#0B1628]">{m.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{m.id}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      m.available ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                    }`}>
                      {m.available ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                ))}
              </div>

              <a
                href="https://console.aws.amazon.com/bedrock/home#/modelaccess"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[#C9A84C] hover:underline"
              >
                Manage model access in AWS Console →
              </a>
            </div>
          )}

          {/* ── TAB: Social Connections ── */}
          {tab === 'social' && (
            <div className="space-y-4">
              {SOCIALS.map(s => (
                <div key={s.name} className="flex items-center justify-between border border-gray-100 rounded-xl p-4">
                  <div>
                    <p className="text-sm font-semibold text-[#0B1628]">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      s.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {s.status}
                    </span>
                    <a
                      href={s.href}
                      target={s.href.startsWith('http') ? '_blank' : undefined}
                      rel={s.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="text-xs text-[#C9A84C] hover:underline whitespace-nowrap"
                    >
                      Configure →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── TAB: Security ── */}
          {tab === 'security' && (
            <div className="max-w-sm space-y-5">
              <div>
                <h2 className="font-semibold text-[#0B1628] mb-4">Change Admin Password</h2>
                <div className="space-y-3">
                  {[
                    { key: 'current', label: 'Current Password',  placeholder: '••••••••••••' },
                    { key: 'next',    label: 'New Password',       placeholder: 'Min. 12 characters' },
                    { key: 'confirm', label: 'Confirm Password',   placeholder: '••••••••••••' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                      <input
                        type="password"
                        value={changePwForm[f.key as keyof typeof changePwForm]}
                        onChange={e => setChangePwForm(s => ({ ...s, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                        autoComplete="new-password"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {pwMsg && (
                <div className={`text-sm px-4 py-3 rounded-lg ${pwMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {pwMsg}
                </div>
              )}

              <button
                onClick={changePassword}
                disabled={pwLoading || !changePwForm.current || !changePwForm.next}
                className="bg-[#0B1628] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1a2d4a] disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {pwLoading && <Spinner />}
                Update Password
              </button>

              <div className="border-t border-gray-100 pt-5 space-y-3">
                <h3 className="font-medium text-sm text-gray-700">Environment Variables</h3>
                <p className="text-xs text-gray-400">
                  API keys and secrets are managed via AWS Amplify environment variables and SSM Parameter Store. 
                  Never commit secrets to source control.
                </p>
                <a
                  href="https://console.aws.amazon.com/amplify"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#C9A84C] hover:underline"
                >
                  Manage in AWS Amplify Console →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
