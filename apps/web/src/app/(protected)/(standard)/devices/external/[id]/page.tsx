import { Suspense } from 'react'
import {
  ExternalDeviceDetail,
  ExternalDeviceDetailLoading
} from '@/features/applications/pages/external-devices/device-detail'
import { ActivityEventsTable } from '@/features/settings/activity/activity-events-table'
import type { AuditSearchParams } from '@/shared/contracts/audit'

export default async function Page({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<AuditSearchParams>
}) {
  const [{ id }, search] = await Promise.all([params, searchParams])
  return (
    <Suspense
      key={JSON.stringify(search.view)}
      fallback={<ExternalDeviceDetailLoading search={search} />}
    >
      <ExternalDeviceDetail
        id={id}
        search={search}
        renderActivity={activity => <ActivityEventsTable {...activity} />}
      />
    </Suspense>
  )
}
