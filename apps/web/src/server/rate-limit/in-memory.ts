type RateLimitEntry = {
  count: number
  resetAt: number
}

const entries = new Map<string, RateLimitEntry>()
const maxTrackedKeys = 10_000
let nextExpiry = Infinity

const removeExpiredEntries = (now: number) => {
  nextExpiry = Infinity
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) {
      entries.delete(key)
    } else {
      nextExpiry = Math.min(nextExpiry, entry.resetAt)
    }
  }
}

export const consumeRateLimit = (key: string, limit: number, windowMs: number) => {
  const now = Date.now()
  const current = entries.get(key)
  if (!current && entries.size >= maxTrackedKeys) {
    if (now < nextExpiry) return false
    removeExpiredEntries(now)
    if (entries.size >= maxTrackedKeys) return false
  }

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs
    entries.set(key, { count: 1, resetAt })
    nextExpiry = Math.min(nextExpiry, resetAt)
    return true
  }

  if (current.count >= limit) {
    return false
  }

  current.count += 1
  return true
}
