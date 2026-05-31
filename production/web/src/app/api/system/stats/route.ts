import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/server/auth/authorization'
import { getSystemStats } from '@/server/system/system-stats'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })
  }

  return NextResponse.json(getSystemStats(), {
    headers: {
      'Cache-Control': 'no-store'
    }
  })
}
