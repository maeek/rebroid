// export { auth as middleware } from '@/lib/auth'

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { verifyScrcpyViewerToken, viewerTokenParamName } from '@/server/viewer/viewer-token'

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

    const isScrcpyProxyPath = request.nextUrl.pathname.startsWith('/viewer/ws-scrcpy')
    const scrcpyAction = request.nextUrl.searchParams.get('action')
    if (isScrcpyProxyPath && scrcpyAction && scrcpyAction !== 'proxy-adb') {
      return NextResponse.json({ message: 'Viewer action is not allowed.' }, { status: 403 })
    }

    if (isScrcpyProxyPath && scrcpyAction === 'proxy-adb') {
      const isViewerTokenValid = await verifyScrcpyViewerToken({
        token: request.nextUrl.searchParams.get(viewerTokenParamName),
        appId: request.nextUrl.searchParams.get('appId'),
        udid: request.nextUrl.searchParams.get('udid')
      })

      if (!isViewerTokenValid) {
        return NextResponse.json({ message: 'Viewer token is invalid or expired.' }, { status: 403 })
      }
    }
  }

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/apps/:path*', '/app/:path*', '/settings/:path*', '/viewer/:path*']
}
