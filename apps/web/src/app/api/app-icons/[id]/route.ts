import { readFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { getStoredAppIconFile } from '@/server/app-icons/store'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'

export const GET = async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params

  try {
    const [user, app] = await Promise.all([getCurrentUserContext(), orchestratorAppCatalogClient.getApplication(id)])

    if (user.role !== 'admin' && app.ownerUserId !== user.ownerUserId) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 })
    }

    const icon = await getStoredAppIconFile(id)
    if (!icon) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 })
    }

    const body = await readFile(icon.path)
    return new NextResponse(body, {
      headers: {
        'content-type': icon.mimeType,
        'cache-control': 'private, max-age=300'
      }
    })
  } catch {
    return NextResponse.json({ message: 'Not found' }, { status: 404 })
  }
}
