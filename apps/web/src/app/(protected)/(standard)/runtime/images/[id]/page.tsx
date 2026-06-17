import { RuntimeImageDetailPageEntry } from '@/features/platform/pages/runtime-image-detail/page-entry'

export default function RuntimeImageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <RuntimeImageDetailPageEntry params={params} />
}
