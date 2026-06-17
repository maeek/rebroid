import { ManageAppProfilesPageEntry } from '@/features/applications/pages/manage-app-profiles/page-entry'

export default function ManageProfilesPage({ params }: { params: Promise<{ slug: string }> }) {
  return <ManageAppProfilesPageEntry params={params} />
}
