import { NextRequest, NextResponse } from 'next/server'
import { orchestratorApplicationsClient } from '@/server/orchestrator/applications/client'
import { getCurrentOwnerUserId } from '@/server/orchestrator/current-user'

export const POST = async (request: NextRequest) => {
  let ownerUserId: string
  try {
    ownerUserId = await getCurrentOwnerUserId()
  } catch {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const body = await request.formData()
  const apk = body.get('apk')
  if (!(apk instanceof File)) {
    return NextResponse.json({ message: 'APK file is required' }, { status: 400 })
  }

  body.set('ownerUserId', ownerUserId)
  const uploaded = await orchestratorApplicationsClient.uploadApk(body)
  return NextResponse.json(uploaded)
}
