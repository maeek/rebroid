/* eslint-disable @typescript-eslint/require-await */
import { getServerSession, type NextAuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { userService } from './user'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, account, profile: _profile }) {
      if (account && account.type === 'credentials') {
        token.userId = account.providerAccountId
      }
      return token
    },
    async session({ session, token, user: _user }) {
      session.user.id = token.userId
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

        return userService.authenticate(username, password)
      }
    })
  ]
}

export const getServerAuthSession = () => getServerSession(authOptions)
