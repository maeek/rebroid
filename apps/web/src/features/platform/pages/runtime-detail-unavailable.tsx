import { unstable_rethrow } from 'next/navigation'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { PageLoadFailure } from '@/shared/ui/page/page-load-failure'

export const RuntimeDetailUnavailable = ({
  error,
  resource,
  href,
  backLabel
}: {
  error: unknown
  resource: string
  href: string
  backLabel: string
}) => {
  unstable_rethrow(error)
  const missing = error instanceof OrchestratorRequestError && error.status === 404
  return (
    <PageLoadFailure
      title={missing ? `${resource} not found` : `${resource} details unavailable`}
      description={
        missing
          ? 'This resource may have been removed. Return to the list to find an available resource.'
          : 'Could not load the resource details. Try again or return to the list.'
      }
      requestId={error instanceof OrchestratorRequestError ? error.requestId : undefined}
      retry={!missing}
      backAction={{ label: backLabel, href }}
    />
  )
}
