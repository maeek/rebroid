type RateLimitEntry = {
  count: number
  resetAt: number
}

const entries = new Map<string, RateLimitEntry>()
const maxTrackedKeys = 10_000

const removeExpiredEntries = (now: number) => {
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) {
      entries.delete(key)
    }
  }
}

export const consumeRateLimit = (key: string, limit: number, windowMs: number) => {
  const now = Date.now()
  if (entries.size >= maxTrackedKeys) {
    removeExpiredEntries(now)
  }

  const current = entries.get(key)
  if (!current && entries.size >= maxTrackedKeys) {
    return false
  }

  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (current.count >= limit) {
    return false
  }

  current.count += 1
  return true
}
