import type { ReactNode } from 'react'
import { requireAdmin } from '@/server/auth/authorization'

export default async function OrchestratorLayout({ children }: { children: ReactNode }) {
  await requireAdmin()

  return children
}
