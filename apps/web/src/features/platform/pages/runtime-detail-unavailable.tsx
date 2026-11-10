import { PageLoadFailure } from '@/shared/ui/page/page-load-failure'
import type { OrchestratorPageFailure } from '@/server/orchestrator/orchestrator-page-read'

export const RuntimeDetailUnavailable = ({
  failure,
  resource,
  href,
  backLabel
}: {
  failure: OrchestratorPageFailure
  resource: string
  href: string
  backLabel: string
}) => {
  const missing = failure.kind === 'missing'
  return (
    <PageLoadFailure
      title={missing ? `${resource} not found` : `${resource} details unavailable`}
      description={
        missing
          ? 'This resource may have been removed. Return to the list to find an available resource.'
          : 'Could not load the resource details. Try again or return to the list.'
      }
      requestId={failure.requestId}
      retry={!missing}
      backAction={{ label: backLabel, href }}
    />
  )
}
