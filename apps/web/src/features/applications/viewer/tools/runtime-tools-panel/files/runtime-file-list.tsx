'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  IconArrowsSort,
  IconDownload,
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconPencil,
  IconRefresh,
  IconTrash
} from '@tabler/icons-react'
import { functionalUpdate, type ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MutationButton } from '@/components/ui/mutation-button'
import { formatDateLocale } from '@/lib/format'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { StateView } from '@/shared/ui/state-view'
import {
  runtimeFileEntryDetail,
  type RuntimeFileSort,
  type RuntimeFileSortDirection
} from './downloads-tools-section-model'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

const sortLabels = { name: 'Name', size: 'Size', modified: 'Modified' } satisfies Record<RuntimeFileSort, string>
const sortFields: RuntimeFileSort[] = ['name', 'size', 'modified']
const defaultPageSize = 20

const getRowId = (entry: ApplicationRuntimeFile) => entry.path

const moveEntryFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
  if (!['ArrowDown', 'ArrowUp', 'End', 'Home'].includes(event.key)) return
  const scope = event.currentTarget.closest('[data-runtime-file-list]')
  if (!scope) return
  const entries = Array.from(scope.querySelectorAll<HTMLButtonElement>('[data-runtime-file-entry]'))
  const currentIndex = entries.indexOf(event.currentTarget)
  if (currentIndex < 0) return
  event.preventDefault()
  let nextIndex = event.key === 'Home' ? 0 : entries.length - 1
  if (event.key === 'ArrowDown') nextIndex = Math.min(currentIndex + 1, entries.length - 1)
  if (event.key === 'ArrowUp') nextIndex = Math.max(currentIndex - 1, 0)
  entries[nextIndex]?.focus()
}

