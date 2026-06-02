import { NextRequest, NextResponse } from 'next/server'
import { orchestratorApplicationsClient } from '@/server/orchestrator/applications/client'
import { getApkRouteUser } from '../apk-route-auth'

export const GET = async (request: NextRequest) => {
  const { user, response } = await getApkRouteUser()
  if (response) return response

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
