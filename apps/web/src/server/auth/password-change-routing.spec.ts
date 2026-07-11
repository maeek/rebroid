import { describe, expect, it } from 'vitest'
import { passwordChangeRedirectPath, requiredPasswordChangePath } from './password-change-routing'

describe('password change route enforcement', () => {
  it('redirects flagged users to the required password-change page', () => {
    expect(passwordChangeRedirectPath({ passwordChangeRequired: true, pathname: '/apps' })).toBe(
      requiredPasswordChangePath
    )
  })

  it('allows flagged users to stay on the required password-change page', () => {
    expect(
      passwordChangeRedirectPath({ passwordChangeRequired: true, pathname: requiredPasswordChangePath })
    ).toBeNull()
  })

  it('redirects unflagged users away from the required password-change page', () => {
    expect(passwordChangeRedirectPath({ passwordChangeRequired: false, pathname: requiredPasswordChangePath })).toBe(
      '/apps'
    )
  })

  it('allows unflagged users to use normal protected routes', () => {
    expect(passwordChangeRedirectPath({ passwordChangeRequired: false, pathname: '/apps' })).toBeNull()
  })
})
