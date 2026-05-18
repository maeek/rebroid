/* eslint-disable @typescript-eslint/require-await */
import { getServerSession, type NextAuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { userService } from './user'

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
        const { username, password } = credentials as {
          username: string
          password: string
        }

        const user = await userService.authenticate(username, password)
        return user
      }
    })
  ]
}

export const getServerAuthSession = () => getServerSession(authOptions)
