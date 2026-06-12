import { ApplicationViewerPageEntry } from '@/features/applications/pages/application-viewer/page-entry'

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <ApplicationViewerPageEntry params={params} />
}
