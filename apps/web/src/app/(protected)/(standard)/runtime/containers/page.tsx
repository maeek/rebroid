import { RuntimeContainersPageEntry } from '@/features/platform/pages/runtime-containers/page-entry'
import type { PlatformGridSearchParams } from '@/features/platform/pages/platform-grid-search'

export default function RuntimeContainersPage({ searchParams }: { searchParams?: Promise<PlatformGridSearchParams> }) {
  return <RuntimeContainersPageEntry searchParams={searchParams} />
}
