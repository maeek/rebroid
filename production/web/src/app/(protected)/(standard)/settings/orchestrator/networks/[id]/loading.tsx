import { PlatformResourceDetailPageSkeleton } from '@/features/orchestrator/components/loaders/orchestrator-page-skeletons'

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
