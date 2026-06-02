/* eslint-disable @typescript-eslint/require-await */
import { getServerSession, type NextAuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { recordAuditEvent } from '@/server/audit/events'
import { consumeRateLimit } from '@/server/rate-limit/in-memory'
import { userService } from './user'

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(1024)
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
      }
      if (user?.image !== undefined) {
        token.picture = user.image
      }
      return token
    },
    async session({ session, token, user: _user }) {
      const currentUser = token.userId ? await userService.getUserById(token.userId).catch(() => null) : null

      session.user.id = token.userId
      session.user.name = currentUser?.name ?? session.user.name
      session.user.role = currentUser?.role ?? token.role
      session.user.sessionVersion = token.sessionVersion
      session.user.image = currentUser?.avatarDataUrl ?? (typeof token.picture === 'string' ? token.picture : null)
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
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, _req) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) {
          return null
        }
        const { username, password } = parsed.data
        if (!consumeRateLimit(`login:${username.toLowerCase()}`, 10, 15 * 60 * 1000)) {
          recordAuditEvent({
            actorLabel: username,
            category: 'auth',
            action: 'auth.login.lockout',
            outcome: 'failure',
            details: { username }
          })
          return null
        }

        const user = await userService.authenticate(username, password)
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
