'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { Surface } from '@/components/ui/surface'
import { Toaster } from '@/components/ui/toaster'
import { toast } from '@/hooks/use-toast'
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
      <Toaster />
      <Button
        className='w-32'
        onClick={() => setLoading(current => !current)}
      >
        Toggle state
      </Button>
      <div className='flex flex-wrap gap-3'>
        <Surface
          data-testid='contract-success-banner'
          level='band'
          tone='success'
          className='px-4 py-3'
        >
          Healthy
        </Surface>
        <Surface
          data-testid='contract-neutral-banner'
          level='band'
          className='px-4 py-3'
        >
          Neutral
        </Surface>
        <Button onClick={() => toast({ title: 'Mutation complete', variant: 'success', timeout: 0 })}>
          Show success toast
        </Button>
      </div>
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
      <div
        data-testid='contract-family-detail'
        className='grid min-h-72 gap-4 lg:grid-cols-2'
      >
        {['Runtime', 'Metadata'].map((title, index) => (
          <Section
            key={title}
            surface='panel'
            title={title}
            description='Known detail section chrome remains visible while values load.'
          >
            <div className='grid gap-3'>
              {Array.from({ length: 4 }, (_, rowIndex) => (
                <div
                  key={rowIndex}
                  className='grid h-8 grid-cols-2 items-center gap-4 border-b border-surface-border/40'
                >
                  <span className='text-xs text-foreground-muted'>Field {rowIndex + 1}</span>
                  {loading ? (
                    <Skeleton className='h-4 w-full max-w-36 justify-self-end' />
                  ) : (
                    <span className='h-4 justify-self-end text-sm'>Value {index + rowIndex + 1}</span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        ))}
      </div>
      <div data-testid='contract-family-form'>
        <Section
          surface='panel'
          title='Form settings'
          description='Known fields and actions render immediately.'
        >
          <div className='grid min-h-52 content-start gap-5 md:grid-cols-2'>
            {['Name', 'Image', 'Timeout', 'CPU limit'].map(label => (
              <FormField
                key={label}
                label={label}
                layout='vertical'
              >
                <Input
                  disabled={loading}
                  value={loading ? '' : `${label} value`}
                  readOnly
                />
              </FormField>
            ))}
          </div>
        </Section>
      </div>
      <div
        data-testid='contract-family-split'
        className='grid min-h-80 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]'
      >
        <Surface
          level='panel'
          className='min-w-0 p-5'
        >
          <div className='grid gap-4'>
            <h2 className='text-base font-medium'>Editor</h2>
            {loading ? (
              <Skeleton className='h-56 w-full' />
            ) : (
              <div className='h-56 rounded-control bg-surface-band/45' />
            )}
          </div>
        </Surface>
        <Surface
          level='panel'
          className='min-w-0 p-5'
        >
          <div className='grid gap-4'>
            <h2 className='text-base font-medium'>Inspector</h2>
            {loading ? (
              <Skeleton className='h-56 w-full' />
            ) : (
              <div className='h-56 rounded-control bg-surface-band/45' />
            )}
          </div>
        </Surface>
      </div>
      <div
        data-testid='contract-family-immersive'
        className='relative h-96 min-w-0 overflow-hidden rounded-feature border border-surface-border/50 bg-black'
      >
        {loading ? (
          <Skeleton className='absolute inset-0 size-full rounded-none bg-surface-band/45' />
        ) : (
          <div className='absolute inset-0 grid place-items-center text-sm text-white/70'>Live viewer surface</div>
        )}
        <Surface
          level='floating'
          className='absolute right-4 bottom-4 left-4 h-14'
        />
      </div>
    </main>
  )
}
