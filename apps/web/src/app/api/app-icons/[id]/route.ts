import { NextResponse } from 'next/server'
import { readStoredAppIcon } from '@/server/app-icons/store'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'

export const GET = async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params

  try {
    const [user, app] = await Promise.all([getCurrentUserContext(), orchestratorAppCatalogClient.getApplication(id)])

    if (!user.isPlatformAdmin && app.ownerUserId !== user.ownerUserId) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 })
    }

    const icon = await readStoredAppIcon(id)
    if (!icon) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 })
    }

    return new NextResponse(icon.buffer, {
      headers: {
        'content-type': icon.mimeType,
        'cache-control': 'private, no-store'
      }
    })
  } catch {
    return NextResponse.json({ message: 'Not found' }, { status: 404 })
  }
}
