import { PlatformResourceDetailPageSkeleton } from '@/features/orchestrator/components/loaders/orchestrator-page-skeletons'

export default function Loading() {
  return (
    <PlatformResourceDetailPageSkeleton
      titleWidth='w-64 max-sm:w-44'
      actionCount={1}
      badgeCount={1}
      relatedColumns={4}
    />
  )
}
