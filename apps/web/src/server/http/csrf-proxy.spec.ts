import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { csrfRequestIsAllowed } from '../../proxy'

const request = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`https://rebroid.example${path}`, { method: 'POST', headers })

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

  it('leaves NextAuth CSRF handling and non-cookie clients intact', () => {
    expect(csrfRequestIsAllowed(request('/api/auth/callback/credentials', { cookie: 'session=value' }))).toBe(true)
    expect(csrfRequestIsAllowed(request('/api/bff/preferences/ui-settings'))).toBe(true)
  })
})
