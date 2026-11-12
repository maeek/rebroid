'use server'

import { z } from 'zod'
import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { revokeAccountSessions } from '@/server/auth/account-sessions'
import { getCurrentSessionIdentity, getCurrentUser, requireAdmin } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'

const inputSchema = z.object({
  userId: z.string().min(1).max(200).optional(),
  sessionId: z.uuid().nullable()
})

export const revokeAccountSessionsAction = async (input: z.input<typeof inputSchema>) =>
  runSafeAction(
    async () => {
      const parsed = inputSchema.safeParse(input)
      if (!parsed.success) {
        throw new PublicActionError('Invalid session selection.', { code: 'validation', status: 400 })
      }
      const { userId, sessionId } = parsed.data
      const actor = userId ? await requireAdmin() : await getCurrentUser()
      const identity = await getCurrentSessionIdentity()
      const target = userId ?? actor.id
      const count = revokeAccountSessions(identity, target, sessionId)
      if (count) {
        recordAuditEvent({
          actorUserId: actor.id,
          actorLabel: actor.name,
          category: 'auth',
          action: 'auth.sessions.revoke',
          resourceType: 'user',
          resourceId: target,
          details: { count, scope: sessionId ? 'one' : 'all' }
        })
      }
      return count
    },
    { fallbackMessage: 'Could not sign out sessions.', logLabel: 'revokeAccountSessionsAction failed' }
  )
