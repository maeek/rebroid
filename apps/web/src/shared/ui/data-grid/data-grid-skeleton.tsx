'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { DataGrid } from './data-grid'
import type { ListColumn } from '@/shared/ui/skeletons/list-skeleton-types'
import type { ColumnDef } from '@tanstack/react-table'

export type DataGridSkeletonProps = {
  columns: ListColumn[]
  minWidth?: string
  rows?: number
  selectable?: boolean
  rowMenu?: boolean
}

type LoadingRow = { id: string }

const columnSize = (width: string | undefined) => {
  if (!width) return 160
  const remMatch = width.match(/([\d.]+)rem/)
  if (remMatch?.[1]) return Number(remMatch[1]) * 16
  const pixelMatch = width.match(/([\d.]+)px/)
  if (pixelMatch?.[1]) return Number(pixelMatch[1])
  return 160
}

const skeletonDescriptor = (column: ListColumn) => {
  if (column.kind === 'stacked') return { kind: 'stacked' as const }
  if (column.kind === 'badge') return { kind: 'badge' as const, width: column.cellWidth }
  if (column.kind === 'actions' || column.kind === 'action') {
    return {
      kind: 'custom' as const,
      render: () => (
        <div className='flex min-h-10 items-center justify-end gap-2'>
          <Skeleton className='size-9' />
          <Skeleton className='h-9 w-20' />
        </div>
      )
    }
  }
  return { kind: 'text' as const, width: column.cellWidth }
}

export const DataGridSkeleton = ({
  columns,
  minWidth,
  rows = 6,
  selectable = true,
  rowMenu = true
}: DataGridSkeletonProps) => {
  const columnDefinitions: ColumnDef<LoadingRow>[] = columns.map((column, index) => ({
    id: `loading-${index}`,
    header: () => <Skeleton className={`h-3 max-w-full ${column.headerWidth}`} />,
    size: columnSize(column.width),
    enableSorting: false,
    meta: {
      label: `Loading column ${index + 1}`,
      skeleton: skeletonDescriptor(column)
    }
  }))

  return (
    <div data-testid='data-grid-skeleton'>
      <div data-testid='data-grid-skeleton-shell'>
        <DataGrid
          columns={columnDefinitions}
          data={[]}
          totalItems={0}
          pageIndex={0}
          pageSize={rows}
          getRowId={row => row.id}
          minWidth={minWidth}
          loading={{ rowCount: rows, selectable, rowMenu }}
        />
      </div>
    </div>
  )
}
