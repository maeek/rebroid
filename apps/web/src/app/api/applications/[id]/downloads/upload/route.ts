import { NextRequest, NextResponse } from 'next/server'
import { orchestratorApplicationsClient } from '@/server/orchestrator/applications/client'
import { getOrchestratorBaseUrl } from '@/server/orchestrator/config'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { hasPermission } from '@/shared/permissions/permissions'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'File upload failed.')
const secretHeaderName = 'x-orchestrator-secret'
const orchestratorSharedSecret = process.env.ORCHESTRATOR_SHARED_SECRET?.trim()

export const runtime = 'nodejs'

const upstreamErrorMessage = async (response: Response) => {
  const error = (await response.json().catch(() => null)) as { message?: unknown } | null
  const message = error?.message
  if (Array.isArray(message)) return message.join(', ')
  return typeof message === 'string' ? message : response.statusText || 'File upload failed.'
}

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
    const app = await orchestratorApplicationsClient.getApplication(id)
    if (app.ownerUserId !== user.ownerUserId) {
      return NextResponse.json(
        { message: 'Open this app as your own copy before transferring files.' },
        { status: 403 }
      )
    }

    if (!request.body) {
      return NextResponse.json({ message: 'File is required.' }, { status: 400 })
    }

    const query = new URLSearchParams({ path: request.nextUrl.searchParams.get('path') || '/data' })
    const upstreamUrl =
      `${getOrchestratorBaseUrl().replace(/\/$/, '')}/api/v1/android-applications/${encodeURIComponent(id)}/files?` +
      query.toString()
    const headers = new Headers()
    const contentType = request.headers.get('content-type')
    const contentLength = request.headers.get('content-length')
    if (contentType) headers.set('content-type', contentType)
    if (contentLength) headers.set('content-length', contentLength)
    headers.set('accept', 'application/json')
    if (orchestratorSharedSecret) headers.set(secretHeaderName, orchestratorSharedSecret)

    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: request.body,
      duplex: 'half'
    } as RequestInit & { duplex: 'half' })

    if (!response.ok) {
      return NextResponse.json({ message: await upstreamErrorMessage(response) }, { status: response.status })
    }

    return NextResponse.json(await response.json())
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error) }, { status: 500 })
  }
}
