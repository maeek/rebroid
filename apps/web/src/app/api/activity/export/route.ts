import { NextRequest, NextResponse } from 'next/server'
import { recordAuditEvent } from '@/server/audit/events'
import { auditEventsToCsv, auditFiltersFromSearchParams, auditSortFromSearchParams } from '@/server/audit/query'
import { getCurrentUser } from '@/server/auth/authorization'
import { exportAuditEvents } from '@/server/persistence/audit-repository'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })
  }

  const searchParams = Object.fromEntries(
    [...new Set(request.nextUrl.searchParams.keys())].map(key => [key, request.nextUrl.searchParams.getAll(key)])
  )
  const filters = auditFiltersFromSearchParams(searchParams)
  const sorting = auditSortFromSearchParams(searchParams)
  const events = exportAuditEvents(filters, { sorting })
  recordAuditEvent({
    actorUserId: user.id,
    actorLabel: user.name || user.username || user.id,
    category: 'audit',
    action: 'audit.export',
    resourceType: 'audit_log',
    outcome: 'success',
    details: { filters, sorting, exported: events.length }
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
