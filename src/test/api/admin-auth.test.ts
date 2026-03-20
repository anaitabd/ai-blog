/**
 * Admin API auth tests
 * Verifies that all admin routes reject requests without a valid x-admin-key header.
 * Uses real route handlers with mocked Prisma + process.env.ADMIN_API_KEY.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import '../mocks/prisma'

// Set the admin key env var before importing routes
const TEST_ADMIN_KEY = 'test-admin-key-abc123'
beforeAll(() => {
  process.env.ADMIN_API_KEY = TEST_ADMIN_KEY
})

// Helper to create a minimal NextRequest-like object
function makeRequest(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers })
}

// ── /api/admin/quality ────────────────────────────────────────────────────
describe('GET /api/admin/quality — auth guard', async () => {
  const { GET } = await import('@/app/api/admin/quality/route')

  it('returns 401 when x-admin-key header is missing', async () => {
    const req = makeRequest('http://localhost/api/admin/quality')
    const res = await GET(req as any)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when x-admin-key is wrong', async () => {
    const req = makeRequest('http://localhost/api/admin/quality', {
      'x-admin-key': 'wrong-key',
    })
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })

  it('does not return 401 when correct x-admin-key is provided', async () => {
    const req = makeRequest('http://localhost/api/admin/quality', {
      'x-admin-key': TEST_ADMIN_KEY,
    })
    const res = await GET(req as any)
    expect(res.status).not.toBe(401)
  })
})

// ── /api/admin/youtube/shorts ─────────────────────────────────────────────
describe('GET /api/admin/youtube/shorts — auth guard', async () => {
  const { GET } = await import('@/app/api/admin/youtube/shorts/route')

  it('returns 401 when x-admin-key header is missing', async () => {
    const req = makeRequest('http://localhost/api/admin/youtube/shorts')
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })

  it('returns 401 for wrong key', async () => {
    const req = makeRequest('http://localhost/api/admin/youtube/shorts', {
      'x-admin-key': 'bad',
    })
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })

  it('responds (not 401) for correct key', async () => {
    const req = makeRequest('http://localhost/api/admin/youtube/shorts', {
      'x-admin-key': TEST_ADMIN_KEY,
    })
    const res = await GET(req as any)
    expect(res.status).not.toBe(401)
  })
})

// ── /api/admin/email/stats ────────────────────────────────────────────────
describe('GET /api/admin/email/stats — auth guard', async () => {
  const { GET } = await import('@/app/api/admin/email/stats/route')

  it('returns 401 with no key', async () => {
    const req = makeRequest('http://localhost/api/admin/email/stats')
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong key', async () => {
    const req = makeRequest('http://localhost/api/admin/email/stats', {
      'x-admin-key': 'xxxxxx',
    })
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })
})

// ── /api/admin/email/export ───────────────────────────────────────────────
describe('GET /api/admin/email/export — auth guard', async () => {
  const { GET } = await import('@/app/api/admin/email/export/route')

  it('returns 401 with no key', async () => {
    const req = makeRequest('http://localhost/api/admin/email/export')
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })
})

// ── /api/admin/bedrock-models ─────────────────────────────────────────────
describe('GET /api/admin/bedrock-models — auth guard', async () => {
  const { GET } = await import('@/app/api/admin/bedrock-models/route')

  it('returns 401 with no key', async () => {
    const req = makeRequest('http://localhost/api/admin/bedrock-models')
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })
})
