import { NextRequest, NextResponse } from 'next/server'
import { recordAuditEvent } from '@/server/audit/events'
import { auditEventsToCsv, auditFiltersFromSearchParams } from '@/server/audit/query'
import { getCurrentUser } from '@/server/auth/authorization'
import { exportAuditEvents } from '@/server/storage/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })
  }

  const filters = auditFiltersFromSearchParams(Object.fromEntries(request.nextUrl.searchParams.entries()))
  const events = exportAuditEvents(filters)
  recordAuditEvent({
    actorUserId: user.id,
    actorLabel: user.name || user.username || user.id,
    category: 'audit',
    action: 'audit.export',
    resourceType: 'audit_log',
    outcome: 'success',
    details: { filters, exported: events.length }
  })

  const timestamp = new Date().toISOString().replaceAll(':', '-')
  return new NextResponse(auditEventsToCsv(events), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="rebroid-activity-${timestamp}.csv"`,
      'Content-Type': 'text/csv; charset=utf-8'
    }
  })
}
