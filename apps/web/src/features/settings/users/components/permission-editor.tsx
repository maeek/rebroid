'use client'

import { useMemo, useState } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { permissionCategories, permissionDefinitions, type PermissionMap } from '@/shared/permissions/permissions'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import {
  PermissionEditorContext,
  PermissionIdentityCell,
  PermissionEffectiveCell,
  PermissionSettingCell
} from './permission-cells'
import type { EffectiveAccess } from '@/shared/permissions/effective-access'
import type { ColumnDef } from '@tanstack/react-table'

export const PermissionEditor = ({
  permissions = {},
  onChange,
  decisions = {},
  disabled = false,
  loading = false
}: {
  permissions?: PermissionMap
  onChange?: (permissions: PermissionMap) => void
  decisions?: EffectiveAccess['decisions']
  disabled?: boolean
  loading?: boolean
}) => {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const editable = onChange !== undefined
  const grantedCount = permissionDefinitions.filter(permission =>
    editable ? permissions[permission.id] === true : decisions[permission.id]?.allowed
  ).length
  const query = search.trim().toLowerCase()
  const visible = permissionDefinitions.filter(permission => {
    if (category !== 'all' && permission.category !== category) return false
    const categoryName = permissionCategories.find(item => item.id === permission.category)?.name ?? ''
    return `${permission.name} ${permission.id} ${permission.description} ${categoryName} ${decisions[permission.id]?.groupName ?? ''}`
      .toLowerCase()
      .includes(query)
  })

  const currentPage = Math.min(pageIndex, Math.max(0, Math.ceil(visible.length / pageSize) - 1))
  const columns = useMemo<ColumnDef<(typeof permissionDefinitions)[number]>[]>(
    () => [
      {
        id: 'permission',
        header: 'Permission',
        size: 520,
        minSize: 260,
        enableSorting: false,
        enableHiding: false,
        meta: { skeleton: { kind: 'stacked' } },
        cell: PermissionIdentityCell
      },
      ...(!editable
        ? [
            {
              id: 'effective',
              header: 'Effective access',
              size: 220,
              minSize: 160,
              enableSorting: false,
              enableHiding: false,
              meta: { skeleton: { kind: 'stacked' as const } },
              cell: PermissionEffectiveCell
            }
          ]
        : []),
      ...(editable
        ? [
            {
              id: 'setting',
              header: 'Group setting',
              size: 200,
              minSize: 180,
              enableResizing: false,
              enableSorting: false,
              enableHiding: false,
              meta: { skeleton: { kind: 'text' as const } },
              cell: PermissionSettingCell
            }
          ]
        : [])
    ],
    [editable]
  )
  return (
    <PermissionEditorContext.Provider value={{ permissions, decisions, disabled, onChange }}>
      <div
        className='@container/permissions grid min-w-0 gap-4'
        data-permission-editor=''
      >
        <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
          <p
            className='text-foreground-muted'
            aria-live='polite'
          >
            {loading ? (
              <Skeleton
                as='span'
                className='block h-5 w-64 max-w-full'
              />
            ) : (
              <>
                {' '}
                {grantedCount} of {permissionDefinitions.length} permissions granted
              </>
            )}
          </p>
        </div>
        <DataGridWorkspace
          search={search}
          searchPlaceholder='Search permissions'
          onSearchChange={value => {
            setSearch(value)
            setPageIndex(0)
          }}
          onSearch={() => undefined}
          disabled={loading || disabled}
          actions={
            <div className='flex max-w-full flex-wrap items-end gap-3'>
              <FormField
                label='Permission category'
                className='w-52 max-w-full'
                layout='vertical'
              >
                <Select
                  value={category}
                  disabled={loading}
                  onValueChange={value => {
                    setCategory(value)
                    setPageIndex(0)
                  }}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All categories</SelectItem>
                    {permissionCategories.map(item => (
                      <SelectItem
                        key={item.id}
                        value={item.id}
                      >
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          }
        >
          <DataGrid
            columns={columns}
            data={visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize)}
            totalItems={visible.length}
            pageIndex={currentPage}
            pageSize={pageSize}
            getRowId={permission => permission.id}
            loading={loading && { rowCount: 6 }}
            emptyState={
              <DataGridEmptyState
                title='No matching permissions'
                filtered={Boolean(search.trim()) || category !== 'all'}
                onReset={
                  category !== 'all'
                    ? () => {
                        setCategory('all')
                        setPageIndex(0)
                      }
                    : undefined
                }
              />
            }
          />
          <DataGridPagination
            pageIndex={currentPage}
            pageSize={pageSize}
            totalItems={visible.length}
            onPageIndexChange={setPageIndex}
            onPageSizeChange={size => {
              setPageSize(size)
              setPageIndex(0)
            }}
            loading={loading}
          />
        </DataGridWorkspace>
        {editable ? <p className='text-xs text-foreground-muted'>Changes apply when you save.</p> : null}
      </div>
    </PermissionEditorContext.Provider>
  )
}
