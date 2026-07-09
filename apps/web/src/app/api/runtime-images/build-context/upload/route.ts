import { NextRequest, NextResponse } from 'next/server'
import { recordAuditEvent } from '@/server/audit/events'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { orchestratorPlatformClient } from '@/server/orchestrator/platform/client'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { prepareStreamingMultipartUpload } from '@/server/upload-proxy/streaming-upload'

export const runtime = 'nodejs'

const maxUploadBytes = 65 * 1024 * 1024
const maxMultipartOverheadBytes = 1024 * 1024
const defaultUploadFailureMessage = 'Build context upload failed.'
const orchestratorTransportPrefix = 'Orchestrator request failed:'

const uploadErrorResponse = (error: unknown) => {
  if (error instanceof OrchestratorRequestError) {
    if (error.message.startsWith(orchestratorTransportPrefix)) {
      return {
        status: 502,
        message: 'Could not reach the orchestrator. Check the runtime service and try again.'
      }
    }

    return {
      status: error.status,
      message: error.status >= 500 ? defaultUploadFailureMessage : error.message
    }
  }

  return {
    status: 500,
    message: defaultUploadFailureMessage
  }
}

export const POST = async (request: NextRequest) => {
  let user: Awaited<ReturnType<typeof getCurrentUserContext>>
  try {
    user = await getCurrentUserContext()
  } catch {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  if (user.role !== 'admin') {
    return NextResponse.json({ message: 'Administrator access required' }, { status: 403 })
  }

  try {
    const contextPath = request.nextUrl.searchParams.get('contextPath')?.trim()
    if (!contextPath) {
      return NextResponse.json({ message: 'Build context path is required.' }, { status: 400 })
    }

    const upload = prepareStreamingMultipartUpload(request, {
      maxBytes: maxUploadBytes,
      multipartOverheadBytes: maxMultipartOverheadBytes,
      missingMessage: 'Multipart build context file is required.',
      tooLargeMessage: 'Build context upload exceeds the 65 MB limit.'
    })
    if (!upload.ok) return upload.response

    const uploaded = await orchestratorPlatformClient.uploadImageBuildContextFile(
      upload.body,
      contextPath,
      upload.contentType,
      request.signal
    )
    recordAuditEvent({
      actorUserId: user.ownerUserId,
      actorLabel: user.ownerUserId,
      category: 'docker',
      action: 'docker.image_build.context_file.upload',
      resourceType: 'docker_image_build_context_file',
      resourceId: uploaded.id,
      resourceLabel: uploaded.contextPath,
      details: { originalName: uploaded.originalName, contextPath: uploaded.contextPath },
      sourceIp: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
      userAgent: request.headers.get('user-agent')
    })
    return NextResponse.json(uploaded)
  } catch (error) {
    const { status, message } = uploadErrorResponse(error)
    return NextResponse.json({ message }, { status })
  }
}
