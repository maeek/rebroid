'use client'

import { useVisibilityAwareInterval } from '@/hooks/use-visibility-aware-interval'

export const SessionStatusMonitor = () => {
  useVisibilityAwareInterval({
    intervalMs: 15_000,
    task: async lifetime => {
      const signal = AbortSignal.any([lifetime, AbortSignal.timeout(5_000)])
      const response = await fetch('/api/auth/session-status', { cache: 'no-store', signal })
      if (response.status === 401 && !signal.aborted) window.location.replace('/login')
    }
  })
  return null
}
