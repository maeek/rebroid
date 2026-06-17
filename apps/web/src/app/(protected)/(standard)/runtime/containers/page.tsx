import { RuntimeContainersPageEntry } from '@/features/platform/pages/runtime-containers/page-entry'
import type { ContainersSearchParams } from '@/features/platform/pages/runtime-containers/page-data.server'

export default function RuntimeContainersPage({
  searchParams
}: {
  searchParams?: Promise<ContainersSearchParams>
}) {
  return <RuntimeContainersPageEntry searchParams={searchParams} />
}
