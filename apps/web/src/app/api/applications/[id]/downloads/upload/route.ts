import { NextRequest, NextResponse } from 'next/server'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { orchestratorAppRuntimeClient } from '@/server/orchestrator/applications/runtime-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { prepareStreamingMultipartUpload } from '@/server/upload-proxy/streaming-upload'
import { hasPermission } from '@/shared/permissions/permissions'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'File upload failed.')
const maxRuntimeUploadBytes = 512 * 1024 * 1024

export const runtime = 'nodejs'

export const POST = async (request: NextRequest, context: RouteContext) => {
  const { id } = await context.params
  const user = await getCurrentUserContext().catch(() => null)

  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:transfer-files')) {
    return NextResponse.json({ message: 'You do not have permission to transfer files.' }, { status: 403 })
  }

  try {
    const app = await orchestratorAppCatalogClient.getApplication(id)
    if (app.ownerUserId !== user.ownerUserId) {
      return NextResponse.json(
        { message: 'Open this app as your own copy before transferring files.' },
        { status: 403 }
      )
    }

    const upload = prepareStreamingMultipartUpload(request, {
      maxBytes: maxRuntimeUploadBytes,
      missingMessage: 'File is required.',
      tooLargeMessage: 'File upload exceeds the 512 MB limit.'
    })
    if (!upload.ok) return upload.response
    const uploaded = await orchestratorAppRuntimeClient.uploadDataFileStream(
      id,
      upload.body,
      request.nextUrl.searchParams.get('path') || '/data',
      upload.contentType,
      request.signal
    )
    return NextResponse.json(uploaded)
  } catch (error) {
    return NextResponse.json(
      { message: errorMessage(error) },
      { status: error instanceof OrchestratorRequestError ? error.status : 500 }
    )
  }
}
