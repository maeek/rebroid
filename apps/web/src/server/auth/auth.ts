/* eslint-disable @typescript-eslint/require-await */
import { getServerSession, type NextAuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { recordAuditEvent } from '@/server/audit/events'
import { getAuthEpoch } from '@/server/persistence/auth-security-repository'
import { defaultAccentColor, isAccentColor } from '@/shared/model/theme/accent-color'
import { clearLoginAttempts, consumeLoginAttempt, loginSourceFromHeaderRecord } from './login-security'
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

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, account, profile: _profile, user }) {
      if (account && account.type === 'credentials') {
        token.userId = account.providerAccountId
      }
      if (user && 'role' in user) {
        token.role = user.role
      }
      if (user && 'sessionVersion' in user) {
        token.sessionVersion = user.sessionVersion
        token.authEpoch = getAuthEpoch()
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
    async session({ session, token, user: _user }) {
      const currentUser = token.userId ? await userService.getUserById(token.userId).catch(() => null) : null

      session.user.id = token.userId
      session.user.name = currentUser?.name ?? session.user.name
      session.user.role = currentUser?.role ?? token.role
      session.user.sessionVersion = token.sessionVersion
      session.user.authEpoch = token.authEpoch
      session.user.passwordChangeRequired = currentUser?.passwordChangeRequired ?? token.passwordChangeRequired
      session.user.image = currentUser?.avatarDataUrl ?? (typeof token.picture === 'string' ? token.picture : null)
      session.user.accentColor =
        currentUser?.accentColor ?? (isAccentColor(token.accentColor) ? token.accentColor : defaultAccentColor)
      return session
    }
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
        if (user) clearLoginAttempts(attempt.keys)
        recordAuditEvent({
          actorUserId: user?.id,
          actorLabel: user?.name || username,
          category: 'auth',
          action: user ? 'auth.login.success' : 'auth.login.failure',
          outcome: user ? 'success' : 'failure',
          details: { username }
        })
        return user
      }
    })
  ]
}

export const getServerAuthSession = () => getServerSession(authOptions)
