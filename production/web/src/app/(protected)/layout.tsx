import type { ReactNode } from 'react'
import { getCurrentUser } from '@/server/auth/authorization'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  await getCurrentUser()

  return children
}
