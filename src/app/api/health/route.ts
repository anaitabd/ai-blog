import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env_db_url: process.env.DATABASE_URL ? 'SET (length: ' + process.env.DATABASE_URL.length + ')' : 'MISSING',
  }

  try {
    const result = await prisma.$queryRaw`SELECT 1 as ok`
    checks.database = 'connected'
    checks.query = result
  } catch (err: unknown) {
    checks.database = 'FAILED'
    checks.error = err instanceof Error ? err.message : String(err)
    checks.stack = err instanceof Error ? err.stack?.split('\n').slice(0, 5) : undefined
  }

  const status = checks.database === 'connected' ? 200 : 500
  return NextResponse.json(checks, { status })
}

