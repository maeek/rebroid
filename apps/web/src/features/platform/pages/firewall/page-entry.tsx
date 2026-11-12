import { Suspense } from 'react'
import { requireAdmin } from '@/server/auth/authorization'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { FirewallPageClient } from './page-client'
import { loadFirewallPageData } from './page-data.server'
import { FirewallPageLoading } from './page-loading'

const FirewallPageContent = async () => {
  await requireAdmin()

  return (
    <OrchestratorPageBoundary
      load={loadFirewallPageData}
      fallback={requestId => <FirewallPageClient requestId={requestId} />}
    >
      {data => <FirewallPageClient {...data} />}
    </OrchestratorPageBoundary>
  )
}

export const FirewallPageEntry = () => (
  <Suspense fallback={<FirewallPageLoading />}>
    <FirewallPageContent />
  </Suspense>
)
