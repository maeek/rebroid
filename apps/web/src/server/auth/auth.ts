/* eslint-disable @typescript-eslint/require-await */
import { getServerSession, type NextAuthOptions, type Session } from 'next-auth'
import { encode, type JWT } from 'next-auth/jwt'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { recordAuditEvent } from '@/server/audit/events'
import { deleteAccountSession, extendAccountSession } from '@/server/persistence/account-sessions-repository'
import { isAccentColor } from '@/shared/model/theme/accent-color'
import { accountSessionMaxAgeSeconds, checkAccountSession, startAccountSession } from './account-sessions'
import { clearLoginAccountAttempts, consumeLoginAttempt, loginSourceFromHeaderRecord } from './login-security'
import { readAccountSessionIdentity } from './session-identity'
import { userService } from './user'

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z
    .string()
    .min(1)
    .max(128)
    .refine(value => Buffer.byteLength(value, 'utf8') <= 512),
  mfaCode: z.string().trim().max(32).optional()
})

const resolveSession = async (session: Session, token: JWT): Promise<Session> => {
  const identity = readAccountSessionIdentity(token)
  if (!identity) return { expires: session.expires }

  const currentUser = await userService.getUserById(identity.userId)
  const active = checkAccountSession(identity, { recordActivity: true })
  if (!currentUser || !active) return { expires: session.expires }

  session.user = {
    id: currentUser.id,
    name: currentUser.name,
    sessionId: identity.sessionId,
    sessionVersion: identity.sessionVersion,
    authEpoch: identity.authEpoch,
    passwordChangeRequired: active.passwordChangeRequired,
    image: currentUser.avatarDataUrl,
    accentColor: currentUser.accentColor
  }
  return session
}

const serverAuthOptions: NextAuthOptions = {
  events: {
    async signOut({ token }) {
      const identity = readAccountSessionIdentity(token)
      if (identity) deleteAccountSession(identity.userId, identity.sessionId)
    }
  },
  session: {
    strategy: 'jwt',
    maxAge: accountSessionMaxAgeSeconds
  },
  callbacks: {
    async jwt({ token, account, profile: _profile, user }) {
      if (account && account.type === 'credentials') {
        token.userId = account.providerAccountId
      }
      if (user?.sessionId) {
        token.sessionId = user.sessionId
        token.sessionVersion = user.sessionVersion
        token.authEpoch = user.authEpoch
      }
      if (user && 'passwordChangeRequired' in user) {
        token.passwordChangeRequired = user.passwordChangeRequired
      }
      if (user?.image !== undefined) {
        token.picture = user.image
      }
      if (user && 'accentColor' in user && isAccentColor(user.accentColor)) {
        token.accentColor = user.accentColor
      }
      return token
    },
    session: ({ session, token }) => resolveSession(session, token)
  },
  pages: {
    signIn: '/login'
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text', placeholder: 'username' },
        password: { label: 'Password', type: 'password' },
        mfaCode: { label: 'Authentication code', type: 'text', placeholder: '123456' }
      },
      async authorize(credentials, req) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) {
          return null
        }
        const { username, password, mfaCode } = parsed.data
        const attempt = consumeLoginAttempt(username, loginSourceFromHeaderRecord(req.headers))
        if (!attempt.allowed) {
          recordAuditEvent({
            actorLabel: username,
            category: 'auth',
            action: 'auth.login.lockout',
            outcome: 'failure',
            details: { username }
          })
          return null
        }

        const user = await userService.authenticate(username, password, mfaCode)
        const identity = user ? startAccountSession(user, req.headers?.['user-agent']) : null
        if (identity) clearLoginAccountAttempts(attempt.accountKey)
        recordAuditEvent({
          actorUserId: identity?.userId,
          actorLabel: user?.name || username,
          category: 'auth',
          action: identity ? 'auth.login.success' : 'auth.login.failure',
          outcome: identity ? 'success' : 'failure',
          details: { username }
        })
        return user && identity ? { ...user, sessionId: identity.sessionId, authEpoch: identity.authEpoch } : null
      }
    })
  ]
}

export const authOptions: NextAuthOptions = {
  ...serverAuthOptions,
  jwt: {
    async encode(params) {
      const encoded = await encode(params)
      const identity = readAccountSessionIdentity(params.token)
      // Only the NextAuth HTTP handler writes the renewed cookie back to the browser.
      if (identity) extendAccountSession(identity, Date.now() + accountSessionMaxAgeSeconds * 1000)
      return encoded
    }
  }
}

export const getServerAuthSession = () => getServerSession(serverAuthOptions)

export const getServerAuthSessionStatus = () =>
  getServerSession({
    ...serverAuthOptions,
    callbacks: {
      ...serverAuthOptions.callbacks,
      async session({ session, token }) {
        const identity = readAccountSessionIdentity(token)
        return {
          expires: session.expires,
          user: identity && checkAccountSession(identity) ? { id: identity.userId } : undefined
        }
      }
    }
  })
