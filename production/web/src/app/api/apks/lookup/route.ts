import { NextRequest, NextResponse } from 'next/server'
import { orchestratorApplicationsClient } from '@/server/orchestrator/applications/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { hasPermission } from '@/shared/permissions/permissions'

export const GET = async (request: NextRequest) => {
  let user: Awaited<ReturnType<typeof getCurrentUserContext>>
  try {
    user = await getCurrentUserContext()
  } catch {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:upload-apk')) {
    return NextResponse.json({ message: 'APK upload permission is required' }, { status: 403 })
  }

  const sha256 = request.nextUrl.searchParams.get('sha256')?.trim() ?? ''
  if (!/^[a-fA-F0-9]{64}$/.test(sha256)) {
    return NextResponse.json({ message: 'Valid SHA-256 hash is required' }, { status: 400 })
  }

  try {
    const uploaded = await orchestratorApplicationsClient.lookupUploadedApk(sha256.toLowerCase(), user.ownerUserId)
    return NextResponse.json(uploaded)
  } catch {
    return NextResponse.json(null)
  }
}
