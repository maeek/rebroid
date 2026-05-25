import { NextRequest, NextResponse } from 'next/server'
import { orchestratorApplicationsClient } from '@/server/orchestrator/applications/client'
import { getCurrentOwnerUserId } from '@/server/orchestrator/current-user'

export const GET = async (request: NextRequest) => {
  let ownerUserId: string
  try {
    ownerUserId = await getCurrentOwnerUserId()
  } catch {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const sha256 = request.nextUrl.searchParams.get('sha256')?.trim() ?? ''
  if (!/^[a-fA-F0-9]{64}$/.test(sha256)) {
    return NextResponse.json({ message: 'Valid SHA-256 hash is required' }, { status: 400 })
  }

  try {
    const uploaded = await orchestratorApplicationsClient.lookupUploadedApk(sha256.toLowerCase(), ownerUserId)
    return NextResponse.json(uploaded)
  } catch {
    return NextResponse.json(null)
  }
}
