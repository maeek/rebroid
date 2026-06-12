import { ManageAppPageEntry } from '@/features/applications/pages/manage-app/page-entry'

export default function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  return <ManageAppPageEntry params={params} />
}
