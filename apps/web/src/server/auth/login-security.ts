import { createHash } from 'node:crypto'
import 'server-only'
import { clearPersistentRateLimits, consumePersistentRateLimit } from '@/server/persistence/auth-security-repository'

const rateLimitKey = (kind: 'account' | 'source', value: string) =>
  createHash('sha256').update(`${kind}:${value.trim().toLowerCase()}`).digest('hex')

export const loginSourceFromHeaders = (headers: Headers) =>
  headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

export const loginSourceFromHeaderRecord = (headers?: Record<string, string | string[] | undefined>) => {
  const forwarded = headers?.['x-forwarded-for']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return value?.split(',')[0]?.trim() || 'unknown'
}

export const consumeLoginAttempt = (username: string, source: string) => {
  const accountKey = rateLimitKey('account', username)
  const sourceKey = rateLimitKey('source', source)
  const accountAllowed = consumePersistentRateLimit(accountKey, 10, 15 * 60 * 1000)
  const sourceAllowed = consumePersistentRateLimit(sourceKey, 50, 15 * 60 * 1000)
  return { allowed: accountAllowed && sourceAllowed, keys: [accountKey, sourceKey] }
}

export const clearLoginAttempts = (keys: string[]) => clearPersistentRateLimits(keys)
