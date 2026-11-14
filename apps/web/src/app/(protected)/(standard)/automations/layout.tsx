import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { hasPermission } from '@/shared/permissions/permissions'

export default async function AutomationsLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUserContext()
  if (!hasPermission(user.permissions, 'automations:manage')) notFound()
  return children
}
