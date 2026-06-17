import { RuntimeNetworkDetailPageEntry } from '@/features/platform/pages/runtime-network-detail/page-entry'

export default function RuntimeNetworkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <RuntimeNetworkDetailPageEntry params={params} />
}
