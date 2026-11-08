import { AppPageSkeleton } from '@/features/applications/detail/app-page-skeleton'
import { AppActivityLoading } from '@/features/settings/activity/activity-page-skeleton'

export default function Loading() {
  return <AppPageSkeleton activity={<AppActivityLoading />} />
}
