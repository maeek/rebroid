import { PlatformGridPagination } from '@/features/orchestrator/components/platform-grid-pagination'
import { useActivityController, useActivityData } from '../activity-context'

export const ActivityEventsPagination = () => {
  const { result } = useActivityData()
  const controller = useActivityController()

  return (
    <PlatformGridPagination
      totalItems={result.total}
      pageIndex={result.page - 1}
      pageSize={result.pageSize}
      onPageIndexChange={pageIndex => controller.pushParams({ page: pageIndex + 1 })}
      onPageSizeChange={pageSize => controller.pushParams({ page: 1, pageSize })}
    />
  )
}
