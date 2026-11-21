import { RuntimeNetworksPageEntry } from '@/features/platform/pages/runtime-networks/page-entry'
import type { PlatformGridSearchParams } from '@/features/platform/pages/platform-grid-search'

export default function RuntimeNetworksPage({ searchParams }: { searchParams?: Promise<PlatformGridSearchParams> }) {
  return <RuntimeNetworksPageEntry searchParams={searchParams} />
}
