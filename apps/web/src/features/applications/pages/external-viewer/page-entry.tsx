import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { PublicActionError } from '@/server/errors/public-action-error'
import { loadExternalViewer } from '@/server/orchestrator/external-devices/viewer'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { ExternalViewerPage } from './page-client'

const ids = z.object({ id: z.uuid(), attachment: z.uuid(), retry: z.uuid().optional() })

export async function ExternalViewerPageEntry({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ attachment?: string | string[]; retry?: string | string[] }>
}) {
  const { id } = await params
  const { attachment, retry } = await searchParams
  const target = ids.safeParse({ id, attachment, retry })
  if (!target.success) return <ExternalViewerPage />
  try {
    const data = await loadExternalViewer(target.data.id, target.data.attachment)
    return (
      <ExternalViewerPage
        data={data}
        key={`${data.session.id}:${target.data.retry ?? ''}`}
      />
    )
  } catch (error) {
    unstable_rethrow(error)
    if (!(error instanceof OrchestratorRequestError || error instanceof PublicActionError)) throw error
    return <ExternalViewerPage />
  }
}
