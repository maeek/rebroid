import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    role?: 'admin' | 'user'
  }

  interface Session extends DefaultSession {
    user: {
      id: string
      role?: 'admin' | 'user'
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    role?: 'admin' | 'user'
  }
}
