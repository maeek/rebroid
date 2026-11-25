import type { ReactNode } from 'react'
import { requireFeature } from '@/server/orchestrator/features'

export default async function DevicesLayout({ children }: { children: ReactNode }) {
  await requireFeature('feature.external-devices')
  return children
}
