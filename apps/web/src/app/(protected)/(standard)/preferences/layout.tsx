import type { ReactNode } from 'react'
import { requireAdmin } from '@/server/auth/authorization'

export default async function PreferencesLayout({ children }: { children: ReactNode }) {
  await requireAdmin()

  return children
}
