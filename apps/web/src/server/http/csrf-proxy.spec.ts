import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { csrfRequestIsAllowed, proxy } from '../../proxy'

const request = (path: string, headers: Record<string, string> = {}, serverOrigin = 'https://rebroid.example') =>
  new NextRequest(`${serverOrigin}${path}`, { method: 'POST', headers })

describe('API CSRF boundary', () => {
  it('accepts same-origin cookie-authenticated mutations', () => {
    expect(
      csrfRequestIsAllowed(
        request('/api/bff/preferences/ui-settings', { cookie: 'session=value', origin: 'https://rebroid.example' })
      )
    ).toBe(true)
  })

  it('rejects cross-origin and origin-less cookie-authenticated mutations', () => {
    expect(
      csrfRequestIsAllowed(
        request('/api/bff/preferences/ui-settings', { cookie: 'session=value', origin: 'https://evil.example' })
      )
    ).toBe(false)
    expect(csrfRequestIsAllowed(request('/api/bff/preferences/ui-settings', { cookie: 'session=value' }))).toBe(false)
  })

  it('accepts the public origin forwarded to the standalone server', () => {
    expect(
      csrfRequestIsAllowed(
        request(
          '/api/bff/platform/image-builds/gapps',
          {
            cookie: 'session=value',
            origin: 'https://rebroid.example:3443',
            'x-forwarded-host': 'rebroid.example:3443',
            'x-forwarded-proto': 'https'
          },
          'https://0.0.0.0:3101'
        )
      )
    ).toBe(true)
  })

  it('leaves NextAuth CSRF handling and non-cookie clients intact', () => {
    expect(csrfRequestIsAllowed(request('/api/auth/callback/credentials', { cookie: 'session=value' }))).toBe(true)
    expect(csrfRequestIsAllowed(request('/api/bff/preferences/ui-settings'))).toBe(true)
  })

  it('returns rejected mutations through the shared operation-result contract', async () => {
    const response = proxy(
      request('/api/bff/platform/image-builds/gapps/cache', {
        cookie: 'session=value',
        origin: 'https://evil.example',
        'x-request-id': 'request-123'
      })
    )

    expect(response.status).toBe(403)
    expect(response.headers.get('x-request-id')).toBe('request-123')
    await expect(response.json()).resolves.toEqual({
      ok: false,
      requestId: 'request-123',
      error: {
        message: 'Cross-origin request rejected.',
        code: 'forbidden',
        status: 403,
        requestId: 'request-123'
      }
    })
  })
})
