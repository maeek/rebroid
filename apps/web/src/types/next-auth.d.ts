import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    role?: 'admin' | 'user'
    image?: string | null
    sessionVersion?: number
  }

  interface Session extends DefaultSession {
    user: {
      id: string
      role?: 'admin' | 'user'
      sessionVersion?: number
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    role?: 'admin' | 'user'
    sessionVersion?: number
  }
}