export const RuntimeFileList = ({
  canManageFiles,
  error,
  files,
  loading,
  refreshing,
  searchQuery,
  sort,
  sortDirection,
  onDelete,
  onDownload,
  onOpen,
  onPrefetch,
  onRefresh,
  onRename,
  onSearchChange,
  onSort,
  onUpload
}: {
  canManageFiles: boolean
  error: Error | null
  files: ApplicationRuntimeFile[]
  loading: boolean
  refreshing?: boolean
  searchQuery: string
  sort: RuntimeFileSort
  sortDirection: RuntimeFileSortDirection
  onDelete: (entry: ApplicationRuntimeFile) => void
  onDownload: (entry: ApplicationRuntimeFile) => void
  onOpen: (entry: ApplicationRuntimeFile, trigger?: HTMLButtonElement) => void
  onPrefetch: (path: string) => void
  onRefresh: () => void
  onRename: (entry: ApplicationRuntimeFile) => void
  onSearchChange: (value: string) => void
  onSort: (sort: RuntimeFileSort, direction: RuntimeFileSortDirection) => void
  onUpload?: () => void
}) => {
  const listRef = useRef<HTMLDivElement>(null)
  const [listWidth, setListWidth] = useState(0)
  const compact = listWidth > 0 && listWidth < 560
  const nameWidth = Math.min(720, Math.max(160, listWidth - (compact ? 56 : 356)))
  const [pageSize, setPageSize] = useState(defaultPageSize)
  useEffect(() => {
    const list = listRef.current
    if (!list || typeof ResizeObserver === 'undefined') return
    const measure = () => setListWidth(list.clientWidth)
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    measure()
    return () => observer.disconnect()
  }, [])

  const [requestedPage, setPage] = useState(0)
  const pageIndex = Math.min(requestedPage, Math.max(0, Math.ceil(files.length / pageSize) - 1))
  const columns = useMemo<ColumnDef<ApplicationRuntimeFile>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        size: nameWidth,
        sortDescFirst: false,
        enableHiding: false,
        enableSorting: !compact,
        meta: { skeleton: { kind: compact ? 'stacked' : 'text' } },
        cell: ({ row: { original: entry } }) => {
          const isDirectory = entry.type === 'directory'
          const Icon = isDirectory ? IconFolder : IconFile
          return (
            <Button
              type='button'
              variant='bare'
              className='h-auto min-h-8 w-full min-w-0 justify-start px-0 text-left'
              aria-label={entry.name}
              data-runtime-file-entry=''
              onKeyDown={moveEntryFocus}
              onMouseEnter={() => {
                if (isDirectory) onPrefetch(entry.path)
              }}
              onClick={event => onOpen(entry, event.currentTarget)}
              title={entry.name}
            >
              <Icon className={isDirectory ? 'size-4 text-primary' : 'size-4 text-foreground-muted'} />
              <span className='grid min-w-0'>
                <span className='truncate'>{entry.name}</span>
                {compact ? (
                  <span className='truncate text-xs font-normal text-foreground-muted'>
                    {runtimeFileEntryDetail(entry)}
                    {entry.modifiedAt ? ` · ${formatDateLocale(entry.modifiedAt)}` : ''}
                  </span>
                ) : null}
              </span>
            </Button>
          )
        }
      },
      {
        id: 'size',
        accessorKey: 'sizeBytes',
        header: 'Size',
        size: 100,
        cell: ({ row: { original: entry } }) => (
          <span className='text-foreground-muted'>
            {entry.type === 'directory' && entry.itemCount === null ? '—' : runtimeFileEntryDetail(entry)}
          </span>
        )
      },
      {
        id: 'modified',
        accessorKey: 'modifiedAt',
        header: 'Modified',
        size: 192,
        cell: ({ row }) => (
          <span className='whitespace-nowrap text-foreground-muted'>
            {row.original.modifiedAt ? formatDateLocale(row.original.modifiedAt) : '—'}
          </span>
        )
      }
    ],
    [compact, nameWidth, onOpen, onPrefetch]
  )
  const changeSort = (nextSort: RuntimeFileSort, direction: RuntimeFileSortDirection) => {
    setPage(0)
    onSort(nextSort, direction)
  }
  const sorting = [{ id: sort, desc: sortDirection === 'desc' }]
  const changeSearch = (value: string) => {
    if (searchQuery === value) return
    setPage(0)
    onSearchChange(value)
  }

  return (
    <div
      ref={listRef}
      data-runtime-file-list=''
      className='min-w-0'
    >
      <DataGridWorkspace
        search={searchQuery}
        searchPlaceholder='Search this folder'
        onSearchChange={changeSearch}
        onSearch={changeSearch}
        disabled={loading}
        actions={
          <>
            {compact ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    aria-label={`Sort by ${sortLabels[sort]}, ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
                  >
                    <IconArrowsSort className='size-4' />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  {sortFields.map(field => (
                    <DropdownMenuItem
                      key={field}
                      onClick={() => changeSort(field, field === sort && sortDirection === 'asc' ? 'desc' : 'asc')}
                    >
                      {sortLabels[field]}
                      {field === sort ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <MutationButton
              type='button'
              size='sm'
              variant='ghost'
              disabled={loading}
              pending={refreshing}
              pendingLabel='Refreshing…'
              onClick={onRefresh}
            >
              <IconRefresh className='size-4' />
              Refresh
            </MutationButton>
          </>
        }
      >
        <DataGrid
          columns={compact ? columns.slice(0, 1) : columns}
          data={files.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)}
          totalItems={files.length}
          pageIndex={pageIndex}
          pageSize={pageSize}
          getRowId={getRowId}
          loading={loading}
          sorting={sorting}
          onSortingChange={updater => {
            const [next] = functionalUpdate(updater, sorting)
            if (next?.id === 'name' || next?.id === 'size' || next?.id === 'modified') {
              changeSort(next.id, next.desc ? 'desc' : 'asc')
            }
          }}
          rowContextMenu={({ original: entry }) => (
            <>
              {entry.type === 'file' ? (
                <ContextMenuItem onSelect={() => onDownload(entry)}>
                  <IconDownload className='size-4' /> Download
                </ContextMenuItem>
              ) : (
                <ContextMenuItem onSelect={() => onOpen(entry)}>
                  <IconFolderOpen className='size-4' /> Open folder
                </ContextMenuItem>
              )}
              {canManageFiles ? (
                <>
                  <ContextMenuItem onSelect={() => onRename(entry)}>
                    <IconPencil className='size-4' /> Rename
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant='danger'
                    onSelect={() => onDelete(entry)}
                  >
                    <IconTrash className='size-4' /> Delete
                  </ContextMenuItem>
                </>
              ) : null}
            </>
          )}
          emptyState={
            error ? (
              <StateView
                scope='grid'
                kind='error'
                title='Could not load this folder'
                description={error.message}
                actions={[{ label: 'Try again', onClick: onRefresh }]}
              />
            ) : (
              <DataGridEmptyState
                title='This folder is empty'
                description='Upload or drop files here, or choose another location.'
                actions={onUpload ? [{ label: 'Upload files', onClick: onUpload }] : undefined}
              />
            )
          }
        />
        {files.length > pageSize || pageSize !== defaultPageSize ? (
          <DataGridPagination
            pageIndex={pageIndex}
            pageSize={pageSize}
            totalItems={files.length}
            onPageIndexChange={setPage}
            onPageSizeChange={size => {
              setPageSize(size)
              setPage(0)
            }}
          />
        ) : null}
      </DataGridWorkspace>
    </div>
  )
}
