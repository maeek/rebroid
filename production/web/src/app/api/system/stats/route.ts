import { NextResponse } from 'next/server'
import { getSystemStats } from '@/lib/system/system-stats'
import { getServerAuthSession } from '@/server/auth/auth'

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
