import { afterEach, describe, expect, it } from 'vitest'
import { createMfaSecret, createRecoveryCodes, decryptMfaSecret, encryptMfaSecret, verifyTotp } from './mfa-crypto'

describe('MFA cryptography', () => {
  afterEach(() => delete process.env.MFA_ENCRYPTION_KEY)

  it('verifies the RFC TOTP vector with a six-digit code', () => {
    expect(verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000)).toBe(true)
    expect(verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287083', 59_000)).toBe(false)
  })

  it('encrypts secrets with authenticated encryption', () => {
    process.env.MFA_ENCRYPTION_KEY = 'test-encryption-key-that-is-at-least-32-characters'
    const secret = createMfaSecret()
    const encrypted = encryptMfaSecret(secret)
    expect(encrypted).not.toContain(secret)
    expect(decryptMfaSecret(encrypted)).toBe(secret)
  })

  it('creates distinct one-time recovery codes', () => {
    const codes = createRecoveryCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
  })
})
