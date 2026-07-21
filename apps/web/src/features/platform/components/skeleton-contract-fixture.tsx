'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridToolbar } from '@/shared/ui/data-grid/data-grid-toolbar'
import type { ColumnDef } from '@tanstack/react-table'

type FixtureRow = {
  id: string
  name: string
  detail: string
  state: string
  value: string
}

const rows: FixtureRow[] = Array.from({ length: 20 }, (_, index) => ({
  id: String(index),
  name: `Resource ${index + 1}`,
  detail: `Stable detail ${index + 1}`,
  state: index % 2 === 0 ? 'ready' : 'idle',
  value: `value-${index + 1}`
}))

export const SkeletonContractFixture = () => {
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const columns = useMemo<ColumnDef<FixtureRow>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Resource',
        size: 384,
        meta: { label: 'Resource', skeleton: { kind: 'stacked', gap: 'gap-2' } },
        cell: ({ row }) => (
          <div className='grid gap-2'>
            <span>{row.original.name}</span>
            <span className='text-xs text-foreground-muted'>{row.original.detail}</span>
          </div>
        )
      },
      {
        id: 'state',
        accessorKey: 'state',
        header: 'State',
        size: 144,
        meta: { label: 'State', skeleton: { kind: 'badge' } },
        cell: ({ row }) => <span className='inline-flex h-5 rounded-full px-2'>{row.original.state}</span>
      },
      {
        id: 'value',
        accessorKey: 'value',
        header: 'Value',
        size: 224,
        meta: { label: 'Value', skeleton: { kind: 'text', width: 'w-28' } }
      }
    ],
    []
  )

  return (
    <main className='grid gap-4 p-6 max-sm:p-4'>
      <Button
        className='w-32'
        onClick={() => setLoading(current => !current)}
      >
        Toggle state
      </Button>
      <Section
        surface='plain'
        contentClassName='gap-4'
      >
        <div data-testid='contract-toolbar'>
          <DataGridToolbar
            disabled={loading}
            search=''
            searchPlaceholder='Search resources'
            onSearchChange={() => undefined}
            onSearchSubmit={() => undefined}
            actions={<Button disabled={loading}>Remove selected</Button>}
          />
        </div>
        <div data-testid='contract-grid'>
          <DataGrid
            columns={columns}
            data={loading ? [] : rows}
            totalItems={loading ? 0 : rows.length}
            pageIndex={0}
            pageSize={20}
            getRowId={row => row.id}
            selection={loading ? undefined : { selectedIds, onSelectedIdsChange: setSelectedIds }}
            rowContextMenu={loading ? undefined : () => null}
            loading={loading ? { rowCount: 20, selectable: true, rowMenu: true } : false}
          />
        </div>
        <div data-testid='contract-pagination'>
          <DataGridPagination
            loading={loading}
            pageIndex={0}
            pageSize={20}
            totalItems={loading ? 0 : rows.length}
            onPageIndexChange={() => undefined}
            onPageSizeChange={() => undefined}
          />
        </div>
      </Section>
    </main>
  )
}
