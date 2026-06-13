import { DefaultSession } from 'next-auth'
import type { AccentColor } from '@/shared/model/theme/accent-color'

declare module 'next-auth' {
  interface User {
    role?: 'admin' | 'user'
    image?: string | null
    sessionVersion?: number
    accentColor?: AccentColor
  }

  interface Session extends DefaultSession {
    user: {
      id: string
      role?: 'admin' | 'user'
      sessionVersion?: number
      accentColor?: AccentColor
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    role?: 'admin' | 'user'
    sessionVersion?: number
    accentColor?: AccentColor
  }
}
