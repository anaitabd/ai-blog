import { NextRequest, NextResponse } from 'next/server'

const ADMIN_KEY = process.env.ADMIN_API_KEY ?? ''

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const cookie = req.cookies.get('admin_key')?.value

  // ── Protect /admin/* pages (except login) ──────────────────────────────────
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!cookie || cookie !== ADMIN_KEY) {
      const login = new URL('/admin/login', req.url)
      login.searchParams.set('from', pathname)
      return NextResponse.redirect(login)
    }
  }

  // ── Inject admin key from cookie into all /api/admin/* calls ──────────────
  // This lets client components call API routes without sending the key in JS.
  if (pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/auth')) {
    if (cookie) {
      const headers = new Headers(req.headers)
      headers.set('x-admin-key', cookie)
      return NextResponse.next({ request: { headers } })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}

