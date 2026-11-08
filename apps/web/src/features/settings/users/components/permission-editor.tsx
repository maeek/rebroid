'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Notice } from '@/components/ui/notice'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { permissionCategories, permissionDefinitions, type PermissionMap } from '@/shared/permissions/permissions'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import {
  PermissionEditorContext,
  PermissionIdentityCell,
  PermissionEffectiveCell,
  PermissionSettingCell
} from './permission-cells'
import type { PermissionInheritanceMap } from '../model/permission-access'
import type { ColumnDef } from '@tanstack/react-table'

export const PermissionEditor = ({
  permissions,
  onChange,
  inheritedPermissions,
  admin = false,
  disabled = false,
  loading = false
}: {
  permissions: PermissionMap
  onChange: (permissions: PermissionMap) => void
  inheritedPermissions?: PermissionInheritanceMap
  admin?: boolean
  disabled?: boolean
  loading?: boolean
}) => {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [view, setView] = useState('all')
  const isUser = inheritedPermissions !== undefined
  let actionLabel = 'Group setting'
  if (isUser) actionLabel = 'User override'
  const overrideCount = permissionDefinitions.filter(permission => permissions[permission.id] !== undefined).length
  const allowed = (id: (typeof permissionDefinitions)[number]['id']) => {
    if (admin) return true
    return permissions[id] ?? inheritedPermissions?.[id]?.allowed ?? false
  }
  const grantedCount = permissionDefinitions.filter(permission => allowed(permission.id)).length
  const query = search.trim().toLowerCase()
  const visible = permissionDefinitions.filter(permission => {
    if (category !== 'all' && permission.category !== category) return false
    if (!admin && view === 'overrides' && permissions[permission.id] === undefined) return false
    const categoryName = permissionCategories.find(item => item.id === permission.category)?.name ?? ''
    return `${permission.name} ${permission.id} ${permission.description} ${categoryName} ${inheritedPermissions?.[permission.id]?.source ?? ''}`
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
      ...(isUser || admin
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
      ...(!admin
        ? [
            {
              id: 'setting',
              header: actionLabel,
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
    [isUser, admin, actionLabel]
  )
  return (
    <PermissionEditorContext.Provider value={{ permissions, inheritedPermissions, isUser, admin, disabled, onChange }}>
      <div
        className='@container/permissions grid min-w-0 gap-4'
        data-permission-editor=''
      >
        {admin ? (
          <Notice
            title='Full administrator access'
            description={
              isUser
                ? 'Admin users have every permission and unlimited quotas. Group settings and user overrides cannot restrict this role.'
                : 'Admin groups grant every permission and unlimited quotas. Choose the User template to customize access.'
            }
          />
        ) : null}
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
                {isUser && !admin ? ` · ${overrideCount} user ${overrideCount === 1 ? 'override' : 'overrides'}` : ''}
              </>
            )}
          </p>
          {isUser && !admin ? (
            <Button
              type='button'
              size='sm'
              variant='ghost'
              disabled={disabled || loading || overrideCount === 0}
              onClick={() => onChange({})}
            >
              Reset all overrides
            </Button>
          ) : null}
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
              {isUser && !admin ? (
                <FormField
                  label='Show'
                  className='w-52 max-w-full'
                  layout='vertical'
                >
                  <Select
                    value={view}
                    disabled={loading}
                    onValueChange={value => {
                      setView(value)
                      setPageIndex(0)
                    }}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All permissions</SelectItem>
                      <SelectItem value='overrides'>User overrides</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              ) : null}
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
              <p className='text-center text-sm text-foreground-muted'>No permissions match these filters.</p>
            }
          />
          <DataGridPagination
            pageIndex={currentPage}
            pageSize={pageSize}
            totalItems={visible.length}
            onPageIndexChange={setPageIndex}
            onPageSizeChange={setPageSize}
            loading={loading}
          />
        </DataGridWorkspace>
        <p className='text-xs text-foreground-muted'>Changes apply when you save.</p>
      </div>
    </PermissionEditorContext.Provider>
  )
}
