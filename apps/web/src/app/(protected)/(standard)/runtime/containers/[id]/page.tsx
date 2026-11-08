import { RuntimeContainerDetailPageEntry } from '@/features/platform/pages/runtime-container-detail/page-entry'

export default function RuntimeContainerDetailPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string | string[] }>
}) {
  return <RuntimeContainerDetailPageEntry {...props} />
}
