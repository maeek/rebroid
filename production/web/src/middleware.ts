// export { auth as middleware } from '@/lib/auth'

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set('x-current-path', request.nextUrl.pathname)

  const isProtectedPath =
    request.nextUrl.pathname.startsWith('/apps') ||
    request.nextUrl.pathname.startsWith('/app') ||
    request.nextUrl.pathname.startsWith('/settings') ||
    request.nextUrl.pathname.startsWith('/viewer')

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

    const isAdminPath =
      request.nextUrl.pathname.startsWith('/settings/general') ||
      request.nextUrl.pathname.startsWith('/settings/orchestrator') ||
      request.nextUrl.pathname.startsWith('/settings/system') ||
      request.nextUrl.pathname.startsWith('/settings/users')
    if (isAdminPath && token.role !== 'admin') {
      return NextResponse.redirect(new URL('/apps', request.url))
    }

    // Viewer shell pages are authenticated here. The display sidecar validates
    // its own short-lived display-session tokens on the separate viewer origin.
  }

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/apps/:path*', '/app/:path*', '/settings/:path*', '/viewer/:path*']
}
