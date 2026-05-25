import { NextRequest, NextResponse } from 'next/server'
import { orchestratorApplicationsClient } from '@/server/orchestrator/applications/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { hasPermission } from '@/shared/permissions/permissions'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'File upload failed.')

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

    const body = await request.formData()
    const file = body.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'File is required.' }, { status: 400 })
    }

    const uploaded = await orchestratorApplicationsClient.uploadDownloadFile(id, body)
    return NextResponse.json(uploaded)
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error) }, { status: 500 })
  }
}
