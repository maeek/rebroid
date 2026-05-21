// export { auth as middleware } from '@/lib/auth'

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { verifyAnyScrcpyViewerToken, verifyScrcpyViewerToken, viewerTokenParamName } from '@/server/viewer/viewer-token'

export async function middleware(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set('x-current-path', request.nextUrl.pathname)
  const isScrcpyProxyPath = request.nextUrl.pathname.startsWith('/viewer/ws-scrcpy')
  const scrcpyAction = request.nextUrl.searchParams.get('action')
  if (isScrcpyProxyPath) {
    if (scrcpyAction && scrcpyAction !== 'proxy-adb') {
      return NextResponse.json({ message: 'Viewer action is not allowed.' }, { status: 403 })
    }

    const viewerToken = request.nextUrl.searchParams.get(viewerTokenParamName)
    if (viewerToken) {
      const isViewerTokenValid = await verifyScrcpyViewerToken({
        token: viewerToken,
        appId: request.nextUrl.searchParams.get('appId'),
        udid: request.nextUrl.searchParams.get('udid')
      })

      if (!isViewerTokenValid) {
        return NextResponse.json({ message: 'Viewer token is invalid or expired.' }, { status: 403 })
      }

      const response = NextResponse.next({ request: { headers } })
      response.cookies.set({
        name: viewerTokenParamName,
        value: viewerToken,
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        path: '/viewer/ws-scrcpy',
        maxAge: 30 * 60
      })
      return response
    }

    const viewerCookie = request.cookies.get(viewerTokenParamName)?.value ?? null
    if (!scrcpyAction && (await verifyAnyScrcpyViewerToken(viewerCookie))) {
      return NextResponse.next({ request: { headers } })
    }
  }

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

    // /viewer/ws-scrcpy is normally authorized by short-lived viewer tokens above.
    // If a token is absent, it falls back to the regular app session check.
  }

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/apps/:path*', '/app/:path*', '/settings/:path*', '/viewer/:path*']
}
