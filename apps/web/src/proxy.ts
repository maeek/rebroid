import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

const contentSecurityPolicy = (nonce: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ')

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const csrfRequestIsAllowed = (request: NextRequest) => {
  if (!unsafeMethods.has(request.method) || !request.nextUrl.pathname.startsWith('/api/')) return true
  if (request.nextUrl.pathname.startsWith('/api/auth/')) return true

  const origin = request.headers.get('origin')
  if (!origin) return !request.headers.has('cookie')
  try {
    return new URL(origin).origin === request.nextUrl.origin
  } catch {
    return false
  }
}

export const proxy = (request: NextRequest) => {
  if (!csrfRequestIsAllowed(request)) {
    return Response.json({ error: 'Cross-origin request rejected.' }, { status: 403 })
  }
  const nonce = Buffer.from(randomUUID()).toString('base64')
  const providedRequestId = request.headers.get('x-request-id')?.trim()
  const requestId =
    providedRequestId && /^[A-Za-z0-9._:-]{1,128}$/.test(providedRequestId) ? providedRequestId : randomUUID()
  const policy = contentSecurityPolicy(nonce)
  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('x-request-id', requestId)
  headers.set('x-pathname', request.nextUrl.pathname)
  headers.set('Content-Security-Policy', policy)

  const response = NextResponse.next({ request: { headers } })
  response.headers.set('Content-Security-Policy', policy)
  response.headers.set('x-request-id', requestId)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' }
      ]
    }
  ]
}
