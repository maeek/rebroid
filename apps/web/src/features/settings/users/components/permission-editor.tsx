'use client'

import { useMemo, useState } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { permissionCategories, permissionDefinitions, type PermissionMap } from '@/shared/permissions/permissions'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import {
  PermissionEditorContext,
  PermissionIdentityCell,
  PermissionEffectiveCell,
  PermissionSettingCell
} from './permission-cells'
import type { EffectiveAccess } from '@/shared/permissions/effective-access'
import type { ColumnDef } from '@tanstack/react-table'

const getPermissionCategory = (permission: (typeof permissionDefinitions)[number]) =>
  permissionCategories[permission.category]

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
  const editable = onChange !== undefined
  const grantedCount = permissionDefinitions.filter(permission =>
    editable ? permissions[permission.id] === true : decisions[permission.id]?.allowed
  ).length
  const query = search.trim().toLowerCase()
  const visible = permissionDefinitions.filter(permission => {
    if (category !== 'all' && permission.category !== category) return false
    return `${permission.name} ${permission.id} ${permission.description} ${getPermissionCategory(permission)} ${decisions[permission.id]?.groupName ?? ''}`
      .toLowerCase()
      .includes(query)
  })

  const columns = useMemo<ColumnDef<(typeof permissionDefinitions)[number]>[]>(
    () => [
      {
        id: 'permission',
        header: 'Permission',
        size: 520,
        minSize: 260,
        enableSorting: false,
        enableHiding: false,
        meta: { cellContentClassName: 'lg:ps-3', skeleton: { kind: 'stacked' } },
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
                {grantedCount} of {permissionDefinitions.length} permissions granted
              </>
            )}
          </p>
        </div>
        <DataGridWorkspace
          search={search}
          searchPlaceholder='Search permissions'
          onSearchChange={setSearch}
          onSearch={() => undefined}
          disabled={loading || disabled}
          actions={
            <FormField
              label='Permission category'
              className='w-52 max-w-full'
              layout='vertical'
            >
              <Select
                value={category}
                disabled={loading || disabled}
                onValueChange={setCategory}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All categories</SelectItem>
                  {Object.entries(permissionCategories).map(([id, name]) => (
                    <SelectItem
                      key={id}
                      value={id}
                    >
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          }
        >
          <DataGrid
            columns={columns}
            data={visible}
            totalItems={visible.length}
            pageIndex={0}
            pageSize={permissionDefinitions.length}
            getRowId={permission => permission.id}
            getRowGroupLabel={getPermissionCategory}
            loading={loading}
            emptyState={
              <DataGridEmptyState
                title='No matching permissions'
                filtered={Boolean(search.trim()) || category !== 'all'}
                onReset={category !== 'all' ? () => setCategory('all') : undefined}
              />
            }
          />
        </DataGridWorkspace>
        {editable ? <p className='text-xs text-foreground-muted'>Changes apply when you save.</p> : null}
      </div>
    </PermissionEditorContext.Provider>
  )
}
