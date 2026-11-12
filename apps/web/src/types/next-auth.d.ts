import { DefaultSession } from 'next-auth'
import type { AccentColor } from '@/shared/model/theme/accent-color'

declare module 'next-auth' {
  interface User {
    image?: string | null
    sessionVersion?: number
    sessionId?: string
    passwordChangeRequired?: boolean
    accentColor?: AccentColor
    authEpoch?: string
  }

  interface Session extends DefaultSession {
    user?: {
      id: string
      sessionVersion?: number
      sessionId?: string
      passwordChangeRequired?: boolean
      accentColor?: AccentColor
      authEpoch?: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    sessionVersion?: number
    sessionId?: string
    passwordChangeRequired?: boolean
    accentColor?: AccentColor
    authEpoch?: string
  }
}
