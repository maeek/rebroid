import { RuntimeContainerDetailPageEntry } from '@/features/platform/pages/runtime-container-detail/page-entry'

export default function RuntimeContainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <RuntimeContainerDetailPageEntry params={params} />
}
