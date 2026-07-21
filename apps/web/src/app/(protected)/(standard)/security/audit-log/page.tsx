import { SecurityAuditLogPageEntry } from '@/features/settings/activity/pages/security-audit-log/page-entry'
import type { AuditSearchParams } from '@/shared/contracts/audit'

export default function SecurityAuditLogPage({ searchParams }: { searchParams?: Promise<AuditSearchParams> }) {
  return <SecurityAuditLogPageEntry searchParams={searchParams} />
}
