'use client'

import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { DataGrid, DataGridPagination, DataGridToolbar } from '@/shared/ui/data-grid'
import { PlatformResourceScopeFilter } from './platform-resource-scope-filter'
import type { ColumnDef } from '@tanstack/react-table'

export const RuntimeInventoryLoadingSection = <TData,>({
  actionLabels,
  columns,
  pageSize = 20,
  searchPlaceholder
}: {
  actionLabels: string[]
  columns: ColumnDef<TData>[]
  pageSize?: number
  searchPlaceholder: string
}) => (
  <Section
    surface='plain'
    contentClassName='gap-4'
  >
    <DataGridToolbar
      disabled
      search=''
      searchPlaceholder={searchPlaceholder}
      onSearchChange={() => undefined}
      onSearchSubmit={() => undefined}
      filters={
        <PlatformResourceScopeFilter
          value='managed'
          onValueChange={() => undefined}
        />
      }
      actions={actionLabels.map(label => (
        <Button
          key={label}
          type='button'
          variant='ghost'
          disabled
        >
          {label}
        </Button>
      ))}
    />
    <DataGrid
      columns={columns}
      data={[]}
      totalItems={0}
      pageIndex={0}
      pageSize={pageSize}
      getRowId={() => ''}
      loading={{
        rowCount: Math.min(pageSize, 20),
        selectable: true,
        rowMenu: true
      }}
    />
    <DataGridPagination
      loading
      totalItems={0}
      pageIndex={0}
      pageSize={pageSize}
      onPageIndexChange={() => undefined}
      onPageSizeChange={() => undefined}
    />
  </Section>
)
