import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { actionError } from '@/shared/actions/action-result'

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

const firstHeaderValue = (value: string | null) => value?.split(',')[0]?.trim() || null

const requestOrigin = (request: NextRequest) => {
  const host =
    firstHeaderValue(request.headers.get('x-forwarded-host')) ??
    firstHeaderValue(request.headers.get('host')) ??
    request.nextUrl.host
  const protocol =
    firstHeaderValue(request.headers.get('x-forwarded-proto')) ?? request.nextUrl.protocol.replace(/:$/, '')

  if (!host || (protocol !== 'http' && protocol !== 'https')) return null

  try {
    return new URL(`${protocol}://${host}`).origin
  } catch {
    return null
  }
}

export const csrfRequestIsAllowed = (request: NextRequest) => {
  if (!unsafeMethods.has(request.method) || !request.nextUrl.pathname.startsWith('/api/')) return true
  if (request.nextUrl.pathname.startsWith('/api/auth/')) return true

  const origin = request.headers.get('origin')
  if (!origin) return !request.headers.has('cookie')
  try {
    return new URL(origin).origin === requestOrigin(request)
  } catch {
    return false
  }
}

export const proxy = (request: NextRequest) => {
  const providedRequestId = request.headers.get('x-request-id')?.trim()
  const requestId =
    providedRequestId && /^[A-Za-z0-9._:-]{1,128}$/.test(providedRequestId) ? providedRequestId : randomUUID()

  if (!csrfRequestIsAllowed(request)) {
    return Response.json(
      actionError(
        {
          message: 'Cross-origin request rejected.',
          code: 'forbidden',
          status: 403,
          requestId
        },
        requestId
      ),
      { status: 403, headers: { 'x-request-id': requestId } }
    )
  }
  const nonce = Buffer.from(randomUUID()).toString('base64')
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
