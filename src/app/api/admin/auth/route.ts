import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { key } = await req.json()
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 })
  }
  const res = NextResponse.json({ success: true })
  res.cookies.set('admin_key', key, {
    httpOnly: true,
    secure:   true,
    sameSite: 'strict',
    maxAge:   60 * 60 * 24 * 7,  // 7 days
    path:     '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set('admin_key', '', { maxAge: 0, path: '/' })
  return res
}

