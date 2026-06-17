import { PlatformResourceDetailPageSkeleton } from '@/features/platform/components/loaders/platform-page-skeletons'

export default function Loading() {
  return (
    <PlatformResourceDetailPageSkeleton
      titleWidth='w-48 max-sm:w-36'
      actionCount={1}
      badgeCount={2}
      relatedColumns={4}
    />
  )
}
