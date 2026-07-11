import { DataGridSkeleton } from '@/shared/ui/data-grid/data-grid-skeleton'
import type { ListColumn } from './list-skeleton-types'

export const TableSkeleton = ({
  columns,
  minWidth = '64rem',
  rows = 6
}: {
  columns: ListColumn[]
  minWidth?: string
  rows?: number
}) => (
  <DataGridSkeleton
    columns={columns}
    minWidth={minWidth}
    rows={rows}
    selectable={false}
    rowMenu={false}
  />
)
