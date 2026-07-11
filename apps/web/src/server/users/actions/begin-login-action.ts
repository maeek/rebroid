'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { clearLoginAttempts, consumeLoginAttempt, loginSourceFromHeaders } from '@/server/auth/login-security'
import { userService } from '@/server/auth/user'
import { PublicActionError } from '@/server/errors/public-action-error'

const inputSchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(128)
})

const invalidCredentials = () =>
  new PublicActionError('The username or password is incorrect.', { code: 'unauthenticated', status: 401 })

export const beginLoginAction = async (input: { username: string; password: string }) =>
  runSafeAction(
    async () => {
      const parsed = inputSchema.safeParse(input)
      if (!parsed.success) throw invalidCredentials()
      const requestHeaders = await headers()
      const attempt = consumeLoginAttempt(parsed.data.username, loginSourceFromHeaders(requestHeaders))
      if (!attempt.allowed) throw invalidCredentials()

      const result = await userService.verifyPrimaryCredentials(parsed.data.username, parsed.data.password)
      recordAuditEvent({
        actorUserId: result?.userId,
        actorLabel: result?.userLabel || parsed.data.username,
        category: 'auth',
        action: result ? 'auth.primary_credentials.success' : 'auth.login.failure',
        outcome: result ? 'success' : 'failure',
        details: { username: parsed.data.username }
      })
      if (!result) throw invalidCredentials()
      clearLoginAttempts(attempt.keys)
      return { mfaRequired: result.mfaRequired }
    },
    { fallbackMessage: 'Could not sign in.', logLabel: 'beginLoginAction failed' }
  )
