import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { useActivityController, useActivityData } from '../activity-context'

export const ActivityEventsPagination = () => {
  const { result, loading } = useActivityData()
  const controller = useActivityController()

  return (
    <DataGridPagination
      loading={loading}
      totalItems={result.total}
      pageIndex={result.page - 1}
      pageSize={result.pageSize}
      onPageIndexChange={pageIndex => controller.pushParams({ page: pageIndex + 1 })}
      onPageSizeChange={pageSize => controller.pushParams({ page: 1, pageSize })}
    />
  )
}
