import { NextRequest, NextResponse } from 'next/server'
import {
  assertCanUseOwnedApplicationRuntime,
  ownedRuntimeMessage
} from '@/server/orchestrator/applications/actions/common/action-helpers'
import { orchestratorAppViewerClient } from '@/server/orchestrator/applications/viewer-client'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { hasPermission } from '@/shared/permissions/permissions'

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Could not download recording.')

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; recordingId: string }> }) {
  const { id, recordingId } = await params
  const surfaceSessionId = request.nextUrl.searchParams.get('surfaceSessionId')
  if (!surfaceSessionId) {
    return NextResponse.json({ message: 'Display surface session is required.' }, { status: 400 })
  }

  try {
    const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
    if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:capture-screenshot')) {
      return NextResponse.json({ message: 'You do not have permission to record this viewer.' }, { status: 403 })
    }

    const response = await orchestratorAppViewerClient.downloadRecording(id, recordingId, surfaceSessionId)
    return new NextResponse(response.body, {
      headers: {
        'content-type': response.headers.get('content-type') ?? 'video/mp4',
        'content-disposition':
          response.headers.get('content-disposition') ?? `attachment; filename="${recordingId}.mp4"`
      }
    })
  } catch (error) {
    const status = error instanceof OrchestratorRequestError ? error.status : 500
    return NextResponse.json({ message: errorMessage(error) }, { status })
  }
}
