import { RuntimeNetworksPageEntry } from '@/features/platform/pages/runtime-networks/page-entry'
import type { NetworksSearchParams } from '@/features/platform/pages/runtime-networks/page-data.server'

export default function RuntimeNetworksPage({ searchParams }: { searchParams?: Promise<NetworksSearchParams> }) {
  return <RuntimeNetworksPageEntry searchParams={searchParams} />
}
