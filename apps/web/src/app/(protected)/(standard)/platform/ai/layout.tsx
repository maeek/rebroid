import type { ReactNode } from 'react'
import { requireFeature } from '@/server/orchestrator/features'

export default async function AiLayout({ children }: { children: ReactNode }) {
  await requireFeature('feature.ai')
  return children
}
