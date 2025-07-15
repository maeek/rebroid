// export { auth as middleware } from '@/lib/auth'

import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set('x-current-path', request.nextUrl.pathname)

  return NextResponse.next({ ...request, headers })
}
