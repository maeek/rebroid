import { NextResponse } from 'next/server'
import { getServerAuthSession } from '@/server/auth/auth'
import { getSystemStats } from '@/server/system/system-stats'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerAuthSession()

  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  return NextResponse.json(getSystemStats(), {
    headers: {
      'Cache-Control': 'no-store'
    }
  })
}
