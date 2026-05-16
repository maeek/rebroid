// export { auth as middleware } from '@/lib/auth'

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set('x-current-path', request.nextUrl.pathname)
  const isProtectedPath =
    request.nextUrl.pathname.startsWith('/apps') ||
    request.nextUrl.pathname.startsWith('/app') ||
    request.nextUrl.pathname.startsWith('/settings')

  if (isProtectedPath) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      if (request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
      }

      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/apps/:path*', '/app/:path*', '/settings/:path*']
}
