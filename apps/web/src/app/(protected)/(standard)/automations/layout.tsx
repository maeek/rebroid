import type { ReactNode } from 'react'
import { requireFeature } from '@/server/orchestrator/features'

export default async function AutomationsLayout({ children }: { children: ReactNode }) {
  await requireFeature('feature.workflows')
  return children
}
